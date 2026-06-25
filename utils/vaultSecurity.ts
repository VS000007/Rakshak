/**
 * Utility functions for secure vault password management using the Web Crypto API.
 */

/**
 * Generates a random 16-byte cryptographically secure salt as a hex string.
 */
export const generateSalt = (): string => {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Hashes a password and salt using SHA-256 and returns a hex string.
 * @param password The plaintext password
 * @param salt The hex string salt
 */
export const hashPassword = async (password: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder();
  // Combine salt and password to prevent rainbow table attacks
  const data = encoder.encode(salt + password);
  
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Compares two strings character by character to prevent timing attacks.
 * In a real backend, we'd use crypto.timingSafeEqual, but for client-side
 * we can simulate it to avoid early-exit timing leaks.
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};
