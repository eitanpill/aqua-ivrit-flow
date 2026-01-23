/**
 * Phone Utility Functions for Israeli Phone Numbers
 */

/**
 * Format Israeli phone number for display
 * Converts "0521234567" to "052-123-4567"
 * @param phone - Raw phone number string
 * @returns Formatted phone string or original if invalid
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // Check if it's a valid Israeli mobile format (10 digits starting with 05)
  if (digits.length === 10 && digits.startsWith("05")) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // For other formats, try basic formatting
  if (digits.length === 9 && digits.startsWith("5")) {
    // Handle case where leading 0 was dropped
    return `0${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  
  // Return original if can't format
  return phone;
}

/**
 * Validate Israeli mobile phone number
 * Must start with 05 and have exactly 10 digits
 * @param phone - Phone number to validate
 * @returns boolean indicating if valid
 */
export function isValidIsraeliPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return /^05\d{8}$/.test(digits);
}

/**
 * Israeli phone validation regex pattern
 * For use with Zod or form validation
 */
export const israeliPhoneRegex = /^05\d{8}$/;

/**
 * Error message for invalid Israeli phone
 */
export const israeliPhoneErrorMessage = "מספר טלפון לא תקין (חייב להתחיל ב-05 ולהכיל 10 ספרות)";

/**
 * Calculate age from birth date
 * Returns exact age with decimal (e.g., 6.5)
 * @param birthDate - Date string or Date object
 * @returns Age as number with one decimal place, or null if invalid
 */
export function calculateExactAge(birthDate: string | Date | null | undefined): number | null {
  if (!birthDate) return null;
  
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  
  const today = new Date();
  const diffMs = today.getTime() - birth.getTime();
  const ageYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  
  return Math.round(ageYears * 10) / 10;
}

/**
 * Get Hebrew age label with gender
 * @param birthDate - Birth date
 * @param gender - 'male' | 'female' | 'other' | null
 * @returns Hebrew age string like "בן 6.5" or "בת 4"
 */
export function getHebrewAgeLabel(
  birthDate: string | Date | null | undefined,
  gender?: "male" | "female" | "other" | null
): string | null {
  const age = calculateExactAge(birthDate);
  if (age === null) return null;
  
  const prefix = gender === "female" ? "בת" : "בן";
  return `${prefix} ${age}`;
}
