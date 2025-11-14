/**
 * Zod schema definitions for ProxyDeck V2 configuration
 *
 * These schemas enforce the structure of stored configuration data
 * and protect against incompatible changes to the V2 data structure.
 */

import { z } from 'zod';

/**
 * Schema for proxy authentication credentials (Firefox only)
 */
export const ProxyAuthSchema = z.object({
  username: z.string(),
  password: z.string()
}).strict();

/**
 * Schema for proxy routing configuration
 */
export const RoutingConfigSchema = z.object({
  useContainerMode: z.boolean(),
  patterns: z.array(z.string()),
  containers: z.array(z.string())
}).strict();

/**
 * Schema for a single proxy configuration
 *
 * This defines the V2 proxy structure that is currently in production.
 * Any changes to this schema represent a BREAKING CHANGE.
 */
export const ProxyConfigSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  proxyType: z.enum(['socks5', 'socks4', 'http', 'https']),
  auth: ProxyAuthSchema.optional(),
  enabled: z.boolean(),
  priority: z.number().int().min(0),
  color: z.string().nullable(),
  routingConfig: RoutingConfigSchema
}).strict();

/**
 * Schema for the main configuration object (V2)
 *
 * This is the top-level configuration structure stored in chrome.storage.
 * Any changes to this schema represent a BREAKING CHANGE.
 */
export const ConfigV2Schema = z.object({
  version: z.literal(2),
  proxies: z.array(ProxyConfigSchema).max(10),
  proxyEnabled: z.boolean()
}).strict();

/**
 * Validates a proxy configuration object
 *
 * @param {unknown} proxy - The proxy object to validate
 * @returns {{success: boolean, data?: object, error?: z.ZodError}} Validation result
 */
export function validateProxyConfig(proxy) {
  const result = ProxyConfigSchema.safeParse(proxy);
  return result;
}

/**
 * Validates the main configuration object (V2)
 *
 * @param {unknown} config - The config object to validate
 * @returns {{success: boolean, data?: object, error?: z.ZodError}} Validation result
 */
export function validateConfig(config) {
  const result = ConfigV2Schema.safeParse(config);
  return result;
}

/**
 * Validates and throws on error (for use in code paths that should never fail)
 *
 * @param {unknown} config - The config object to validate
 * @returns {object} The validated config
 * @throws {Error} If validation fails
 */
export function validateConfigOrThrow(config) {
  const result = ConfigV2Schema.safeParse(config);

  if (!result.success) {
    const errorMessages = result.error.issues.map(issue =>
      `${issue.path.join('.')}: ${issue.message}`
    ).join(', ');

    throw new Error(`Configuration validation failed: ${errorMessages}`);
  }

  return result.data;
}

/**
 * Validates a proxy configuration and throws on error
 *
 * @param {unknown} proxy - The proxy object to validate
 * @returns {object} The validated proxy
 * @throws {Error} If validation fails
 */
export function validateProxyConfigOrThrow(proxy) {
  const result = ProxyConfigSchema.safeParse(proxy);

  if (!result.success) {
    const errorMessages = result.error.issues.map(issue =>
      `${issue.path.join('.')}: ${issue.message}`
    ).join(', ');

    throw new Error(`Proxy configuration validation failed: ${errorMessages}`);
  }

  return result.data;
}

/**
 * Type guard to check if a value is a valid V2 config
 *
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value matches V2 config schema
 */
export function isValidV2Config(value) {
  return ConfigV2Schema.safeParse(value).success;
}

/**
 * Gets human-readable error messages from a validation error
 *
 * @param {z.ZodError} error - The Zod validation error
 * @returns {string[]} Array of error messages
 */
export function getValidationErrorMessages(error) {
  return error.issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
}
