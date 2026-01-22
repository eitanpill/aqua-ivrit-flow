/**
 * WhatsApp Click-to-Chat helper
 * Opens WhatsApp with a pre-filled message to a given phone number
 */

/**
 * Formats an Israeli phone number for WhatsApp
 * Strips non-numeric characters and adds 972 country code
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with 972
  if (cleaned.startsWith('0')) {
    cleaned = '972' + cleaned.slice(1);
  }
  
  // If doesn't start with 972, add it
  if (!cleaned.startsWith('972')) {
    cleaned = '972' + cleaned;
  }
  
  return cleaned;
}

/**
 * Opens WhatsApp with a pre-filled message
 * @param phone - The phone number to message
 * @param message - Optional pre-filled message
 */
export function openWhatsApp(phone: string, message?: string): void {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  
  let url = `https://wa.me/${formattedPhone}`;
  
  if (message) {
    url += `?text=${encodeURIComponent(message)}`;
  }
  
  window.open(url, '_blank', 'noopener,noreferrer');
}
