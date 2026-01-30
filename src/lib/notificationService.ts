/**
 * Notification Service - שירות התראות
 * Hebrew notification templates for SMS/WhatsApp/Email
 * Integrated with AI-powered webhook dispatcher
 */

import { supabase } from "@/integrations/supabase/client";

export interface NotificationParams {
  name: string;
  swimmerName?: string;
  sessionDate?: string;
  sessionTime?: string;
  locationName?: string;
  coachName?: string;
  className?: string;
  tokenCount?: number;
  position?: number;
  reason?: string;
  phone?: string;
}

export type NotificationType =
  | 'session_reminder'
  | 'session_cancelled'
  | 'waitlist_spot_available'
  | 'enrollment_confirmed'
  | 'cancellation_confirmed'
  | 'makeup_token_issued'
  | 'payment_received'
  | 'payment_reminder'
  | 'welcome'
  | 'coach_substituted'
  | 'session_time_changed'
  | 'daily_reminder';

// Map notification types to webhook event types
const NOTIFICATION_TO_EVENT_TYPE: Record<NotificationType, string> = {
  session_reminder: 'session_reminder',
  session_cancelled: 'class_cancelled',
  waitlist_spot_available: 'waitlist_spot_available',
  enrollment_confirmed: 'new_registration',
  cancellation_confirmed: 'class_cancelled',
  makeup_token_issued: 'makeup_class_available',
  payment_received: 'payment_due',
  payment_reminder: 'payment_due',
  welcome: 'new_registration',
  coach_substituted: 'coach_substituted',
  session_time_changed: 'session_time_changed',
  daily_reminder: 'daily_reminder',
};

// Hebrew notification templates (fallback if AI is not available)
const NOTIFICATION_TEMPLATES: Record<NotificationType, (params: NotificationParams) => string> = {
  session_reminder: (params) =>
    `שלום ${params.name}! 🏊‍♂️\n` +
    `תזכורת: לשיעור של ${params.swimmerName || 'הילד/ה'} מחר בשעה ${params.sessionTime}.\n` +
    `📍 מיקום: ${params.locationName}\n` +
    `נתראה בבריכה! 💙`,

  session_cancelled: (params) =>
    `היי ${params.name},\n` +
    `השיעור בוטל ${params.reason ? `עקב ${params.reason}` : ''}.\n` +
    `📅 תאריך: ${params.sessionDate}\n` +
    `⏰ שעה: ${params.sessionTime}\n` +
    `ניתן לתאם שיעור חלופי דרך האפליקציה.\n` +
    `מצטערים על אי-הנוחות 🙏`,

  waitlist_spot_available: (params) =>
    `🎉 התפנה מקום!\n` +
    `שלום ${params.name},\n` +
    `התפנה מקום בשיעור ${params.className} בתאריך ${params.sessionDate}.\n` +
    `לחץ/י כאן להירשם לפני שיתמלא! ⏰\n` +
    `המקום שמור לך ל-2 שעות הקרובות.`,

  enrollment_confirmed: (params) =>
    `✅ ההרשמה אושרה!\n` +
    `שלום ${params.name},\n` +
    `${params.swimmerName} נרשם/ה בהצלחה לשיעור ${params.className}.\n` +
    `📅 ${params.sessionDate}\n` +
    `⏰ ${params.sessionTime}\n` +
    `📍 ${params.locationName}\n` +
    `נתראה! 💙`,

  cancellation_confirmed: (params) =>
    `ההרשמה בוטלה\n` +
    `שלום ${params.name},\n` +
    `ביטלנו את ההרשמה של ${params.swimmerName} לשיעור בתאריך ${params.sessionDate}.\n` +
    `${params.tokenCount ? `קיבלת ${params.tokenCount} אסימון/י השלמה.` : ''}\n` +
    `תודה על העדכון! 🙏`,

  makeup_token_issued: (params) =>
    `🎫 קיבלת אסימון השלמה!\n` +
    `שלום ${params.name},\n` +
    `בעקבות הביטול, קיבלת אסימון השלמה עבור ${params.swimmerName}.\n` +
    `ניתן להשתמש בו להזמנת שיעור חלופי באפליקציה.\n` +
    `האסימון בתוקף ל-30 יום.`,

  payment_received: (params) =>
    `💳 התשלום התקבל!\n` +
    `שלום ${params.name},\n` +
    `קיבלנו את התשלום שלך בהצלחה.\n` +
    `הקרדיטים נוספו לחשבונך.\n` +
    `תודה! 🙏`,

  payment_reminder: (params) =>
    `⚠️ תזכורת תשלום\n` +
    `שלום ${params.name},\n` +
    `הקרדיטים בחשבונך עומדים להסתיים.\n` +
    `כדאי לרכוש חבילה חדשה כדי להמשיך ליהנות מהשיעורים! 🏊‍♂️`,

  welcome: (params) =>
    `🎉 ברוכים הבאים ל-AquaFlow!\n` +
    `שלום ${params.name},\n` +
    `נרשמת בהצלחה למערכת!\n` +
    `כעת תוכל/י להוסיף את הילדים ולהירשם לשיעורים.\n` +
    `נשמח לראותכם בבריכה! 💙🏊‍♂️`,

  coach_substituted: (params) =>
    `📢 עדכון לגבי השיעור\n` +
    `שלום ${params.name},\n` +
    `רצינו לעדכן שהמאמן/ת בשיעור של ${params.swimmerName || 'הילד/ה'} התחלף/ה.\n` +
    `📅 ${params.sessionDate}\n` +
    `⏰ ${params.sessionTime}\n` +
    `👨‍🏫 המאמן/ת החדש/ה: ${params.coachName}\n` +
    `נתראה בבריכה! 🏊‍♂️`,

  session_time_changed: (params) =>
    `📢 שינוי בשעת השיעור\n` +
    `שלום ${params.name},\n` +
    `רצינו לעדכן על שינוי בשעת השיעור של ${params.swimmerName || 'הילד/ה'}.\n` +
    `📅 תאריך: ${params.sessionDate}\n` +
    `⏰ שעה חדשה: ${params.sessionTime}\n` +
    `📍 מיקום: ${params.locationName}\n` +
    `נתראה! 💙`,

  daily_reminder: (params) =>
    `🏊‍♂️ תזכורת לשיעור היום!\n` +
    `שלום ${params.name},\n` +
    `לא לשכוח - היום יש שיעור ל${params.swimmerName}!\n` +
    `⏰ שעה: ${params.sessionTime}\n` +
    `📍 מיקום: ${params.locationName}\n` +
    `👨‍🏫 מאמן/ת: ${params.coachName}\n` +
    `נתראה בבריכה! 💙`,
};

