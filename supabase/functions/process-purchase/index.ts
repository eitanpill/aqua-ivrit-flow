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
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'לא מורשה' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'אימות נכשל' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📦 Processing purchase for user: ${user.id}`);

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
        JSON.stringify({ success: false, error: 'חסר מזהה מוצר' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Product ID: ${product_id}, Swimmer ID: ${swimmer_id || 'N/A'}`);

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .eq('active', true)
      .single();

    if (productError || !product) {
      console.error('Product not found:', productError);
      return new Response(
        JSON.stringify({ success: false, error: 'מוצר לא נמצא או לא פעיל' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const typedProduct = product as Product;
    console.log(`✅ Product found: ${typedProduct.name} - ₪${typedProduct.price}`);

    // Generate unique transaction reference
    const transactionRef = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Start transaction simulation (mock payment processing)
    console.log(`💳 Processing mock payment of ₪${typedProduct.price}...`);
    
    // Simulate payment delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 1: Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        amount: typedProduct.price,
        type: 'purchase',
        status: 'completed',
        description: `רכישת ${typedProduct.name}`,
        reference_id: transactionRef,
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction insert error:', txError);
      return new Response(
        JSON.stringify({ success: false, error: 'שגיאה ביצירת עסקה' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Transaction created: ${transaction.id}`);

    // Step 2: Create invoice
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        transaction_id: transaction.id,
        invoice_number: invoiceNumber,
        amount: typedProduct.price,
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (invError) {
      console.error('Invoice insert error:', invError);
      // Continue even if invoice fails - transaction is the critical part
    } else {
      console.log(`✅ Invoice created: ${invoice.invoice_number}`);
    }

    // Step 3: Create subscription or add credits based on product type
    let subscriptionResult = null;
    let walletResult = null;

    if (typedProduct.type === 'subscription') {
      // Calculate end date based on duration
      const startDate = new Date();
      const endDate = typedProduct.duration_days 
        ? new Date(startDate.getTime() + typedProduct.duration_days * 24 * 60 * 60 * 1000)
        : null;
      
      const nextBilling = endDate;

      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          parent_id: user.id,
          swimmer_id: swimmer_id || user.id, // If no swimmer specified, use parent
          product_id: typedProduct.id,
          school_id: typedProduct.school_id,
          status: 'active',
          start_date: startDate.toISOString(),
          end_date: endDate?.toISOString() || null,
          next_billing_date: nextBilling?.toISOString() || null,
        })
        .select()
        .single();

      if (subError) {
        console.error('Subscription insert error:', subError);
      } else {
        subscriptionResult = subscription;
        console.log(`✅ Subscription created: ${subscription.id}`);
      }
    }

    if (typedProduct.type === 'punch_card' && typedProduct.credits_amount) {
      // Add credits to customer wallet
      // First, get or create wallet
      let { data: wallet, error: walletError } = await supabase
        .from('customer_wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (walletError && walletError.code === 'PGRST116') {
        // Wallet doesn't exist, create it
        const { data: newWallet, error: createError } = await supabase
          .from('customer_wallets')
          .insert({
            user_id: user.id,
            credits_balance: 0,
          })
          .select()
          .single();

        if (createError) {
          console.error('Wallet creation error:', createError);
        } else {
          wallet = newWallet;
        }
      }

      if (wallet) {
        const newBalance = (wallet.credits_balance || 0) + typedProduct.credits_amount;
        
        // Update wallet balance
        const { error: updateError } = await supabase
          .from('customer_wallets')
          .update({ credits_balance: newBalance })
          .eq('id', wallet.id);

        if (updateError) {
          console.error('Wallet update error:', updateError);
        } else {
          console.log(`✅ Credits added: ${typedProduct.credits_amount}, New balance: ${newBalance}`);
        }

        // Record wallet transaction
        const { error: walletTxError } = await supabase
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
          console.error('Wallet transaction error:', walletTxError);
        }

        walletResult = { credits_added: typedProduct.credits_amount, new_balance: newBalance };
      }
    }

    // Build success response
    const response = {
      success: true,
      message: `רכישת "${typedProduct.name}" הושלמה בהצלחה!`,
      data: {
        transaction_id: transaction.id,
        transaction_ref: transactionRef,
        invoice_number: invoice?.invoice_number || null,
        product: {
          id: typedProduct.id,
          name: typedProduct.name,
          type: typedProduct.type,
          price: typedProduct.price,
        },
        subscription: subscriptionResult ? {
          id: subscriptionResult.id,
          status: subscriptionResult.status,
          start_date: subscriptionResult.start_date,
          end_date: subscriptionResult.end_date,
        } : null,
        wallet: walletResult,
      }
    };

    console.log(`🎉 Purchase completed successfully:`, response);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'שגיאה בלתי צפויה' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
