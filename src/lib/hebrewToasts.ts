/**
 * Hebrew Toast Messages - הודעות טוסט בעברית
 * Centralized toast messages for consistent Hebrew UI
 */

import { toast } from 'sonner';

export const hebrewToast = {
  // Success messages
  success: {
    saved: () => toast.success('השמירה בוצעה בהצלחה'),
    created: () => toast.success('נוצר בהצלחה'),
    updated: () => toast.success('עודכן בהצלחה'),
    deleted: () => toast.success('נמחק בהצלחה'),
    enrolled: () => toast.success('ההרשמה בוצעה בהצלחה!'),
    cancelled: () => toast.success('הביטול בוצע בהצלחה'),
    copied: () => toast.success('הועתק ללוח'),
    sent: () => toast.success('נשלח בהצלחה'),
    loggedIn: () => toast.success('התחברת בהצלחה!'),
    loggedOut: () => toast.success('התנתקת בהצלחה'),
    swimmerAdded: () => toast.success('הילד נוסף בהצלחה!'),
    swimmerUpdated: () => toast.success('הפרטים עודכנו בהצלחה!'),
    swimmerRemoved: () => toast.success('הילד הוסר בהצלחה'),
    sessionCancelled: () => toast.success('השיעור בוטל בהצלחה'),
    notesSaved: () => toast.success('ההערות נשמרו בהצלחה'),
    poolAdded: () => toast.success('הבריכה נוספה בהצלחה'),
    poolDeleted: () => toast.success('הבריכה נמחקה בהצלחה'),
    productAdded: () => toast.success('המוצר נוסף בהצלחה'),
    productDeleted: () => toast.success('המוצר נמחק בהצלחה'),
    levelAdded: () => toast.success('הרמה נוספה בהצלחה'),
    levelDeleted: () => toast.success('הרמה נמחקה בהצלחה'),
    seasonAdded: () => toast.success('העונה נוספה בהצלחה'),
    seasonDeleted: () => toast.success('העונה נמחקה בהצלחה'),
    joinedWaitlist: () => toast.success('נוספת לרשימת ההמתנה'),
    leftWaitlist: () => toast.success('הוסרת מרשימת ההמתנה'),
    tokenUsed: () => toast.success('האסימון נוצל בהצלחה'),
    paymentReceived: () => toast.success('התשלום התקבל בהצלחה'),
    attendanceMarked: () => toast.success('הנוכחות סומנה בהצלחה'),
    skillUpdated: () => toast.success('המיומנות עודכנה בהצלחה'),
  },

  // Error messages
  error: {
    general: () => toast.error('אירעה שגיאה, נסה שוב'),
    network: () => toast.error('שגיאת תקשורת, בדוק את החיבור לאינטרנט'),
    notFound: () => toast.error('לא נמצא'),
    unauthorized: () => toast.error('אין הרשאה לפעולה זו'),
    validation: (message?: string) => toast.error(message || 'נתונים לא תקינים'),
    required: (field: string) => toast.error(`${field} הוא שדה חובה`),
    enrollmentFailed: () => toast.error('שגיאה בהרשמה'),
    cancellationFailed: () => toast.error('שגיאה בביטול'),
    loginFailed: () => toast.error('שגיאת כניסה'),
    invalidCredentials: () => toast.error('אימייל או סיסמה שגויים'),
    userExists: () => toast.error('משתמש עם אימייל זה כבר קיים במערכת'),
    sessionFull: () => toast.error('השיעור מלא'),
    alreadyEnrolled: () => toast.error('הילד כבר רשום לשעה זו'),
    addSwimmerFailed: () => toast.error('שגיאה בהוספת הילד'),
    updateFailed: () => toast.error('שגיאה בעדכון'),
    deleteFailed: () => toast.error('שגיאה במחיקה'),
    selectRequired: (item: string) => toast.error(`יש לבחור ${item}`),
  },

  // Info/warning messages
  info: {
    loading: () => toast.info('טוען...'),
    processing: () => toast.info('מעבד...'),
    waitlistNotification: () => toast.info('התפנה מקום! לחץ להרשמה'),
    tokenExpiringSoon: () => toast.warning('אסימון השלמה עומד לפוג'),
    lowCredits: () => toast.warning('נותרו מעט קרדיטים'),
    sessionStartingSoon: () => toast.info('השיעור מתחיל בקרוב'),
  },

  // Custom toast with any message
  custom: {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast.info(message),
    warning: (message: string) => toast.warning(message),
  },
};

export default hebrewToast;