/**
 * Generate a notification message from a template
 */
export function generateNotification(
  type: NotificationType,
  params: NotificationParams
): string {
  const template = NOTIFICATION_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown notification type: ${type}`);
  }
  return template(params);
}

/**
 * Log notification (for development/debugging)
 */
export function logNotification(
  type: NotificationType,
  params: NotificationParams,
  channel: 'sms' | 'whatsapp' | 'email' = 'sms'
): void {
  const message = generateNotification(type, params);
  console.log(`[${channel.toUpperCase()}] ${type}:`, message);
}

/**
 * Format phone number for Israeli numbers
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with 972
  if (digits.startsWith('0')) {
    return '+972' + digits.slice(1);
  }
  
  // If doesn't start with country code, add it
  if (!digits.startsWith('972')) {
    return '+972' + digits;
  }
  
  return '+' + digits;
}

/**
 * Dispatch notification via AI-powered webhook
 * This sends the notification to the school's configured webhook URL
 * with an AI-generated message
 */
export async function dispatchNotification(
  type: NotificationType,
  params: NotificationParams,
  schoolId: string
): Promise<{ success: boolean; error?: string; generatedMessage?: string }> {
  try {
    const eventType = NOTIFICATION_TO_EVENT_TYPE[type] || type;
    
    const { data, error } = await supabase.functions.invoke("dispatch-notification", {
      body: {
        event_type: eventType,
        data: {
          parent_name: params.name,
          parent_phone: params.phone || "",
          child_name: params.swimmerName,
          class_time: params.sessionTime 
            ? `${params.sessionDate || ""} ${params.sessionTime}` 
            : params.sessionDate,
          coach_name: params.coachName,
          class_type: params.className,
          location: params.locationName,
          reason: params.reason,
          token_count: params.tokenCount,
          position: params.position,
        },
        school_id: schoolId,
        is_test: false,
      },
    });

    if (error) {
      console.error("[notificationService] Webhook dispatch error:", error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      console.warn("[notificationService] Webhook dispatch failed:", data?.error);
      return { success: false, error: data?.error };
    }

    console.log("[notificationService] Notification dispatched successfully");
    return { 
      success: true, 
      generatedMessage: data.generated_message 
    };
  } catch (err) {
    console.error("[notificationService] Error dispatching notification:", err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "Unknown error" 
    };
  }
}

/**
 * Send notification with webhook fallback to local template
 * Tries webhook first, falls back to local template if webhook fails or not configured
 */
export async function sendNotification(
  type: NotificationType,
  params: NotificationParams,
  schoolId?: string,
  options: { useWebhook?: boolean } = { useWebhook: true }
): Promise<{ success: boolean; message: string; source: 'webhook' | 'template' }> {
  // If webhook is enabled and we have a school ID, try webhook first
  if (options.useWebhook && schoolId) {
    const webhookResult = await dispatchNotification(type, params, schoolId);
    
    if (webhookResult.success) {
      return {
        success: true,
        message: webhookResult.generatedMessage || "",
        source: 'webhook',
      };
    }
    
    // Log webhook failure but continue with template fallback
    console.warn("[notificationService] Webhook failed, using template fallback:", webhookResult.error);
  }
  
  // Fallback to local template
  const message = generateNotification(type, params);
  logNotification(type, params);
  
  return {
    success: true,
    message,
    source: 'template',
  };
}
