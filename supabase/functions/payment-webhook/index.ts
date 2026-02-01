import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict CORS to known origins
const ALLOWED_ORIGIN = Deno.env.get('PUBLIC_SITE_URL') || 'https://aqua-ivrit-flow.lovable.app';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: stricter for webhooks
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30; // More restrictive for webhooks
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

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

// Input validation helpers
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // Basic email regex that covers most cases
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function isValidAmount(amount: unknown): number | null {
  const parsed = typeof amount === 'number' ? amount : parseFloat(String(amount || '0'));
  if (isNaN(parsed) || parsed < 0 || parsed > 1000000) return null;
  return parsed;
}

function sanitizeString(input: unknown, maxLength: number = 200): string {
  if (typeof input !== 'string') return '';
  // Remove potentially dangerous characters and trim
  return input.replace(/[<>'"&]/g, '').trim().substring(0, maxLength);
}

// Send payment confirmation notification via webhook
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
    },
    message: `שלום ${data.fullName}! 🎉\n\nהתשלום שלך התקבל בהצלחה!\n\nכעת תוכל/י להתחבר ולהקים את בית הספר שלך.\n\n📧 שם משתמש: ${data.email}\n🔑 הסיסמה שלך היא הסיסמה שיצרת בעת ההרשמה\n\n🔗 קישור להתחברות:\n${data.loginUrl}\n\n💡 שכחת את הסיסמה? לחץ על "שכחתי סיסמה" בעמוד ההתחברות\n\nבהצלחה!`
  };

  try {
    console.log('[payment-webhook] Sending payment confirmation notification');
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('[payment-webhook] Webhook failed:', response.status);
    } else {
      console.log('[payment-webhook] Payment confirmation sent successfully');
    }
  } catch (error) {
    console.error('[payment-webhook] Error sending webhook:', error);
  }
}

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
    // ===== SECURITY: Token-based authentication =====
    const url = new URL(req.url);
    const providedToken = url.searchParams.get('token');
    const expectedToken = Deno.env.get('PAYMENT_WEBHOOK_TOKEN');
    
    // Token validation - reject if token provided but invalid
    const hasValidToken = expectedToken && providedToken === expectedToken;
    
    if (providedToken && !hasValidToken) {
      console.warn('[payment-webhook] Invalid token provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Parse and validate the incoming payload
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      console.error('[payment-webhook] Invalid JSON payload');
      return new Response(
        JSON.stringify({ received: true, error: 'Invalid JSON' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[payment-webhook] Received webhook from IP:', clientIP);

    // ===== INPUT VALIDATION =====
    // Extract and validate email
    const rawEmail = 
      (payload.payer as Record<string, unknown>)?.email || 
      ((payload.recipient as Record<string, unknown>)?.emails as string[])?.[0] || 
      payload.email || 
      (payload.client as Record<string, unknown>)?.email || 
      payload.customerEmail;
    
    const email = typeof rawEmail === 'string' ? rawEmail.toLowerCase().trim() : null;
    
    if (!email || !isValidEmail(email)) {
      console.error('[payment-webhook] Invalid or missing email');
      return new Response(
        JSON.stringify({ received: true, processed: false, reason: 'invalid_email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and bound amount
    const amount = isValidAmount(payload.total || payload.amount || payload.sum);
    if (amount === null) {
      console.error('[payment-webhook] Invalid amount');
      return new Response(
        JSON.stringify({ received: true, processed: false, reason: 'invalid_amount' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize string fields
    const docNumber = sanitizeString(payload.number || payload.docNumber || payload.invoiceNumber, 100);
    const transactionId = sanitizeString(payload.id || payload.transactionId || payload.paymentId, 100);
    const customerName = sanitizeString(
      (payload.payer as Record<string, unknown>)?.name || 
      (payload.recipient as Record<string, unknown>)?.name, 
      200
    );
    const customerPhone = sanitizeString(
      (payload.payer as Record<string, unknown>)?.phone || 
      (payload.recipient as Record<string, unknown>)?.phone || 
      (payload.recipient as Record<string, unknown>)?.mobile,
      20
    );
    
    // Extract invoice URL (validate it's a proper URL)
    let invoiceUrl: string | null = null;
    const filesObj = payload.files as Record<string, unknown> | undefined;
    const downloadLinks = filesObj?.downloadLinks as Record<string, unknown> | undefined;
    const rawInvoiceUrl = 
      downloadLinks?.he || 
      downloadLinks?.origin ||
      payload.documentUrl;
    
    if (typeof rawInvoiceUrl === 'string' && rawInvoiceUrl.startsWith('https://')) {
      invoiceUrl = rawInvoiceUrl.substring(0, 500);
    }

    const isRecurring = payload.type === 'recurring' || 
                        payload.paymentType === 'recurring' ||
                        payload.isRecurring === true ||
                        payload.docType === 320;

    console.log('[payment-webhook] Validated data:', { 
      emailMasked: email.substring(0, 3) + '***',
      amount, 
      docNumber: docNumber.substring(0, 10) + '...', 
      hasInvoiceUrl: !!invoiceUrl,
      isRecurring 
    });

    // ===== IDEMPOTENCY CHECK =====
    // Check if this transaction was already processed
    const referenceId = docNumber || transactionId;
    if (referenceId) {
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('reference_id', referenceId)
        .single();
      
      if (existingTx) {
        console.log('[payment-webhook] Transaction already processed:', referenceId);
        return new Response(
          JSON.stringify({ received: true, processed: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Find user by email
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    let userId: string | null = null;
    let schoolId: string | null = null;
    let userHasSchool = false;

    if (!authError && authUsers?.users) {
      const foundUser = authUsers.users.find(u => u.email?.toLowerCase() === email);
      if (foundUser) {
        userId = foundUser.id;
        console.log('[payment-webhook] Found user');
      }
    }

    if (!userId) {
      console.log('[payment-webhook] User not found for email');
      return new Response(
        JSON.stringify({ received: true, processed: false, reason: 'user_not_found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get school_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id, subscription_paid, first_name, last_name, phone')
      .eq('id', userId)
      .single();
    
    if (profile?.school_id) {
      schoolId = profile.school_id;
      userHasSchool = true;
    }

    // Mark user as subscription_paid for school creation
    if (!profile?.subscription_paid) {
      console.log('[payment-webhook] Marking user as subscription_paid');
      
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
        const fullName = profile?.first_name || profile?.last_name
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : customerName || 'לקוח יקר';
        
        const userPhone = profile?.phone || customerPhone || '';
        
        await sendPaymentConfirmationNotification({
          fullName,
          phone: userPhone,
          email: email,
          loginUrl: 'https://aqua-ivrit-flow.lovable.app/dashboard'
        });
      }
    }

    // Insert transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        school_id: schoolId,
        amount: amount,
        status: 'completed',
        type: isRecurring ? 'subscription_payment' : 'credit_purchase',
        payment_method: 'morning_page',
        reference_id: referenceId || null,
        description: isRecurring 
          ? `תשלום הוראת קבע - הקמת בית ספר - חשבונית ${docNumber}`
          : `תשלום דרך Morning - חשבונית ${docNumber}`,
      })
      .select()
      .single();

    if (txError) {
      console.error('[payment-webhook] Transaction insert error:', txError);
    } else {
      console.log('[payment-webhook] Transaction created');
      
      // Create invoice record with the Morning download link
      if (invoiceUrl && transaction?.id) {
        const { error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            user_id: userId,
            school_id: schoolId,
            transaction_id: transaction.id,
            invoice_number: docNumber || `M-${transactionId.substring(0, 8)}`,
            amount: amount,
            url: invoiceUrl,
            issued_at: new Date().toISOString(),
          });
        
        if (invoiceError) {
          console.error('[payment-webhook] Invoice insert error:', invoiceError);
        }
      }
    }

    // Grant access based on amount (only for existing school customers)
    if (userHasSchool && amount > 0 && amount < 400) {
      console.log('[payment-webhook] Adding credits to wallet');
      
      const creditsToAdd = 1;

      const { data: existingWallet } = await supabase
        .from('customer_wallets')
        .select('id, credits_balance')
        .eq('user_id', userId)
        .single();

      if (existingWallet) {
        const newBalance = (existingWallet.credits_balance || 0) + creditsToAdd;
        await supabase
          .from('customer_wallets')
          .update({ 
            credits_balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingWallet.id);
      } else {
        await supabase
          .from('customer_wallets')
          .insert({
            user_id: userId,
            credits_balance: creditsToAdd,
          });
      }
    }

    return new Response(
      JSON.stringify({ received: true, processed: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[payment-webhook] Unexpected error:', error);
    
    return new Response(
      JSON.stringify({ received: true, error: 'Internal processing error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
