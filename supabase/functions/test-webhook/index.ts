const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { fullName, phone, email, message } = body;

    const webhookUrl = Deno.env.get('PLATFORM_WELCOME_WEBHOOK_URL');
    
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: 'PLATFORM_WELCOME_WEBHOOK_URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = {
      event_type: 'test_notification',
      timestamp: new Date().toISOString(),
      user: {
        full_name: fullName,
        phone: phone,
        email: email,
      },
      credentials: {
        login_url: 'https://aqua-ivrit-flow.lovable.app/auth',
        username: email,
        temporary_password: 'TestPass123',
      },
      message: message || `שלום ${fullName}! 🎉\n\nזוהי הודעת בדיקה מ-AquaManager.\n\n📧 שם משתמש: ${email}\n🔑 סיסמה: TestPass123\n\n🔗 קישור להתחברות:\nhttps://aqua-ivrit-flow.lovable.app/auth`
    };

    console.log('[test-webhook] Sending test to:', webhookUrl);
    console.log('[test-webhook] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[test-webhook] Response status:', response.status);
    console.log('[test-webhook] Response body:', responseText);

    return new Response(
      JSON.stringify({ 
        success: response.ok,
        status: response.status,
        response: responseText,
        sentPayload: payload
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[test-webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
