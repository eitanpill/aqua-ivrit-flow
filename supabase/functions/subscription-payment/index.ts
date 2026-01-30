import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Green Invoice (Morning) API base URLs
const GREENINVOICE_API_URL = 'https://api.greeninvoice.co.il/api/v1';

// Platform payment credentials (for subscription payments)
// These should be stored as secrets
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const { user_id, user_email, user_name } = body;

    console.log("[subscription-payment] Received request for user:", user_id);

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'חסר מזהה משתמש' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if platform payment credentials are configured
    if (!PLATFORM_API_KEY || !PLATFORM_API_SECRET) {
      console.error("[subscription-payment] Platform payment credentials not configured");
      
      // Fallback: Return the static payment link
      const fallbackUrl = "https://mrng.to/3Q95CZQDbV";
      console.log("[subscription-payment] Using fallback static link");
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          paymentUrl: fallbackUrl,
          isFallback: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 1: Get Token from Green Invoice API
    console.log('[subscription-payment] Requesting token from Green Invoice API...');
    
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
      console.error('[subscription-payment] Green Invoice token error:', tokenData);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'שגיאה בהתחברות לשירות הסליקה',
          details: tokenData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const greenInvoiceToken = tokenData.token;
    console.log('[subscription-payment] Token obtained successfully');

    // STEP 2: Generate Payment Link with proper redirect URLs
    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://aqua-ivrit-flow.lovable.app';
    const functionsUrl = `${supabaseUrl}/functions/v1`;

    const paymentRequestBody: Record<string, unknown> = {
      description: 'מנוי AquaFlow - הקמת בית ספר לשחייה',
      type: 320, // Payment form type
      lang: 'he',
      currency: 'ILS',
      vatType: 0,
      amount: SUBSCRIPTION_PRICE,
      maxPayments: 1,
      // CRITICAL: Redirect URLs that bring user back to the app
      successUrl: `${siteUrl}/auth/setup-school?payment=success`,
      failureUrl: `${siteUrl}/auth/subscription?payment=failed`,
      notifyUrl: `${functionsUrl}/payment-webhook`,
      client: {
        name: user_name || 'לקוח חדש',
        email: user_email,
        add: false,
      },
    };

    // Add pluginId if configured
    if (PLATFORM_PLUGIN_ID) {
      paymentRequestBody.pluginId = PLATFORM_PLUGIN_ID;
      console.log('[subscription-payment] Using configured pluginId');
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
    console.log('[subscription-payment] Response status:', paymentResponse.status);

    if (!paymentResponse.ok) {
      console.error('[subscription-payment] Payment form error:', paymentData);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: paymentData.errorMessage || 'שגיאה ביצירת קישור תשלום',
          details: paymentData
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[subscription-payment] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
