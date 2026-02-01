import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict CORS to known origins
const ALLOWED_ORIGIN = Deno.env.get('PUBLIC_SITE_URL') || 'https://aqua-ivrit-flow.lovable.app';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP
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
function isValidUUID(id: unknown): boolean {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function isValidAmount(amount: unknown): number | null {
  const parsed = typeof amount === 'number' ? amount : parseFloat(String(amount));
  // Amount must be positive and within reasonable bounds (1 to 100,000 NIS)
  if (isNaN(parsed) || parsed <= 0 || parsed > 100000) return null;
  return parsed;
}

// Green Invoice (Morning) API base URLs
const GREENINVOICE_API_URL = 'https://api.greeninvoice.co.il/api/v1';

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
      console.warn('[process-purchase] Rate limit exceeded for IP:', clientIP);
      return new Response(
        JSON.stringify({ success: false, error: 'יותר מדי בקשות. נסה שוב בעוד דקה.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with SERVICE_ROLE_KEY to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { user_id, school_id, amount, product_id } = body;

    // ===== INPUT VALIDATION =====
    
    // Validate user_id (required, must be UUID)
    if (!isValidUUID(user_id)) {
      console.error('[process-purchase] Invalid user_id');
      return new Response(
        JSON.stringify({ success: false, error: 'מזהה משתמש לא תקין' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate school_id (required, must be UUID)
    if (!isValidUUID(school_id)) {
      console.error('[process-purchase] Invalid school_id');
      return new Response(
        JSON.stringify({ success: false, error: 'מזהה בית ספר לא תקין' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount (required, must be positive number within bounds)
    const validatedAmount = isValidAmount(amount);
    if (validatedAmount === null) {
      console.error('[process-purchase] Invalid amount');
      return new Response(
        JSON.stringify({ success: false, error: 'סכום לתשלום לא תקין' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate product_id if provided (optional, must be UUID)
    if (product_id !== undefined && product_id !== null && !isValidUUID(product_id)) {
      console.error('[process-purchase] Invalid product_id');
      return new Response(
        JSON.stringify({ success: false, error: 'מזהה מוצר לא תקין' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("[process-purchase] Validated request");

    // Verify user exists and belongs to school
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, school_id')
      .eq('id', user_id)
      .single();

    if (profileError || !userProfile) {
      console.error('[process-purchase] User not found');
      return new Response(
        JSON.stringify({ success: false, error: 'משתמש לא נמצא' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify school exists
    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('id', school_id)
      .single();

    if (schoolError || !schoolData) {
      console.error('[process-purchase] School not found');
      return new Response(
        JSON.stringify({ success: false, error: 'בית ספר לא נמצא' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Payment Credentials from payment_configs table
    const { data: paymentConfig, error: configError } = await supabase
      .from('payment_configs')
      .select('api_key, api_secret, plugin_id')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    if (configError || !paymentConfig) {
      console.error('[process-purchase] Payment config error');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'לא הוגדרו פרטי סליקה במערכת'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { api_key, api_secret, plugin_id } = paymentConfig;

    if (!api_key || !api_secret) {
      console.error('[process-purchase] Missing API credentials');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'לא הוגדרו פרטי סליקה במערכת'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Token from Green Invoice API
    console.log('[process-purchase] Requesting token...');
    
    const tokenResponse = await fetch(`${GREENINVOICE_API_URL}/account/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: api_key,
        secret: api_secret,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.token) {
      console.error('[process-purchase] Token error');
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
      description: 'רכישה במערכת AquaFlow',
      type: 320,
      lang: 'he',
      currency: 'ILS',
      vatType: 0,
      amount: validatedAmount,
      maxPayments: 1,
      successUrl: `${siteUrl}/dashboard?payment=success`,
      failureUrl: `${siteUrl}/billing?payment=failed`,
      notifyUrl: `${functionsUrl}/payment-webhook`,
      client: {
        name: `משתמש ${(user_id as string).substring(0, 8)}`,
        add: false,
      },
    };

    if (plugin_id) {
      paymentRequestBody.pluginId = plugin_id;
    }

    console.log("[process-purchase] Generating payment link...");

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
      console.error('[process-purchase] Payment form error');
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
      console.error('[process-purchase] No payment URL in response');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'לא התקבל קישור תשלום מהשרת'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-purchase] Payment link generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        paymentUrl: paymentUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-purchase] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'שגיאה בלתי צפויה' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
