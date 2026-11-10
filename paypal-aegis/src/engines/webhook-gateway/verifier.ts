/**
 * Webhook Gateway — CRC32 + RSA-SHA256 Verifier
 *
 * Implements PayPal's webhook signature verification:
 * 1. Computes unsigned 32-bit CRC32 of raw body bytes
 * 2. Assembles verification string: transmissionId|transmissionTime|webhookId|crc32Decimal
 * 3. Downloads & caches PEM cert from PAYPAL-CERT-URL
 * 4. Verifies PAYPAL-TRANSMISSION-SIG with RSA-SHA256
 * 5. Dedup check via 7-day TTL in store
 */

import * as CRC32 from 'crc-32';
import * as forge from 'node-forge';
import axios from 'axios';
import { config } from '../../config';
import logger from '../../lib/logger';
import { store } from '../../lib/store';
import { WebhookVerificationResult, PayPalWebhookEvent } from '../../types';

// In-memory PEM certificate cache: certUrl -> { pem, cachedAt }
const certCache = new Map<string, { pem: string; cachedAt: number }>();
const CERT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Downloads a PEM certificate from the given URL, with caching.
 * Only allows certificates from symantec.com or paypal.com domains.
 */
async function fetchCertPem(certUrl: string): Promise<string> {
  // Validate certificate URL domain
  const parsed = new URL(certUrl);
  const allowedHosts = ['symantec.com', 'verisign.com', 'paypal.com'];
  const isAllowed = allowedHosts.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
  );
  if (!isAllowed) {
    throw new Error(`Untrusted certificate URL domain: ${parsed.hostname}`);
  }

  // Check cache
  const cached = certCache.get(certUrl);
  if (cached && Date.now() - cached.cachedAt < CERT_CACHE_TTL_MS) {
    logger.debug('Using cached PEM certificate', { certUrl });
    return cached.pem;
  }

  logger.info('Downloading PEM certificate', { certUrl });
  const response = await axios.get<string>(certUrl, {
    timeout: 10000,
    responseType: 'text',
  });

  const pem = response.data;
  certCache.set(certUrl, { pem, cachedAt: Date.now() });
  return pem;
}

/**
 * Computes the unsigned 32-bit CRC32 decimal value of raw body bytes.
 */
function computeCrc32Decimal(rawBody: Buffer): string {
  const signed = CRC32.buf(rawBody);
  // Convert signed 32-bit to unsigned
  const unsigned = signed >>> 0;
  return unsigned.toString();
}

/**
 * Verifies a PayPal webhook event using CRC32 + RSA-SHA256 signature verification.
 *
 * @param rawBody - The raw request body as a Buffer (before JSON parsing)
 * @param headers - The request headers (case-insensitive)
 * @returns WebhookVerificationResult
 */
export async function verifyCrc32Rsa(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>
): Promise<WebhookVerificationResult> {
  const getHeader = (name: string): string => {
    const val = headers[name.toLowerCase()] || headers[name];
    return Array.isArray(val) ? val[0] : val || '';
  };

  const transmissionId = getHeader('PAYPAL-TRANSMISSION-ID');
  const transmissionTime = getHeader('PAYPAL-TRANSMISSION-TIME');
  const certUrl = getHeader('PAYPAL-CERT-URL');
  const transmissionSig = getHeader('PAYPAL-TRANSMISSION-SIG');
  const webhookId = config.paypal.webhookId;

  // Parse event from raw body
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString('utf-8')) as PayPalWebhookEvent;
  } catch (err) {
    logger.error('Failed to parse webhook event body', { error: err });
    return {
      verified: false,
      mode: 'CRC32_RSA',
      eventId: 'unknown',
      eventType: 'unknown',
      isDuplicate: false,
    };
  }

  const eventId = event.id || 'unknown';
  const eventType = event.event_type || 'unknown';

  // Dedup check
  const isDuplicate = store.isWebhookDuplicate(eventId);
  if (isDuplicate) {
    logger.warn('Duplicate webhook event detected', { eventId, eventType });
    return {
      verified: true,
      mode: 'CRC32_RSA',
      eventId,
      eventType,
      isDuplicate: true,
    };
  }

  // Validate required headers
  if (!transmissionId || !transmissionTime || !certUrl || !transmissionSig) {
    logger.error('Missing required webhook verification headers', {
      hasTransmissionId: !!transmissionId,
      hasTransmissionTime: !!transmissionTime,
      hasCertUrl: !!certUrl,
      hasTransmissionSig: !!transmissionSig,
    });
    return {
      verified: false,
      mode: 'CRC32_RSA',
      eventId,
      eventType,
      isDuplicate: false,
    };
  }

  if (!webhookId) {
    logger.error('PAYPAL_WEBHOOK_ID not configured — cannot verify webhook signature');
    return {
      verified: false,
      mode: 'CRC32_RSA',
      eventId,
      eventType,
      isDuplicate: false,
    };
  }

  try {
    // Step 1: Compute CRC32 of raw body bytes
    const crc32Decimal = computeCrc32Decimal(rawBody);

    // Step 2: Assemble verification string
    const verificationString = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32Decimal}`;
    logger.debug('Verification string assembled', {
      transmissionId,
      transmissionTime,
      webhookId,
      crc32Decimal,
    });

    // Step 3: Download PEM certificate
    const pem = await fetchCertPem(certUrl);

    // Step 4: Verify RSA-SHA256 signature
    const cert = forge.pki.certificateFromPem(pem);
    const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;

    const md = forge.md.sha256.create();
    md.update(verificationString, 'utf8');

    // Decode base64 signature
    const sigBytes = forge.util.decode64(transmissionSig);
    const verified = publicKey.verify(md.digest().bytes(), sigBytes);

    if (verified) {
      store.markWebhookProcessed(eventId);
      store.addAuditEntry('WEBHOOK_VERIFIED', {
        eventId,
        eventType,
        mode: 'CRC32_RSA',
      });
    }

    logger.info('Webhook CRC32+RSA verification result', {
      eventId,
      eventType,
      verified,
    });

    return {
      verified,
      mode: 'CRC32_RSA',
      eventId,
      eventType,
      isDuplicate: false,
    };
  } catch (err) {
    logger.error('Webhook CRC32+RSA verification failed with exception', {
      eventId,
      eventType,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      verified: false,
      mode: 'CRC32_RSA',
      eventId,
      eventType,
      isDuplicate: false,
    };
  }
}

/**
 * Clears the PEM certificate cache (for testing).
 */
export function clearCertCache(): void {
  certCache.clear();
}
