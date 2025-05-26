import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines class names using clsx and tailwind-merge.
 * Useful for conditionally applying Tailwind CSS classes.
 * @param {...(string|object|Array<string|object>)} inputs - Class names or objects with class names as keys.
 * @returns {string} The merged and optimized class string.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}