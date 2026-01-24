import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PurchaseRequest {
  product_id: string;
  swimmer_id?: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  type: 'subscription' | 'punch_card' | 'single_session' | 'trial';
  price: number;
  credits_amount: number | null;
  duration_days: number | null;
  school_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'לא מורשה', details: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service role client for database operations (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('❌ Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'אימות נכשל', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 Processing purchase for user: ${user.id} (${user.email})`);

    // Check if demo user
    if (user.email === 'demo@aquaflow.app') {
      console.log('⚠️ Demo user attempted purchase - blocking');
      return new Response(
        JSON.stringify({ success: false, error: 'רכישות חסומות במצב הדגמה' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: PurchaseRequest = await req.json();
    const { product_id, swimmer_id } = body;

    if (!product_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'חסר מזהה מוצר', details: 'product_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Product ID: ${product_id}, Swimmer ID: ${swimmer_id || 'N/A'}`);

    // Fetch product details using admin client
    const { data: product, error: productError } = await adminClient
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('active', true)
      .eq('is_deleted', false)
      .single();

    if (productError || !product) {
      console.error('❌ Product not found:', productError?.message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'מוצר לא נמצא או לא פעיל', 
          details: productError?.message || 'Product not found' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typedProduct = product as Product;
    console.log(`✅ Product found: ${typedProduct.name} - ₪${typedProduct.price}`);

    // Generate unique references
    const transactionRef = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    console.log(`💳 Processing mock payment of ₪${typedProduct.price}...`);
    console.log(`📝 Transaction Ref: ${transactionRef}, Invoice: ${invoiceNumber}`);
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // ========================================
    // Step 1: Create transaction record
    // ========================================
    const { data: transaction, error: txError } = await adminClient
      .from('transactions')
      .insert({
        user_id: user.id,
        amount: typedProduct.price,
        type: 'purchase',
        status: 'completed',
        description: `רכישת ${typedProduct.name}`,
        reference_id: transactionRef,
      })
      .select('id, reference_id, amount, status, created_at')
      .single();

    if (txError) {
      console.error('❌ Transaction insert error:', JSON.stringify(txError));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'שגיאה ביצירת עסקה', 
          details: txError.message,
          code: txError.code,
          hint: txError.hint
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Transaction created: ${transaction.id}`);

    // ========================================
    // Step 2: Create invoice record
    // ========================================
    const { data: invoice, error: invError } = await adminClient
      .from('invoices')
      .insert({
        user_id: user.id,
        transaction_id: transaction.id,
        invoice_number: invoiceNumber,
        amount: typedProduct.price,
        issued_at: new Date().toISOString(),
      })
      .select('id, invoice_number')
      .single();

    if (invError) {
      console.error('⚠️ Invoice insert error (non-critical):', JSON.stringify(invError));
      // Continue - invoice is not critical for the flow
    } else {
      console.log(`✅ Invoice created: ${invoice.invoice_number}`);
    }

    // ========================================
    // Step 3: Handle product type specific logic
    // ========================================
    let subscriptionResult = null;
    let walletResult = null;

    if (typedProduct.type === 'subscription') {
      const startDate = new Date();
      const endDate = typedProduct.duration_days 
        ? new Date(startDate.getTime() + typedProduct.duration_days * 24 * 60 * 60 * 1000)
        : null;

      // Validate swimmer exists if provided
      if (swimmer_id) {
        const { data: swimmer, error: swimmerError } = await adminClient
          .from('swimmers')
          .select('id, parent_id')
          .eq('id', swimmer_id)
          .single();
        
        if (swimmerError || !swimmer) {
          console.error('❌ Swimmer not found:', swimmerError?.message);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'תלמיד לא נמצא', 
              details: swimmerError?.message 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { data: subscription, error: subError } = await adminClient
        .from('subscriptions')
        .insert({
          parent_id: user.id,
          swimmer_id: swimmer_id,
          product_id: typedProduct.id,
          school_id: typedProduct.school_id,
          status: 'active',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate?.toISOString().split('T')[0] || null,
          next_billing_date: endDate?.toISOString().split('T')[0] || null,
        })
        .select('id, status, start_date, end_date')
        .single();

      if (subError) {
        console.error('❌ Subscription insert error:', JSON.stringify(subError));
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'שגיאה ביצירת מנוי', 
            details: subError.message,
            code: subError.code
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      subscriptionResult = subscription;
      console.log(`✅ Subscription created: ${subscription.id}`);
    }

    if (typedProduct.type === 'punch_card' && typedProduct.credits_amount) {
      // Get or create customer wallet
      let { data: wallet } = await adminClient
        .from('customer_wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!wallet) {
        // Create new wallet
        const { data: newWallet, error: createError } = await adminClient
          .from('customer_wallets')
          .insert({
            user_id: user.id,
            credits_balance: 0,
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Wallet creation error:', JSON.stringify(createError));
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'שגיאה ביצירת ארנק', 
              details: createError.message 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        wallet = newWallet;
        console.log(`✅ New wallet created for user`);
      }

      const newBalance = (wallet.credits_balance || 0) + typedProduct.credits_amount;
      
      // Update wallet balance
      const { error: updateError } = await adminClient
        .from('customer_wallets')
        .update({ 
          credits_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', wallet.id);

      if (updateError) {
        console.error('❌ Wallet update error:', JSON.stringify(updateError));
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'שגיאה בעדכון ארנק', 
            details: updateError.message 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Credits added: ${typedProduct.credits_amount}, New balance: ${newBalance}`);

      // Record wallet transaction
      const { error: walletTxError } = await adminClient
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          type: 'purchase',
          amount: typedProduct.credits_amount,
          balance_after: newBalance,
          description: `רכישת ${typedProduct.name}`,
          reference_id: transaction.id,
        });

      if (walletTxError) {
        console.error('⚠️ Wallet transaction log error (non-critical):', JSON.stringify(walletTxError));
      }

      walletResult = { 
        credits_added: typedProduct.credits_amount, 
        new_balance: newBalance 
      };
    }

    // ========================================
    // Build success response
    // ========================================
    const response = {
      success: true,
      message: `רכישת "${typedProduct.name}" הושלמה בהצלחה!`,
      data: {
        transaction_id: transaction.id,
        transaction_ref: transactionRef,
        invoice_number: invoice?.invoice_number || invoiceNumber,
        product: {
          id: typedProduct.id,
          name: typedProduct.name,
          type: typedProduct.type,
          price: typedProduct.price,
        },
        subscription: subscriptionResult,
        wallet: walletResult,
      }
    };

    console.log(`🎉 Purchase completed successfully!`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('❌ Unexpected error:', errorMessage);
    console.error('Stack:', errorStack);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'שגיאה בלתי צפויה', 
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});