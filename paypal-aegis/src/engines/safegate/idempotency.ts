/**
 * Idempotency Key Manager
 *
 * Generates PayPal-Request-Id headers (v4 UUID, 36 chars) and caches
 * responses so replayed requests return the local snapshot rather than
 * PayPal's current state.
 */

import { v4 as uuidv4 } from 'uuid';
import { store } from '../../lib/store';
import logger from '../../lib/logger';
import type { IdempotencyRecord } from '../../types';

/** Default TTL for idempotency records (30 days — PayPal's limit). */
const DEFAULT_TTL_DAYS = 30;

export interface IdempotencyResult {
  requestId: string;
  cachedResponse?: {
    response: Record<string, unknown>;
    statusCode: number;
    timestamp: Date;
  };
}

/**
 * Generates a composite cache key from endpoint + payload hash.
 * Ensures the same logical operation maps to the same idempotency record.
 */
function buildCacheKey(endpoint: string, payload: Record<string, unknown>): string {
  const payloadSignature = JSON.stringify(payload, Object.keys(payload).sort());
  // Simple deterministic hash — good enough for in-memory dedup
  let hash = 0;
  for (let i = 0; i < payloadSignature.length; i++) {
    const ch = payloadSignature.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return `idempotency:${endpoint}:${Math.abs(hash).toString(36)}`;
}

/**
 * Injects (or retrieves) an idempotency key for the given endpoint + payload.
 *
 * - If an identical request was previously made and its response cached,
 *   returns the cached snapshot so the caller can skip the API call.
 * - Otherwise generates a fresh v4 UUID (36 chars, within PayPal's 38-char limit)
 *   and returns it for the caller to attach as `PayPal-Request-Id`.
 */
export function injectIdempotencyKey(
  endpoint: string,
  payload: Record<string, unknown>
): IdempotencyResult {
  const cacheKey = buildCacheKey(endpoint, payload);

  // Check for an existing record with the same endpoint + payload fingerprint
  // by scanning the store (keyed by requestId)
  const existingRecord = findRecordByCacheKey(cacheKey);

  if (existingRecord) {
    logger.debug('Idempotency cache HIT — returning local snapshot', {
      requestId: existingRecord.requestId,
      endpoint,
    });

    return {
      requestId: existingRecord.requestId,
      cachedResponse: {
        response: existingRecord.response,
        statusCode: existingRecord.statusCode,
        timestamp: existingRecord.timestamp,
      },
    };
  }

  // Generate a new v4 UUID (36 chars: 8-4-4-4-12)
  const requestId = uuidv4();

  logger.debug('Generated new idempotency key', { requestId, endpoint });

  return { requestId };
}

/**
 * Records the response for a given requestId so future replays
 * serve the historical snapshot rather than PayPal's current state.
 */
export function recordIdempotencyResponse(
  requestId: string,
  endpoint: string,
  method: string,
  payload: Record<string, unknown>,
  response: Record<string, unknown>,
  statusCode: number
): void {
  const cacheKey = buildCacheKey(endpoint, payload);

  const record: IdempotencyRecord = {
    requestId,
    endpoint,
    method,
    payload,
    response,
    statusCode,
    timestamp: new Date(),
    ttlDays: DEFAULT_TTL_DAYS,
  };

  store.setIdempotencyRecord(record);

  // Also store by cache key for fast lookup on replay
  cacheKeyIndex.set(cacheKey, requestId);

  logger.info('Idempotency response recorded', {
    requestId,
    endpoint,
    statusCode,
  });
}

/**
 * Retrieves a cached response by requestId directly.
 */
export function getIdempotencyRecord(requestId: string): IdempotencyRecord | undefined {
  return store.getIdempotencyRecord(requestId);
}

// ── Internal Cache-Key Index ───────────────────────────────────────────

/** Maps composite cache keys → requestIds for O(1) replay lookup. */
const cacheKeyIndex = new Map<string, string>();

function findRecordByCacheKey(cacheKey: string): IdempotencyRecord | undefined {
  const requestId = cacheKeyIndex.get(cacheKey);
  if (!requestId) return undefined;

  const record = store.getIdempotencyRecord(requestId);
  if (!record) {
    // Stale index entry
    cacheKeyIndex.delete(cacheKey);
    return undefined;
  }

  // Honour TTL
  const expiresAt = record.timestamp.getTime() + record.ttlDays * 24 * 60 * 60 * 1000;
  if (Date.now() > expiresAt) {
    cacheKeyIndex.delete(cacheKey);
    logger.debug('Idempotency record expired', { requestId });
    return undefined;
  }

  return record;
}
