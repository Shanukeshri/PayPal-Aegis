/**
 * Webhook Gateway — Main Engine (Engine 3)
 *
 * Dual-mode webhook processing:
 * - CRC32+RSA-SHA256 for real PayPal webhooks
 * - HMAC-SHA256 fallback for demo/simulated events
 *
 * Flow:
 * 1. Receive raw body buffer
 * 2. Auto-detect verification mode (cert header presence)
 * 3. Verify signature
 * 4. Dedup check
 * 5. Return HTTP 200 immediately
 * 6. Process event asynchronously via HATEOAS hydrator
 * 7. Route to appropriate handler engine
 */

import logger from '../../lib/logger';
import { store } from '../../lib/store';
import { PayPalWebhookEvent, WebhookVerificationResult, PayPalDispute } from '../../types';
import { verifyCrc32Rsa } from './verifier';
import { verifyHmacFallback } from './hmac-fallback';
import { hydrateResource, HydrationResult } from './hateoas-hydrator';

// ============================================
// Event handler registry
// ============================================

type EventHandler = (
  event: PayPalWebhookEvent,
  hydration: HydrationResult
) => Promise<void>;

const eventHandlers = new Map<string, EventHandler[]>();

/**
 * Register a handler for a specific webhook event type.
 */
export function registerEventHandler(
  eventType: string,
  handler: EventHandler
): void {
  const existing = eventHandlers.get(eventType) || [];
  existing.push(handler);
  eventHandlers.set(eventType, existing);
  logger.debug('Registered webhook event handler', { eventType });
}

/**
 * Register a handler for multiple event types at once.
 */
export function registerEventHandlers(
  eventTypes: string[],
  handler: EventHandler
): void {
  for (const eventType of eventTypes) {
    registerEventHandler(eventType, handler);
  }
}

// ============================================
// Dispute event types for routing
// ============================================

const DISPUTE_EVENT_TYPES = [
  'CUSTOMER.DISPUTE.CREATED',
  'CUSTOMER.DISPUTE.UPDATED',
  'CUSTOMER.DISPUTE.RESOLVED',
  'RISK.DISPUTE.CREATED',
];

const PAYMENT_EVENT_TYPES = [
  'PAYMENT.AUTHORIZATION.CREATED',
  'PAYMENT.AUTHORIZATION.VOIDED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
];

const ORDER_EVENT_TYPES = [
  'CHECKOUT.ORDER.APPROVED',
  'CHECKOUT.ORDER.COMPLETED',
  'CHECKOUT.ORDER.SAVED',
];

// ============================================
// Core processing
// ============================================

export interface WebhookProcessingResult {
  verification: WebhookVerificationResult;
  hydration?: HydrationResult;
  routed: boolean;
  routedTo: string[];
  error?: string;
}

/**
 * Processes an incoming webhook event.
 *
 * @param rawBody - The raw HTTP request body as a Buffer
 * @param headers - The HTTP request headers
 * @returns Verification result (for immediate HTTP 200 response)
 */
