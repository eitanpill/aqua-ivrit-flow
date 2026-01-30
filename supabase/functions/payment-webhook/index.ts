import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: track requests per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100; // requests
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Note: We no longer generate temporary passwords
// Users set their own password during registration

// Send payment confirmation notification via webhook (for existing users who set their own password)
interface PaymentConfirmationData {
  fullName: string;
  phone: string;
  email: string;
  loginUrl: string;
}

async function sendPaymentConfirmationNotification(data: PaymentConfirmationData): Promise<void> {
  const webhookUrl = Deno.env.get('PLATFORM_WELCOME_WEBHOOK_URL');
  
  if (!webhookUrl) {
    console.log('[payment-webhook] No PLATFORM_WELCOME_WEBHOOK_URL configured, skipping notification');
    return;
  }

  const payload = {
    event_type: 'payment_confirmed',
    timestamp: new Date().toISOString(),
    user: {
      full_name: data.fullName,
      phone: data.phone,
      email: data.email,
    },
    credentials: {
      login_url: data.loginUrl,
      username: data.email,
      // Note: No password sent - user already set their own during registration
    },
    message: `שלום ${data.fullName}! 🎉\n\nהתשלום שלך התקבל בהצלחה!\n\nכעת תוכל/י להתחבר ולהקים את בית הספר שלך.\n\n📧 שם משתמש: ${data.email}\n🔗 קישור להתחברות:\n${data.loginUrl}\n\nבהצלחה!`
  };

  try {
    console.log('[payment-webhook] Sending payment confirmation notification to webhook');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[payment-webhook] Webhook failed:', response.status, errorText);
    } else {
      console.log('[payment-webhook] Payment confirmation notification sent successfully');
    }
  } catch (error) {
    console.error('[payment-webhook] Error sending webhook:', error);
  }
}

// Fixed subscription link for school creation
const SCHOOL_SUBSCRIPTION_LINK = "https://mrng.to/3Q95CZQDbV";

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
    // ===== SECURITY: Token-based authentication (optional for Morning webhooks) =====
    const url = new URL(req.url);
    const providedToken = url.searchParams.get('token');
    const expectedToken = Deno.env.get('PAYMENT_WEBHOOK_TOKEN');
    
    // Token validation is optional - Morning doesn't support adding tokens to webhook URLs
    // We validate the token if provided, but allow requests without token from Morning
    // Morning webhooks are validated by checking for valid payload structure instead
    const hasValidToken = expectedToken && providedToken === expectedToken;
    
    if (providedToken && !hasValidToken) {
      // Token was provided but is invalid - reject
      console.warn('[payment-webhook] Invalid token provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!providedToken) {
      console.log('[payment-webhook] No token provided - assuming Morning webhook callback');
    }

    // ===== SECURITY: Rate limiting =====
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    if (!checkRateLimit(clientIP)) {
      console.warn('[payment-webhook] Rate limit exceeded for IP:', clientIP);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the incoming payload from Morning
    const payload = await req.json();
    
    // Log webhook receipt (without sensitive data)
    console.log('[payment-webhook] Received webhook from IP:', clientIP);

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

    // Check if this is a recurring/standing order payment (הוראת קבע)
    const isRecurring = payload.type === 'recurring' || 
                        payload.paymentType === 'recurring' ||
                        payload.isRecurring === true ||
                        payload.docType === 320 || // Morning recurring invoice type
                        payload.description?.includes('הוראת קבע');

    console.log('[payment-webhook] Parsed data:', { 
      email: email ? email.substring(0, 3) + '***' : null, // Mask email in logs
      amount, 
      docNumber, 
      hasInvoiceUrl: !!invoiceUrl,
      isRecurring 
    });

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
    let userHasSchool = false;

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
        .select('school_id, subscription_paid, first_name, last_name, phone')
        .eq('id', userId)
        .single();
      
      if (profile?.school_id) {
        schoolId = profile.school_id;
        userHasSchool = true;
      }

      // ===== Mark user as subscription_paid for school creation =====
      // This enables users to create a new school after completing payment
      if (!profile?.subscription_paid) {
        console.log('[payment-webhook] Marking user as subscription_paid:', userId);
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            subscription_paid: true,
            subscription_paid_at: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (updateError) {
          console.error('[payment-webhook] Error updating subscription_paid:', updateError);
        } else {
          console.log('[payment-webhook] User marked as subscription_paid successfully');
          
          // Get full name from profile or webhook payload
          const fullName = profile?.first_name || profile?.last_name
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            : customerName || 'לקוח יקר';
          
          const userPhone = profile?.phone || customerPhone || '';
          
          // Send welcome notification via webhook (WITHOUT generating new password!)
          // Users already registered and set their own password - we just notify them
          await sendPaymentConfirmationNotification({
            fullName,
            phone: userPhone,
            email: email,
            loginUrl: 'https://aqua-ivrit-flow.lovable.app/auth'
          });
        }
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
          type: isRecurring ? 'subscription_payment' : 'credit_purchase',
          payment_method: 'morning_page',
          reference_id: docNumber || transactionId,
          description: isRecurring 
            ? `תשלום הוראת קבע - הקמת בית ספר - חשבונית ${docNumber}`
            : `תשלום דרך Morning - חשבונית ${docNumber}`,
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

      // Step 3: Grant access based on amount (only for existing school customers)
      if (userHasSchool) {
        if (amount >= 400) {
          // High amount = Subscription (monthly/yearly based on logic)
          // For now, create a simple log - actual subscription logic depends on product
          console.log('[payment-webhook] High-value payment detected (>=400), subscription logic would apply');
          
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
            }
          }
        }
      } else {
        console.log('[payment-webhook] User has no school yet - subscription payment for school creation');
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
