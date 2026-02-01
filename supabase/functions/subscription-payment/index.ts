import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict CORS to known origins
const ALLOWED_ORIGIN = Deno.env.get('PUBLIC_SITE_URL') || 'https://aqua-ivrit-flow.lovable.app';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // 20 requests per minute per IP
const RATE_LIMIT_WINDOW = 60 * 1000;

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
function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return 'לקוח חדש';
  // Remove potentially dangerous characters and limit length
  return name.replace(/[<>'"&\n\r]/g, '').trim().substring(0, 200) || 'לקוח חדש';
}

// Green Invoice (Morning) API base URLs
const GREENINVOICE_API_URL = 'https://api.greeninvoice.co.il/api/v1';

// Platform payment credentials
const PLATFORM_API_KEY = Deno.env.get('PLATFORM_MORNING_API_KEY');
const PLATFORM_API_SECRET = Deno.env.get('PLATFORM_MORNING_API_SECRET');
const PLATFORM_PLUGIN_ID = Deno.env.get('PLATFORM_MORNING_PLUGIN_ID');

// Subscription price in NIS
const SUBSCRIPTION_PRICE = 149;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    if (!checkRateLimit(clientIP)) {
      console.warn('[subscription-payment] Rate limit exceeded for IP:', clientIP);
      return new Response(
        JSON.stringify({ success: false, error: 'יותר מדי בקשות. נסה שוב בעוד דקה.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, user_email, user_name } = body;

    // Validate user_id (required, must be UUID)
    if (!user_id || !isValidUUID(user_id as string)) {
      console.error('[subscription-payment] Invalid or missing user_id');
      return new Response(
        JSON.stringify({ success: false, error: 'מזהה משתמש לא תקין' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email if provided
    const validatedEmail = user_email && isValidEmail(user_email as string) 
      ? (user_email as string).toLowerCase().trim() 
      : undefined;

    // Sanitize name
    const validatedName = sanitizeName(user_name);

    console.log("[subscription-payment] Processing request for validated user");

    // Verify user exists in database
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user_id)
      .single();

    if (profileError || !userProfile) {
      console.error('[subscription-payment] User not found:', user_id);
      return new Response(
        JSON.stringify({ success: false, error: 'משתמש לא נמצא' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if platform payment credentials are configured
    if (!PLATFORM_API_KEY || !PLATFORM_API_SECRET) {
      console.log("[subscription-payment] Platform credentials not configured, using fallback");
      
      const fallbackUrl = "https://mrng.to/3Q95CZQDbV";
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          paymentUrl: fallbackUrl,
          isFallback: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Token from Green Invoice API
    console.log('[subscription-payment] Requesting token...');
    
    const tokenResponse = await fetch(`${GREENINVOICE_API_URL}/account/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: PLATFORM_API_KEY,
        secret: PLATFORM_API_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.token) {
      console.error('[subscription-payment] Token error');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'שגיאה בהתחברות לשירות הסליקה'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const greenInvoiceToken = tokenData.token;

    // Generate Payment Link
    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://aqua-ivrit-flow.lovable.app';
    const functionsUrl = `${supabaseUrl}/functions/v1`;

    const paymentRequestBody: Record<string, unknown> = {
      description: 'מנוי AquaFlow - הקמת בית ספר לשחייה',
      type: 320,
      lang: 'he',
      currency: 'ILS',
      vatType: 0,
      amount: SUBSCRIPTION_PRICE,
      maxPayments: 1,
      successUrl: `${siteUrl}/auth/setup-school?payment=success`,
      failureUrl: `${siteUrl}/auth/subscription?payment=failed`,
      notifyUrl: `${functionsUrl}/payment-webhook`,
      client: {
        name: validatedName,
        email: validatedEmail,
        add: false,
      },
    };

    if (PLATFORM_PLUGIN_ID) {
      paymentRequestBody.pluginId = PLATFORM_PLUGIN_ID;
    }

    console.log("[subscription-payment] Generating payment link...");

    const paymentResponse = await fetch(`${GREENINVOICE_API_URL}/payments/form`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${greenInvoiceToken}`,
      },
      body: JSON.stringify(paymentRequestBody),
    });

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('[subscription-payment] Payment form error');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'שגיאה ביצירת קישור תשלום'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentUrl = paymentData.url;

    if (!paymentUrl) {
      console.error('[subscription-payment] No payment URL in response');
      return new Response(
        JSON.stringify({ success: false, error: 'לא התקבל קישור תשלום' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[subscription-payment] Payment link generated successfully');

    return new Response(
      JSON.stringify({ success: true, paymentUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[subscription-payment] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'שגיאה בלתי צפויה' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
