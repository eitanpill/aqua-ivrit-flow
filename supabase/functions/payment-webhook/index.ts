import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log('[payment-webhook] Method not allowed:', req.method);
    return new Response(
      JSON.stringify({ received: true, error: 'Method not allowed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the incoming payload from Morning
    const payload = await req.json();
    
    // Log webhook receipt
    console.log('[payment-webhook] Received payload:', JSON.stringify(payload));

    // Extract relevant fields from Morning webhook
    // Morning sends two webhook types - document webhook and payment-link webhook
    // Document webhook: recipient.emails[0], payment-link webhook: payer.email
    const email = 
      payload.payer?.email || 
      payload.recipient?.emails?.[0] || 
      payload.email || 
      payload.client?.email || 
      payload.customerEmail;
    
    const amount = parseFloat(payload.total || payload.amount || payload.sum || '0');
    const docNumber = String(payload.number || payload.docNumber || payload.invoiceNumber || '');
    const transactionId = payload.id || payload.transactionId || payload.paymentId || '';
    
    // Extract customer name for logging
    const customerName = payload.payer?.name || payload.recipient?.name || '';
    const customerPhone = payload.payer?.phone || payload.recipient?.phone || payload.recipient?.mobile || '';
    
    // Extract invoice download URL from Morning
    const invoiceUrl = 
      payload.files?.downloadLinks?.he || 
      payload.files?.downloadLinks?.origin ||
      payload.documentUrl ||
      null;

    console.log('[payment-webhook] Parsed data:', { email, amount, docNumber, transactionId, customerName, customerPhone, invoiceUrl: invoiceUrl ? 'exists' : 'none' });

    if (!email) {
      console.error('[payment-webhook] No email found in payload');
      // Still return 200 so Morning doesn't retry
      return new Response(
        JSON.stringify({ received: true, processed: false, reason: 'no_email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Find user by email
    // First check auth.users via admin API
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    let userId: string | null = null;
    let schoolId: string | null = null;

    if (!authError && authUsers?.users) {
      const foundUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (foundUser) {
        userId = foundUser.id;
        console.log('[payment-webhook] Found user in auth.users:', userId);
      }
    }

    // If not found in auth, check profiles table
    if (!userId) {
      // Try to find by looking up profiles that might have email stored elsewhere
      // For now, we'll log this case
      console.log('[payment-webhook] User not found in auth.users for email:', email);
    }

    // Get school_id from profile if user found
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', userId)
        .single();
      
      if (profile?.school_id) {
        schoolId = profile.school_id;
      }
    }

    // Step 2: Insert transaction record
    if (userId) {
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          school_id: schoolId,
          amount: amount,
          status: 'completed',
          type: 'credit_purchase',
          payment_method: 'morning_page',
          reference_id: docNumber || transactionId,
          description: `תשלום דרך Morning - חשבונית ${docNumber}`,
        })
        .select()
        .single();

      if (txError) {
        console.error('[payment-webhook] Transaction insert error:', txError);
      } else {
        console.log('[payment-webhook] Transaction created:', transaction?.id);
        
        // Step 2.5: Create invoice record with the Morning download link
        if (invoiceUrl && transaction?.id) {
          const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
              user_id: userId,
              school_id: schoolId,
              transaction_id: transaction.id,
              invoice_number: docNumber || `M-${transactionId.substring(0, 8)}`,
              amount: amount,
              url: invoiceUrl,
              issued_at: new Date().toISOString(),
            })
            .select()
            .single();
          
          if (invoiceError) {
            console.error('[payment-webhook] Invoice insert error:', invoiceError);
          } else {
            console.log('[payment-webhook] Invoice created:', invoice?.id, 'with URL');
          }
        } else {
          console.log('[payment-webhook] No invoice URL to save');
        }
      }

      // Step 3: Grant access based on amount
      if (amount >= 400) {
        // High amount = Subscription (monthly/yearly based on logic)
        // For now, create a simple log - actual subscription logic depends on product
        console.log('[payment-webhook] High-value payment detected (>=400), subscription logic would apply');
        
        // You could insert a subscription record here if you have product_id and swimmer_id
        // For now, we just log it - actual implementation depends on your business logic
        
      } else if (amount > 0) {
        // Lower amount = Add credits to wallet
        console.log('[payment-webhook] Adding credits to wallet for amount:', amount);
        
        // Calculate credits (1 credit per payment for now, adjust as needed)
        const creditsToAdd = 1;

        // Check if wallet exists
        const { data: existingWallet } = await supabase
          .from('customer_wallets')
          .select('id, credits_balance')
          .eq('user_id', userId)
          .single();

        if (existingWallet) {
          // Update existing wallet
          const newBalance = (existingWallet.credits_balance || 0) + creditsToAdd;
          const { error: walletError } = await supabase
            .from('customer_wallets')
            .update({ 
              credits_balance: newBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingWallet.id);

          if (walletError) {
            console.error('[payment-webhook] Wallet update error:', walletError);
          } else {
            console.log('[payment-webhook] Wallet updated, new balance:', newBalance);
          }

          // Log wallet transaction
          await supabase
            .from('wallet_transactions')
            .insert({
              wallet_id: existingWallet.id,
              amount: creditsToAdd,
              balance_after: newBalance,
              type: 'credit',
              description: `קרדיט מתשלום Morning - ${docNumber}`,
              reference_id: docNumber || transactionId,
            });

        } else {
          // Create new wallet
          const { data: newWallet, error: createError } = await supabase
            .from('customer_wallets')
            .insert({
              user_id: userId,
              credits_balance: creditsToAdd,
            })
            .select()
            .single();

          if (createError) {
            console.error('[payment-webhook] Wallet creation error:', createError);
          } else {
            console.log('[payment-webhook] New wallet created with balance:', creditsToAdd);

            // Log initial wallet transaction
            if (newWallet) {
              await supabase
                .from('wallet_transactions')
                .insert({
                  wallet_id: newWallet.id,
                  amount: creditsToAdd,
                  balance_after: creditsToAdd,
                  type: 'credit',
                  description: `קרדיט ראשוני מתשלום Morning - ${docNumber}`,
                  reference_id: docNumber || transactionId,
                });
            }
          }
        }
      }
    }

    // Always return 200 so Morning knows we received the webhook
    return new Response(
      JSON.stringify({ 
        received: true, 
        processed: !!userId,
        userId: userId || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[payment-webhook] Unexpected error:', error);
    
    // Still return 200 to prevent Morning from retrying indefinitely
    return new Response(
      JSON.stringify({ received: true, error: 'Internal processing error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
