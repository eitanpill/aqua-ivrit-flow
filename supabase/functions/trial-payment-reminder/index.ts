import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUBSCRIPTION_PAYMENT_LINK = "https://mrng.to/3Q95CZQDbV";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const PLATFORM_WEBHOOK_URL = Deno.env.get('PLATFORM_WELCOME_WEBHOOK_URL');

    if (!PLATFORM_WEBHOOK_URL) {
      console.log('[trial-payment-reminder] No PLATFORM_WELCOME_WEBHOOK_URL configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook URL not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find schools created exactly 30 days ago (within a 24-hour window to avoid missing any)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);

    console.log(`[trial-payment-reminder] Checking schools created between ${thirtyOneDaysAgo.toISOString()} and ${thirtyDaysAgo.toISOString()}`);

    // Get schools created ~30 days ago whose owners haven't paid yet
    const { data: schools, error: schoolsError } = await supabase
      .from('schools')
      .select('id, name, owner_id, created_at')
      .gte('created_at', thirtyOneDaysAgo.toISOString())
      .lte('created_at', thirtyDaysAgo.toISOString());

    if (schoolsError) {
      console.error('[trial-payment-reminder] Error fetching schools:', schoolsError);
      throw schoolsError;
    }

    if (!schools || schools.length === 0) {
      console.log('[trial-payment-reminder] No schools found at 30-day mark');
      return new Response(
        JSON.stringify({ success: true, message: 'No schools at 30-day mark', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[trial-payment-reminder] Found ${schools.length} schools at 30-day mark`);

    let sentCount = 0;
    const errors: string[] = [];

    for (const school of schools) {
      try {
        if (!school.owner_id) {
          console.log(`[trial-payment-reminder] School ${school.id} has no owner, skipping`);
          continue;
        }

        // Check if owner has already paid
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone, subscription_paid')
          .eq('id', school.owner_id)
          .single();

        if (!profile) {
          console.log(`[trial-payment-reminder] Owner profile not found for school ${school.id}`);
          continue;
        }

        if (profile.subscription_paid) {
          console.log(`[trial-payment-reminder] Owner of ${school.name} already paid, skipping`);
          continue;
        }

        // Get owner email from auth
        const { data: authUser } = await supabase.auth.admin.getUserById(school.owner_id);
        const ownerEmail = authUser?.user?.email || '';

        const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'לקוח יקר';
        const phone = profile.phone || '';

        // Send webhook notification with payment link
        const payload = {
          event_type: 'trial_payment_reminder',
          timestamp: new Date().toISOString(),
          user: {
            full_name: fullName,
            phone: phone,
            email: ownerEmail,
          },
          school: {
            id: school.id,
            name: school.name,
            created_at: school.created_at,
          },
          payment_link: SUBSCRIPTION_PAYMENT_LINK,
          message: `שלום ${fullName}! 👋\n\nתודה שבחרת ב-AquaFlow לניהול בית הספר לשחייה "${school.name}"! 🏊‍♂️\n\nתקופת הניסיון החינמית שלך (30 יום) הסתיימה.\n\nכדי להמשיך להשתמש במערכת, יש להקים הוראת קבע חודשית:\n\n🔗 ${SUBSCRIPTION_PAYMENT_LINK}\n\nאם יש לך שאלות, אנחנו כאן בשבילך!\n\nצוות AquaFlow 💙`,
        };

        console.log(`[trial-payment-reminder] Sending reminder for school: ${school.name}`);

        const webhookResponse = await fetch(PLATFORM_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (webhookResponse.ok) {
          sentCount++;
          console.log(`[trial-payment-reminder] Sent reminder to ${fullName} for school ${school.name}`);
        } else {
          const errorText = await webhookResponse.text();
          errors.push(`Failed for ${school.name}: ${errorText}`);
          console.error(`[trial-payment-reminder] Webhook failed for ${school.name}:`, errorText);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Error for school ${school.id}: ${msg}`);
        console.error(`[trial-payment-reminder] Error processing school ${school.id}:`, error);
      }
    }

    console.log(`[trial-payment-reminder] Completed: ${sentCount}/${schools.length} sent`);

    return new Response(
      JSON.stringify({
        success: true,
        total_schools: schools.length,
        sent: sentCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[trial-payment-reminder] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
