import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Green Invoice (Morning) API base URLs
const GREENINVOICE_API_URL = 'https://api.greeninvoice.co.il/api/v1';
// For sandbox testing: 'https://sandbox.d.greeninvoice.co.il/api/v1'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with SERVICE_ROLE_KEY to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const { user_id, school_id, amount, product_id } = body;

    console.log("📥 Edge Function Received:", { amount, type: typeof amount, user_id, school_id, product_id });

    // STEP 0: Rigorous Amount Validation
    // 1. FORCE PARSE FLOAT - handle string, number, or any other type
    const finalAmount = parseFloat(String(amount));
    
    // 2. VALIDATION - must be a positive number
    if (isNaN(finalAmount) || finalAmount <= 0) {
      console.error("❌ Invalid Amount Detected:", { original: amount, parsed: finalAmount });
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `סכום לתשלום לא תקין: ${amount}`,
          details: { original: amount, parsed: finalAmount, type: typeof amount }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("✅ Amount validated:", finalAmount);

    // Validation: Check for required fields
    const missingFields: string[] = [];
    if (!user_id) missingFields.push('user_id');
    if (!school_id) missingFields.push('school_id');
    if (amount === undefined || amount === null) missingFields.push('amount');

    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'שדות חובה חסרים', 
          missing: missingFields 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 1: Fetch Payment Credentials from payment_configs table (including plugin_id)
    console.log('Fetching payment credentials for school:', school_id);
    
    const { data: paymentConfig, error: configError } = await supabase
      .from('payment_configs')
      .select('api_key, api_secret, plugin_id')
      .eq('school_id', school_id)
      .eq('is_active', true)
      .single();

    if (configError || !paymentConfig) {
      console.error('Payment config error:', configError);
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
      console.error('Missing API credentials');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'לא הוגדרו פרטי סליקה במערכת'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Payment credentials found, plugin_id:', plugin_id || 'NOT SET');

    // STEP 2A: Get Token from Green Invoice API
    console.log('Requesting token from Green Invoice API...');
    
    const tokenResponse = await fetch(`${GREENINVOICE_API_URL}/account/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: api_key,
        secret: api_secret,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok || !tokenData.token) {
      console.error('Green Invoice token error:', tokenData);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: tokenData.errorMessage || 'שגיאה בהתחברות לשירות הסליקה',
          errorCode: tokenData.errorCode,
          details: tokenData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const greenInvoiceToken = tokenData.token;
    console.log('Green Invoice token obtained successfully');

    // STEP 2B: Generate Payment Link using Payment Form endpoint
    console.log('Generating payment link...');

    // Determine app URL for redirects
    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://aqua-ivrit-flow.lovable.app';
    const functionsUrl = `${supabaseUrl}/functions/v1`;

    // Morning (GreenInvoice) "Get Payment Form" endpoint expects:
    // - amount in Shekels (NOT Agorot)
    // - pluginId is REQUIRED unless using Cardcom (per API docs)
    // Ref: https://www.greeninvoice.co.il/api-docs/#/reference/payments/get-payment-form
    const paymentRequestBody: Record<string, unknown> = {
      description: 'רכישה במערכת AquaFlow',
      type: 320, // Payment form type
      lang: 'he',
      currency: 'ILS',
      vatType: 0,
      amount: finalAmount, // Send raw number in Shekels (e.g., 150.5)
      maxPayments: 1,
      successUrl: `${siteUrl}/dashboard?payment=success`,
      failureUrl: `${siteUrl}/billing?payment=failed`,
      notifyUrl: `${functionsUrl}/payment-webhook`,
      client: {
        name: `משתמש ${user_id.substring(0, 8)}`,
        add: false,
      },
    };

    // Add pluginId if configured (REQUIRED for most providers except Cardcom)
    if (plugin_id) {
      paymentRequestBody.pluginId = plugin_id;
      console.log('Using configured pluginId:', plugin_id);
    } else {
      console.warn('⚠️ No pluginId configured - this may cause error 2600 if not using Cardcom');
    }

    console.log("📤 Sending to Morning:", JSON.stringify(paymentRequestBody));

    const paymentResponse = await fetch(`${GREENINVOICE_API_URL}/payments/form`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${greenInvoiceToken}`,
      },
      body: JSON.stringify(paymentRequestBody),
    });

    const paymentData = await paymentResponse.json();
    console.log('Payment response status:', paymentResponse.status, 'data:', JSON.stringify(paymentData));

    if (!paymentResponse.ok) {
      console.error('Green Invoice payment form error:', paymentData);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: paymentData.errorMessage || 'שגיאה ביצירת קישור תשלום',
          errorCode: paymentData.errorCode,
          details: paymentData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract payment URL from Green Invoice response
    const paymentUrl = paymentData.url;

    if (!paymentUrl) {
      console.error('No payment URL in response:', paymentData);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'לא התקבל קישור תשלום מהשרת',
          details: paymentData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Payment link generated successfully:', paymentUrl);

    // Return success with payment URL
    // NOTE: We do NOT create transaction/invoice yet - we wait for webhook callback
    return new Response(
      JSON.stringify({ 
        success: true,
        paymentUrl: paymentUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Return RAW error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, details: error }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