export async function processWebhookEvent(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>
): Promise<WebhookProcessingResult> {
  const getHeader = (name: string): string => {
    const val = headers[name.toLowerCase()] || headers[name];
    return Array.isArray(val) ? val[0] : val || '';
  };

  // Auto-detect verification mode based on PAYPAL-CERT-URL header
  const certUrl = getHeader('PAYPAL-CERT-URL');
  const useCrc32Rsa = !!certUrl;

  logger.info('Processing webhook event', {
    mode: useCrc32Rsa ? 'CRC32_RSA' : 'HMAC_DEMO',
    hasCertUrl: !!certUrl,
    bodyLength: rawBody.length,
  });

  // Step 1: Verify signature
  let verification: WebhookVerificationResult;
  if (useCrc32Rsa) {
    verification = await verifyCrc32Rsa(rawBody, headers);
  } else {
    verification = await verifyHmacFallback(rawBody, headers);
  }

  // If verification failed or it's a duplicate, stop processing
  if (!verification.verified) {
    logger.warn('Webhook verification failed — rejecting event', {
      eventId: verification.eventId,
      mode: verification.mode,
    });
    return {
      verification,
      routed: false,
      routedTo: [],
      error: 'Signature verification failed',
    };
  }

  if (verification.isDuplicate) {
    logger.info('Duplicate webhook event — skipping processing', {
      eventId: verification.eventId,
    });
    return {
      verification,
      routed: false,
      routedTo: [],
    };
  }

  // Step 2: Parse event for async processing
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString('utf-8')) as PayPalWebhookEvent;
  } catch (err) {
    logger.error('Failed to parse verified webhook body', { error: err });
    return {
      verification,
      routed: false,
      routedTo: [],
      error: 'Failed to parse event body',
    };
  }

  // Step 3: Async processing — hydrate + route
  // Fire-and-forget: the HTTP response is sent immediately
  const routedTo: string[] = [];

  processEventAsync(event, routedTo).catch((err) => {
    logger.error('Async webhook processing failed', {
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return {
    verification,
    routed: true,
    routedTo,
  };
}

/**
 * Asynchronously processes a verified webhook event:
 * 1. Hydrate resource via HATEOAS links
 * 2. Route to registered handlers
 * 3. Store dispute data if applicable
 */
async function processEventAsync(
  event: PayPalWebhookEvent,
  routedTo: string[]
): Promise<void> {
  logger.info('Beginning async webhook processing', {
    eventId: event.id,
    eventType: event.event_type,
  });

  // Hydrate the resource
  let hydration: HydrationResult;
  try {
    hydration = await hydrateResource(event);
    logger.info('Resource hydration complete', {
      eventId: event.id,
      resourceType: hydration.resourceType,
      simulated: hydration.simulated,
    });
  } catch (err) {
    logger.error('Resource hydration failed', {
      eventId: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
    hydration = {
      success: false,
      resourceType: 'unknown',
      hydratedResource: event.resource,
      sourceUrl: 'none',
      simulated: false,
    };
  }

  // Store dispute data if this is a dispute event
  if (DISPUTE_EVENT_TYPES.includes(event.event_type)) {
    const disputeData = hydration.hydratedResource as unknown as PayPalDispute;
    if (disputeData && disputeData.dispute_id) {
      store.setDispute(disputeData);
      store.incrementDisputes();
      logger.info('Dispute data stored', {
        disputeId: disputeData.dispute_id,
        status: disputeData.status,
      });
    }
  }

  // Route to registered handlers
  const handlers = eventHandlers.get(event.event_type);
  if (handlers && handlers.length > 0) {
    for (const handler of handlers) {
      try {
        await handler(event, hydration);
        routedTo.push(event.event_type);
      } catch (err) {
        logger.error('Event handler failed', {
          eventId: event.id,
          eventType: event.event_type,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } else {
    logger.debug('No handlers registered for event type', {
      eventType: event.event_type,
    });
  }

  // Categorize and log routing
  let category = 'UNKNOWN';
  if (DISPUTE_EVENT_TYPES.includes(event.event_type)) {
    category = 'DISPUTE_SHIELD';
  } else if (PAYMENT_EVENT_TYPES.includes(event.event_type)) {
    category = 'HOLD_MANAGER';
  } else if (ORDER_EVENT_TYPES.includes(event.event_type)) {
    category = 'ORDER_PROCESSING';
  }

  store.addAuditEntry('WEBHOOK_PROCESSED', {
    eventId: event.id,
    eventType: event.event_type,
    category,
    resourceType: hydration.resourceType,
    simulated: hydration.simulated,
    handlersInvoked: routedTo.length,
  });

  logger.info('Webhook event processing complete', {
    eventId: event.id,
    eventType: event.event_type,
    category,
    handlersInvoked: routedTo.length,
  });
}

/**
 * Returns the list of registered event types.
 */
export function getRegisteredEventTypes(): string[] {
  return Array.from(eventHandlers.keys());
}

// Re-export sub-modules
export { verifyCrc32Rsa } from './verifier';
export { verifyHmacFallback, generateDemoHmac } from './hmac-fallback';
export { hydrateResource } from './hateoas-hydrator';
export type { HydrationResult } from './hateoas-hydrator';
