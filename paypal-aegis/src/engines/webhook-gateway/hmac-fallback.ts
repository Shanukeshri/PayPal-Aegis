/**
 * Webhook Gateway — HMAC-SHA256 Fallback Verifier
 *
 * For Judge Demo toolbar events and PayPal Webhook Simulator events
 * that lack PayPal's crypto signatures. Verifies using internal
 * HMAC-SHA256 with the DEMO_HMAC_SECRET.
 */

import * as crypto from 'crypto';
import { config } from '../../config';
import logger from '../../lib/logger';
import { store } from '../../lib/store';
import { WebhookVerificationResult, PayPalWebhookEvent } from '../../types';

/**
 * Verifies a webhook event using HMAC-SHA256 with the demo secret.
 *
 * For simulated/demo events, the HMAC is computed over the raw body
 * and compared against the X-AEGIS-HMAC header. If no HMAC header
 * is present, we treat it as a simulation event and mark it verified
 * in SIMULATION mode.
 *
 * @param rawBody - The raw request body as a Buffer
 * @param headers - The request headers
 * @returns WebhookVerificationResult
 */
export async function verifyHmacFallback(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>
): Promise<WebhookVerificationResult> {
  const getHeader = (name: string): string => {
    const val = headers[name.toLowerCase()] || headers[name];
    return Array.isArray(val) ? val[0] : val || '';
  };

  // Parse event from raw body
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString('utf-8')) as PayPalWebhookEvent;
  } catch (err) {
    logger.error('HMAC fallback: Failed to parse webhook event body', { error: err });
    return {
      verified: false,
      mode: 'HMAC_DEMO',
      eventId: 'unknown',
      eventType: 'unknown',
      isDuplicate: false,
    };
  }

  const eventId = event.id || `sim-${Date.now()}`;
  const eventType = event.event_type || 'unknown';

  // Dedup check
  const isDuplicate = store.isWebhookDuplicate(eventId);
  if (isDuplicate) {
    logger.warn('Duplicate webhook event detected (HMAC path)', { eventId, eventType });
    return {
      verified: true,
      mode: 'HMAC_DEMO',
      eventId,
      eventType,
      isDuplicate: true,
    };
  }

  const hmacHeader = getHeader('X-AEGIS-HMAC');
  const secret = config.demo.hmacSecret;

  // If there's an HMAC header, validate it
  if (hmacHeader) {
    try {
      const expectedHmac = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      const verified = crypto.timingSafeEqual(
        Buffer.from(hmacHeader, 'hex'),
        Buffer.from(expectedHmac, 'hex')
      );

      if (verified) {
        store.markWebhookProcessed(eventId);
        store.addAuditEntry('WEBHOOK_VERIFIED', {
          eventId,
          eventType,
          mode: 'HMAC_DEMO',
        });
      }

      logger.info('Webhook HMAC verification result', { eventId, eventType, verified });

      return {
        verified,
        mode: 'HMAC_DEMO',
        eventId,
        eventType,
        isDuplicate: false,
      };
    } catch (err) {
      logger.error('HMAC verification failed', {
        eventId,
        eventType,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        verified: false,
        mode: 'HMAC_DEMO',
        eventId,
        eventType,
        isDuplicate: false,
      };
    }
  }

  // No HMAC header — treat as simulation/demo event (auto-accept)
  logger.info('No HMAC header present — accepting as SIMULATION event', {
    eventId,
    eventType,
  });

  store.markWebhookProcessed(eventId);
  store.addAuditEntry('WEBHOOK_VERIFIED', {
    eventId,
    eventType,
    mode: 'SIMULATION',
  });

  return {
    verified: true,
    mode: 'SIMULATION',
    eventId,
    eventType,
    isDuplicate: false,
  };
}

/**
 * Generates an HMAC-SHA256 signature for a payload (used for demo toolbar events).
 *
 * @param payload - The JSON payload to sign
 * @returns hex-encoded HMAC string
 */
export function generateDemoHmac(payload: Buffer | string): string {
  const secret = config.demo.hmacSecret;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
