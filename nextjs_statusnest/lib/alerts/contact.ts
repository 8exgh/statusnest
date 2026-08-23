/**
 * Validation for the contact details used in offline alerts. Mirrors the
 * rules AlertTray (and the phone gateway behind it) enforce, so a value that
 * saves here is guaranteed to be accepted downstream.
 */

/** E.164 check matching the phone gateway: leading "+", 8–15 digits, no leading zero. */
export function normalizePhoneNumber(input: string): string | null {
  const stripped = input.replace(/[\s\-().]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(stripped) ? stripped : null;
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}
