import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitize matric number for safe Firestore document ID
 * Replaces forward slashes and whitespace with underscores
 * @param matric - Raw matric number (e.g. "ADMIN/001" or "STU/2024/001")
 * @returns Sanitized ID (e.g. "ADMIN_001" or "STU_2024_001")
 */
export function sanitizeMatricForFirestore(matric: string): string {
  return matric.trim().toUpperCase().replace(/[\/\s]+/g, '_');
}

/**
 * Normalize email for consistent lookups
 * @param email - Raw email
 * @returns Normalized email (lowercase, trimmed)
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
