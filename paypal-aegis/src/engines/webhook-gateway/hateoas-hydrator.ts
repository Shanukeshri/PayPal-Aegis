/**
 * Webhook Gateway — HATEOAS State Hydrator
 *
 * Extracts the resource.links array from a webhook payload, finds
 * the "self" or "up" link, and performs an immediate GET against
 * the authoritative REST endpoint to fetch the latest resource state.
 *
 * Supported endpoints:
 * - /v2/checkout/orders/{id}
 * - /v2/payments/captures/{id}
 * - /v1/customer/disputes/{id}
 * - /v1/reporting/balances
 */

import axios from 'axios';
import { config } from '../../config';
import logger from '../../lib/logger';
import { PayPalLink, PayPalWebhookEvent } from '../../types';

/**
 * Gets a valid OAuth2 access token.
 * Attempts to use SafeGate if available; falls back to direct token request.
 */
async function getAccessToken(): Promise<string | null> {
  if (!config.paypal.isConfigured) {
    logger.debug('PayPal not configured — HATEOAS hydration will use simulation');
    return null;
  }

  try {
    const response = await axios.post<{ access_token: string }>(
      `${config.paypal.sandboxBaseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: {
          username: config.paypal.clientId,
          password: config.paypal.clientSecret,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );
    return response.data.access_token;
  } catch (err) {
    logger.error('Failed to obtain OAuth token for HATEOAS hydration', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Finds the best HATEOAS link for hydration.
 * Prefers "self", then "up", then any GET link.
 */
function findHydrationLink(links: PayPalLink[]): PayPalLink | null {
  if (!links || links.length === 0) return null;

  // Priority: self > up > first GET link
  const selfLink = links.find((l) => l.rel === 'self');
  if (selfLink) return selfLink;

  const upLink = links.find((l) => l.rel === 'up');
  if (upLink) return upLink;

  const getLink = links.find((l) => l.method === 'GET');
  return getLink || null;
}

/**
 * Determines the resource type from a URL path.
 */
function classifyEndpoint(url: string): string {
  if (url.includes('/v2/checkout/orders/')) return 'order';
  if (url.includes('/v2/payments/captures/')) return 'capture';
  if (url.includes('/v1/customer/disputes/')) return 'dispute';
  if (url.includes('/v1/reporting/balances')) return 'balance';
  return 'unknown';
}

/**
 * Generates a simulated hydrated resource based on the webhook event.
 */
function generateSimulatedResource(
  event: PayPalWebhookEvent,
  resourceType: string
): Record<string, unknown> {
  const now = new Date().toISOString();

  switch (resourceType) {
    case 'order':
      return {
        id: (event.resource as Record<string, unknown>).id || 'SIM-ORDER-001',
        intent: 'CAPTURE',
        status: 'COMPLETED',
        purchase_units: [
          {
            reference_id: 'default',
            amount: { currency_code: 'USD', value: '100.00' },
            description: 'Simulated order from webhook hydration',
          },
        ],
        create_time: event.create_time || now,
        update_time: now,
        links: [],
        _simulated: true,
      };

    case 'capture':
      return {
        id: (event.resource as Record<string, unknown>).id || 'SIM-CAPTURE-001',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '100.00' },
        final_capture: true,
        create_time: event.create_time || now,
        update_time: now,
        links: [],
        _simulated: true,
      };

    case 'dispute':
      return {
        dispute_id: (event.resource as Record<string, unknown>).dispute_id || 'SIM-DISPUTE-001',
        create_time: event.create_time || now,
        update_time: now,
        status: 'WAITING_FOR_SELLER_RESPONSE',
        reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
        dispute_amount: { currency_code: 'USD', value: '50.00' },
        dispute_life_cycle_stage: 'INQUIRY',
        dispute_channel: 'INTERNAL',
        seller_response_due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        links: [],
        _simulated: true,
      };

    case 'balance':
      return {
        balances: [
          {
            currency: 'USD',
            primary: true,
            total_balance: { currency_code: 'USD', value: '5000.00' },
            available_balance: { currency_code: 'USD', value: '4500.00' },
            withheld_balance: { currency_code: 'USD', value: '500.00' },
          },
        ],
        account_id: 'SIM-ACCOUNT-001',
        _simulated: true,
      };

    default:
      return {
        ...event.resource,
        _simulated: true,
        _hydratedAt: now,
      };
  }
}

export interface HydrationResult {
  success: boolean;
  resourceType: string;
  hydratedResource: Record<string, unknown>;
  sourceUrl: string;
  simulated: boolean;
}

/**
 * Hydrates a webhook event by fetching the latest resource state
 * from PayPal's REST API via HATEOAS links.
 *
 * @param event - The parsed webhook event
 * @returns HydrationResult with the latest resource state
 */
export async function hydrateResource(
  event: PayPalWebhookEvent
): Promise<HydrationResult> {
  // Extract links from the event resource
  const resourceLinks = (event.resource as Record<string, unknown>).links as PayPalLink[] | undefined;
  const topLevelLinks = event.links;

  const allLinks = [...(resourceLinks || []), ...(topLevelLinks || [])];
  const link = findHydrationLink(allLinks);

  if (!link) {
    logger.warn('No HATEOAS link found for hydration — using event resource as-is', {
      eventId: event.id,
      eventType: event.event_type,
    });
    return {
      success: true,
      resourceType: 'unknown',
      hydratedResource: event.resource,
      sourceUrl: 'none',
      simulated: false,
    };
  }

  const resourceType = classifyEndpoint(link.href);
  logger.info('Hydrating resource via HATEOAS link', {
    eventId: event.id,
    rel: link.rel,
    href: link.href,
    resourceType,
  });

  // Get access token
  const token = await getAccessToken();

  if (!token) {
    // Simulation mode
    logger.info('Using simulated hydration (no PayPal token)', {
      eventId: event.id,
      resourceType,
    });
    const simulated = generateSimulatedResource(event, resourceType);
    return {
      success: true,
      resourceType,
      hydratedResource: simulated,
      sourceUrl: link.href,
      simulated: true,
    };
  }

  try {
    const response = await axios.get<Record<string, unknown>>(link.href, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    logger.info('HATEOAS hydration successful', {
      eventId: event.id,
      resourceType,
      status: response.status,
    });

    return {
      success: true,
      resourceType,
      hydratedResource: response.data,
      sourceUrl: link.href,
      simulated: false,
    };
  } catch (err) {
    logger.error('HATEOAS hydration failed — falling back to event resource', {
      eventId: event.id,
      resourceType,
      error: err instanceof Error ? err.message : String(err),
    });

    // Fall back to simulation
    const simulated = generateSimulatedResource(event, resourceType);
    return {
      success: false,
      resourceType,
      hydratedResource: simulated,
      sourceUrl: link.href,
      simulated: true,
    };
  }
}
