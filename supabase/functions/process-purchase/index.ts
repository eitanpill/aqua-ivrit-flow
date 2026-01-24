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

  try {
    // Initialize Supabase client with SERVICE_ROLE_KEY to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const { user_id, school_id, amount, product_id } = body;

    console.log('Received purchase request:', { user_id, school_id, amount, product_id });

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

    // STEP 1: Fetch Payment Credentials from payment_configs table
    console.log('Fetching payment credentials for school:', school_id);
    
    const { data: paymentConfig, error: configError } = await supabase
      .from('payment_configs')
      .select('api_key, api_secret')
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

    const { api_key, api_secret } = paymentConfig;

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

    console.log('Payment credentials found, proceeding to Morning API...');

    // STEP 2A: Get Token from Morning API
    console.log('Requesting token from Morning API...');
    
    const tokenResponse = await fetch('https://api.morning.co/v2/users/token', {
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

    if (!tokenResponse.ok || !tokenData.token) {
      console.error('Morning token error:', tokenData);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'שגיאה בהתחברות לשירות הסליקה',
          details: tokenData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const morningToken = tokenData.token;
    console.log('Morning token obtained successfully');

    // STEP 2B: Generate Payment Link
    console.log('Generating payment link...');

    // Determine app URL for redirects
    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://aqua-ivrit-flow.lovable.app';
    const functionsUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');

    const paymentRequestBody = {
      description: 'רכישה במערכת AquaFlow',
      amount: Number(amount),
      currency: 'ILS',
      maxPayments: 1,
      successUrl: `${siteUrl}/dashboard?payment=success`,
      failureUrl: `${siteUrl}/billing?payment=failed`,
      client: {
        name: `User ${user_id}`,
      },
      notifyUrl: `${functionsUrl}/v1/payment-webhook`,
    };

    console.log('Payment request body:', JSON.stringify(paymentRequestBody));

    const paymentResponse = await fetch('https://api.morning.co/v2/clearing/general/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${morningToken}`,
      },
      body: JSON.stringify(paymentRequestBody),
    });

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error('Morning payment link error:', paymentData);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'שגיאה ביצירת קישור תשלום',
          details: paymentData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract payment URL from Morning response
    const paymentUrl = paymentData.url || paymentData.paymentUrl || paymentData.data?.url;

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
