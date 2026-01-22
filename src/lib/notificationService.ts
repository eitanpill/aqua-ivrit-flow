/**
 * Notification Service - שירות התראות
 * Hebrew notification templates for SMS/WhatsApp/Email
 */

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
  | 'welcome';

// Hebrew notification templates
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
