/**
 * Hash utilities for orchestrator
 */

import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of a string or buffer
 */
export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Compute SHA-256 hash of a JSON object
 * Sorts keys for deterministic hashing
 */
export function hashObject(obj: unknown): string {
  const sortedJson = JSON.stringify(obj, sortKeys);
  return sha256(sortedJson);
}

/**
 * Sort keys recursively for deterministic JSON serialization
 */
function sortKeys(key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as object)
      .sort()
      .reduce((sorted, k) => {
        (sorted as Record<string, unknown>)[k] = (value as Record<string, unknown>)[k];
        return sorted;
      }, {});
  }
  return value;
}
