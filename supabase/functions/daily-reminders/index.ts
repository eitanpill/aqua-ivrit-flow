import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SessionWithEnrollments {
  session_id: string;
  school_id: string;
  class_type_name: string;
  start_time: string;
  location_name: string;
  resource_name: string;
  coach_name: string;
  enrollments: Array<{
    swimmer_name: string;
    parent_name: string;
    parent_phone: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Database service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get today's date range (Israel timezone = UTC+2/+3)
    const now = new Date();
    const israelOffset = 3 * 60 * 60 * 1000; // +3 hours for Israel
    const israelNow = new Date(now.getTime() + israelOffset);
    
    // Get start of today (00:00) and end of today (23:59) in Israel time
    const todayStart = new Date(israelNow);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStartUTC = new Date(todayStart.getTime() - israelOffset);
    
    const todayEnd = new Date(israelNow);
    todayEnd.setUTCHours(23, 59, 59, 999);
    const todayEndUTC = new Date(todayEnd.getTime() - israelOffset);

    console.log(`[daily-reminders] Processing reminders for today: ${todayStartUTC.toISOString()} - ${todayEndUTC.toISOString()}`);

    // Step 1: Fetch all sessions today with their enrollments
    const { data: sessions, error: sessionsError } = await supabase
      .from("sessions")
      .select(`
        id,
        school_id,
        start_time,
        end_time,
        class_type:class_types(name),
        coach:profiles!sessions_coach_id_fkey(first_name, last_name),
        resource:resources(name, location:locations(name))
      `)
      .gte("start_time", todayStartUTC.toISOString())
      .lte("start_time", todayEndUTC.toISOString())
      .eq("status", "scheduled")
      .eq("is_cancelled", false);

    if (sessionsError) {
      console.error("[daily-reminders] Error fetching sessions:", sessionsError);
      throw sessionsError;
    }

    if (!sessions || sessions.length === 0) {
      console.log("[daily-reminders] No sessions found for today");
      return new Response(
        JSON.stringify({ success: true, message: "No sessions for today", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[daily-reminders] Found ${sessions.length} sessions for today`);

    // Step 2: For each session, get enrollments with parent info
    const sessionIds = sessions.map((s: any) => s.id);
    
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from("enrollments")
      .select(`
        id,
        session_id,
        swimmer:swimmers(
          first_name,
          last_name,
          parent:profiles!swimmers_parent_id_fkey(first_name, last_name, phone)
        )
      `)
      .in("session_id", sessionIds)
      .eq("status", "active");

    if (enrollmentsError) {
      console.error("[daily-reminders] Error fetching enrollments:", enrollmentsError);
      throw enrollmentsError;
    }

    // Step 3: Fetch schools with webhook URLs configured
    const schoolIds = [...new Set(sessions.map((s: any) => s.school_id))];
    
    const { data: schools, error: schoolsError } = await supabase
      .from("schools")
      .select("id, name, notification_webhook_url")
      .in("id", schoolIds)
      .not("notification_webhook_url", "is", null);

    if (schoolsError) {
      console.error("[daily-reminders] Error fetching schools:", schoolsError);
      throw schoolsError;
    }

    const schoolWebhooks: Record<string, { name: string; webhookUrl: string }> = {};
    for (const school of schools || []) {
      if (school.notification_webhook_url) {
        schoolWebhooks[school.id] = {
          name: school.name,
          webhookUrl: school.notification_webhook_url,
        };
      }
    }

    // Step 4: Build notifications to send
    const notifications: Array<{
      parentName: string;
      parentPhone: string;
      swimmerName: string;
      sessionTime: string;
      locationName: string;
      coachName: string;
      className: string;
      schoolId: string;
      webhookUrl: string;
      schoolName: string;
    }> = [];

    for (const session of sessions as any[]) {
      const schoolInfo = schoolWebhooks[session.school_id];
      if (!schoolInfo) {
        console.log(`[daily-reminders] Skipping session ${session.id} - no webhook configured for school`);
        continue;
      }

      const sessionEnrollments = (enrollments || []).filter((e: any) => e.session_id === session.id);
      
      for (const enrollment of sessionEnrollments as any[]) {
        const swimmer = enrollment.swimmer;
        const parent = swimmer?.parent;
        
        if (!parent?.phone) {
          console.log(`[daily-reminders] Skipping enrollment ${enrollment.id} - no parent phone`);
          continue;
        }

        const sessionDate = new Date(session.start_time);
        const hours = sessionDate.getUTCHours() + 3; // Israel offset
        const minutes = sessionDate.getUTCMinutes();
        const timeStr = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

        notifications.push({
          parentName: `${parent.first_name || ""} ${parent.last_name || ""}`.trim(),
          parentPhone: parent.phone,
          swimmerName: `${swimmer.first_name || ""} ${swimmer.last_name || ""}`.trim(),
          sessionTime: timeStr,
          locationName: session.resource?.location?.name || session.resource?.name || "הבריכה",
          coachName: session.coach ? `${session.coach.first_name || ""} ${session.coach.last_name || ""}`.trim() : "המאמן",
          className: session.class_type?.name || "שיעור שחייה",
          schoolId: session.school_id,
          webhookUrl: schoolInfo.webhookUrl,
          schoolName: schoolInfo.name,
        });
      }
    }

    console.log(`[daily-reminders] Sending ${notifications.length} reminder notifications`);

    // Step 5: Send notifications via dispatch-notification function
    let sentCount = 0;
    const errors: string[] = [];

    for (const notification of notifications) {
      try {
        // Generate AI message using Lovable API
        const systemPrompt = `אתה עוזר וירטואלי של בית ספר לשחייה "${notification.schoolName}".
תפקידך לכתוב הודעות וואטסאפ קצרות, חמות ומקצועיות בעברית.
- השתמש בשפה ידידותית אך מקצועית
- הודעות צריכות להיות קצרות וברורות
- אל תוסיף אמוג'י יותר מאחד או שניים
- אל תוסיף חתימה ארוכה, רק שם בית הספר`;

        const userPrompt = `כתוב הודעת תזכורת קצרה לשיעור שחייה היום:
שם ההורה: ${notification.parentName}
שם הילד/ה: ${notification.swimmerName}
שעת השיעור: ${notification.sessionTime}
מאמן/ת: ${notification.coachName}
מיקום: ${notification.locationName}
סוג השיעור: ${notification.className}`;

        let generatedMessage = `🏊‍♂️ תזכורת לשיעור היום!
שלום ${notification.parentName},
לא לשכוח - היום יש שיעור ל${notification.swimmerName}!
⏰ שעה: ${notification.sessionTime}
📍 מיקום: ${notification.locationName}
👨‍🏫 מאמן/ת: ${notification.coachName}
נתראה בבריכה! 💙`;

        // Try to generate AI message if LOVABLE_API_KEY is available
        if (LOVABLE_API_KEY) {
          try {
            const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
                max_tokens: 200,
                temperature: 0.7,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              generatedMessage = aiData.choices?.[0]?.message?.content?.trim() || generatedMessage;
            }
          } catch (aiError) {
            console.warn("[daily-reminders] AI generation failed, using fallback template:", aiError);
          }
        }

        // Send to webhook
        const webhookPayload = {
          event: "daily_reminder",
          school_id: notification.schoolId,
          recipient: {
            name: notification.parentName,
            phone: notification.parentPhone,
          },
          message_content: generatedMessage,
          raw_data: {
            swimmer_name: notification.swimmerName,
            session_time: notification.sessionTime,
            location: notification.locationName,
            coach_name: notification.coachName,
            class_type: notification.className,
          },
          timestamp: new Date().toISOString(),
          is_test: false,
        };

        const webhookResponse = await fetch(notification.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });

        if (webhookResponse.ok) {
          sentCount++;
          console.log(`[daily-reminders] Sent reminder to ${notification.parentName} for ${notification.swimmerName}`);
        } else {
          const errorText = await webhookResponse.text();
          errors.push(`Failed for ${notification.swimmerName}: ${errorText}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Error for ${notification.swimmerName}: ${errorMsg}`);
        console.error(`[daily-reminders] Error sending notification:`, error);
      }
    }

    console.log(`[daily-reminders] Completed: ${sentCount}/${notifications.length} sent`);

    return new Response(
      JSON.stringify({
        success: true,
        total_sessions: sessions.length,
        total_notifications: notifications.length,
        sent: sentCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[daily-reminders] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
