import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  event_type: string;
  data: {
    parent_name?: string;
    parent_phone?: string;
    child_name?: string;
    class_time?: string;
    coach_name?: string;
    class_type?: string;
    location?: string;
    [key: string]: unknown;
  };
  school_id: string;
  is_test?: boolean;
}

interface WebhookPayload {
  event: string;
  school_id: string;
  recipient: {
    name: string;
    phone: string;
  };
  message_content: string;
  raw_data: Record<string, unknown>;
  timestamp: string;
  is_test: boolean;
}

// Event type to Hebrew description mapping
const eventTypeDescriptions: Record<string, string> = {
  class_cancelled: "ביטול שיעור",
  new_registration: "רישום חדש",
  waitlist_spot_available: "מקום התפנה מרשימת המתנה",
  session_reminder: "תזכורת לשיעור",
  makeup_class_available: "שיעור השלמה זמין",
  payment_due: "תזכורת תשלום",
  test_notification: "הודעת בדיקה",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials not configured");
      throw new Error("Database service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { event_type, data, school_id, is_test = false }: NotificationRequest = await req.json();

    console.log(`[dispatch-notification] Processing event: ${event_type} for school: ${school_id}`);
    console.log(`[dispatch-notification] Data:`, JSON.stringify(data));

    // Step 1: Fetch school data including webhook URL
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("id, name, notification_webhook_url")
      .eq("id", school_id)
      .single();

    if (schoolError || !school) {
      console.error("[dispatch-notification] School not found:", schoolError);
      throw new Error("בית הספר לא נמצא");
    }

    if (!school.notification_webhook_url) {
      console.log("[dispatch-notification] No webhook URL configured for school");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "לא הוגדר כתובת וובהוק לבית הספר" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Step 2: Generate AI message
    const eventDescription = eventTypeDescriptions[event_type] || event_type;
    
    const contextParts: string[] = [];
    if (data.parent_name) contextParts.push(`שם ההורה: ${data.parent_name}`);
    if (data.child_name) contextParts.push(`שם הילד/ה: ${data.child_name}`);
    if (data.class_time) contextParts.push(`שעת השיעור: ${data.class_time}`);
    if (data.coach_name) contextParts.push(`שם המאמן: ${data.coach_name}`);
    if (data.class_type) contextParts.push(`סוג השיעור: ${data.class_type}`);
    if (data.location) contextParts.push(`מיקום: ${data.location}`);

    const contextString = contextParts.length > 0 
      ? contextParts.join("\n") 
      : "אין מידע נוסף";

    const systemPrompt = `אתה עוזר וירטואלי של בית ספר לשחייה "${school.name}". 
תפקידך לכתוב הודעות וואטסאפ קצרות, חמות ומקצועיות בעברית.
- השתמש בשפה ידידותית אך מקצועית
- הודעות צריכות להיות קצרות וברורות
- אל תוסיף אמוג'י יותר מאחד או שניים
- אל תוסיף חתימה ארוכה, רק שם בית הספר`;

    const userPrompt = `כתוב הודעת וואטסאפ קצרה עבור האירוע: ${eventDescription}

פרטים:
${contextString}

${is_test ? "זוהי הודעת בדיקה - ציין זאת בהודעה." : ""}`;

    console.log("[dispatch-notification] Calling AI for message generation...");

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
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[dispatch-notification] AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("מגבלת קריאות API הושגה, נסה שוב מאוחר יותר");
      }
      if (aiResponse.status === 402) {
        throw new Error("נדרש תשלום עבור שירות ה-AI");
      }
      throw new Error("שגיאה ביצירת ההודעה");
    }

    const aiData = await aiResponse.json();
    const generatedMessage = aiData.choices?.[0]?.message?.content?.trim() || "לא ניתן היה ליצור הודעה";

    console.log("[dispatch-notification] Generated message:", generatedMessage);

    // Step 3: Prepare and send webhook payload
    const webhookPayload: WebhookPayload = {
      event: event_type,
      school_id: school_id,
      recipient: {
        name: data.parent_name || "לא ידוע",
        phone: data.parent_phone || "",
      },
      message_content: generatedMessage,
      raw_data: data,
      timestamp: new Date().toISOString(),
      is_test: is_test,
    };

    console.log("[dispatch-notification] Sending webhook to:", school.notification_webhook_url);

    const webhookResponse = await fetch(school.notification_webhook_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload),
    });

    const webhookStatus = webhookResponse.status;
    let webhookResponseText = "";
    try {
      webhookResponseText = await webhookResponse.text();
    } catch {
      webhookResponseText = "No response body";
    }

    console.log(`[dispatch-notification] Webhook response: ${webhookStatus}`, webhookResponseText);

    if (!webhookResponse.ok) {
      console.error("[dispatch-notification] Webhook failed:", webhookStatus, webhookResponseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `שגיאה בשליחת הוובהוק: ${webhookStatus}`,
          generated_message: generatedMessage,
          webhook_response: webhookResponseText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated_message: generatedMessage,
        webhook_status: webhookStatus,
        payload_sent: webhookPayload,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[dispatch-notification] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "שגיאה לא ידועה" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
