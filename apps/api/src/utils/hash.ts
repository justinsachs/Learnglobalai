/**
 * Hashing utilities for artifact integrity and audit trails
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
  const sortedJson = JSON.stringify(obj, Object.keys(obj as object).sort());
  return sha256(sortedJson);
}

/**
 * Compute hash of a file content with metadata
 */
export interface HashRecord {
  algorithm: 'sha256';
  hash: string;
  computedAt: string;
}

export function createHashRecord(data: string | Buffer): HashRecord {
  return {
    algorithm: 'sha256',
    hash: sha256(data),
    computedAt: new Date().toISOString(),
  };
}

/**
 * Verify a hash
 */
export function verifyHash(data: string | Buffer, expectedHash: string): boolean {
  return sha256(data) === expectedHash;
}

/**
 * Generate a short hash for IDs (first 8 characters)
 */
export function shortHash(data: string | Buffer): string {
  return sha256(data).substring(0, 8);
}
