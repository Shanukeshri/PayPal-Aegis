/**
 * SafeGate MCP Proxy — Engine 1
 *
 * Central proxy that wraps PayPal sandbox API calls with:
 *  - OAuth 2.0 token lifecycle (oauth-manager)
 *  - Idempotent request IDs (idempotency)
 *  - Phase-scoped tool routing (tool-router)
 *  - Human-in-the-Loop approval gating (hitl-gate)
 *
 * All PayPal calls go through api-m.sandbox.paypal.com.
 * When PayPal credentials are absent, every handler returns
 * realistic simulated responses.
 */

import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import logger from '../../lib/logger';
import { store } from '../../lib/store';
import { oauthManager } from './oauth-manager';
import {
  injectIdempotencyKey,
  recordIdempotencyResponse,
} from './idempotency';
import {
  getToolsForPhase,
  resolveToolForPhase,
  normalizeToolName,
  getAllTools,
  getWorkflowPhases,
  type WorkflowPhase,
  type ToolSchema,
} from './tool-router';
import {
  interceptAction,
  approveAction,
  rejectAction,
  requiresApproval,
  getPendingApprovals,
  getAllApprovals,
  registerSocketEmitter,
  MONEY_MOVING_ACTIONS,
  type ActionExecutor,
} from './hitl-gate';
import type {
  PayPalOrder,
  PayPalAuthorization,
  PayPalCapture,
  PayPalDispute,
  PayPalBalancesResponse,
  PayPalAmount,
  PayPalLink,
  HITLApprovalRequest,
  HITLActionType,
} from '../../types';

// ── Helpers ────────────────────────────────────────────────────────────

const SANDBOX_BASE = config.paypal.sandboxBaseUrl; // https://api-m.sandbox.paypal.com
const isConfigured = config.paypal.isConfigured;

function mockId(prefix: string): string {
  return `${prefix}-SIM-${uuidv4().substring(0, 8).toUpperCase()}`;
}

function mockLinks(self: string): PayPalLink[] {
  return [
    { href: `${SANDBOX_BASE}${self}`, rel: 'self', method: 'GET' },
  ];
}

function nowISO(): string {
  return new Date().toISOString();
}

// ── Axios Wrapper ──────────────────────────────────────────────────────

async function paypalRequest<T = Record<string, unknown>>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  data?: Record<string, unknown>,
  extraHeaders?: Record<string, string>
): Promise<{ data: T; status: number; simulated: boolean }> {
  if (!isConfigured) {
    throw new Error('PAYPAL_NOT_CONFIGURED');
  }

  const managed = await oauthManager.getAccessToken();
  const requestId = data
    ? injectIdempotencyKey(path, data).requestId
    : uuidv4();

  // Check idempotency cache for POST requests
  if (method === 'POST' && data) {
    const idempotency = injectIdempotencyKey(path, data);
    if (idempotency.cachedResponse) {
      logger.info('Idempotency cache hit — returning snapshot', { path, requestId: idempotency.requestId });
      return {
        data: idempotency.cachedResponse.response as T,
        status: idempotency.cachedResponse.statusCode,
        simulated: false,
      };
    }
  }

  const axiosConfig: AxiosRequestConfig = {
    method,
    url: `${SANDBOX_BASE}${path}`,
    headers: {
      'Authorization': `Bearer ${managed.token.access_token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId,
      ...extraHeaders,
    },
    data,
    timeout: 30_000,
  };

  const response = await axios(axiosConfig);

  // Record in idempotency cache for POST
  if (method === 'POST' && data) {
    recordIdempotencyResponse(
      requestId,
      path,
      method,
      data,
      response.data as Record<string, unknown>,
      response.status
    );
  }

  return {
    data: response.data as T,
    status: response.status,
    simulated: false,
  };
}

// ── Simulation Helpers ─────────────────────────────────────────────────

function simResponse<T>(data: T): { data: T; status: number; simulated: boolean } {
  return { data, status: 200, simulated: true };
}

// ── REST Handlers ──────────────────────────────────────────────────────

// ── Orders v2 ──

export async function createOrder(
  amount: PayPalAmount,
  intent: 'AUTHORIZE' | 'CAPTURE' = 'AUTHORIZE',
  description?: string
): Promise<{ data: PayPalOrder; status: number; simulated: boolean }> {
  const payload = {
    intent,
    purchase_units: [
      {
        amount: {
          currency_code: amount.currency_code,
          value: amount.value,
        },
        description: description ?? 'Aegis milestone escrow',
      },
    ],
  };

  if (!isConfigured) {
    logger.warn('SIMULATION: createOrder', { intent, amount });
    const orderId = mockId('ORDER');
    const mock: PayPalOrder = {
      id: orderId,
      intent,
      status: 'CREATED',
      purchase_units: [
        {
          reference_id: 'default',
          amount,
          description: description ?? 'Aegis milestone escrow',
        },
      ],
      create_time: nowISO(),
      update_time: nowISO(),
      links: [
        ...mockLinks(`/v2/checkout/orders/${orderId}`),
        {
          href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
          rel: 'approve',
          method: 'GET',
        },
      ],
    };
    return simResponse(mock);
  }

  try {
    return await paypalRequest<PayPalOrder>('POST', '/v2/checkout/orders', payload);
  } catch (err: unknown) {
    return handleApiError('createOrder', err, () => {
      const orderId = mockId('ORDER');
      const mock: PayPalOrder = {
        id: orderId,
        intent,
        status: 'CREATED',
        purchase_units: [{ reference_id: 'default', amount, description }],
        create_time: nowISO(),
        update_time: nowISO(),
        links: mockLinks(`/v2/checkout/orders/${orderId}`),
      };
      return simResponse(mock);
    });
  }
}

export async function getOrder(
  orderId: string
): Promise<{ data: PayPalOrder; status: number; simulated: boolean }> {
  if (!isConfigured) {
    logger.warn('SIMULATION: getOrder', { orderId });
    const mock: PayPalOrder = {
      id: orderId,
      intent: 'AUTHORIZE',
      status: 'APPROVED',
      purchase_units: [
        {
          reference_id: 'default',
          amount: { currency_code: 'USD', value: '500.00' },
        },
      ],
      create_time: nowISO(),
      update_time: nowISO(),
      links: mockLinks(`/v2/checkout/orders/${orderId}`),
    };
    return simResponse(mock);
  }

  try {
    return await paypalRequest<PayPalOrder>('GET', `/v2/checkout/orders/${orderId}`);
  } catch (err: unknown) {
    return handleApiError('getOrder', err, () => {
      const mock: PayPalOrder = {
        id: orderId,
        intent: 'AUTHORIZE',
        status: 'APPROVED',
        purchase_units: [{ reference_id: 'default', amount: { currency_code: 'USD', value: '500.00' } }],
        create_time: nowISO(),
        update_time: nowISO(),
        links: mockLinks(`/v2/checkout/orders/${orderId}`),
      };
      return simResponse(mock);
    });
  }
}

export async function authorizeOrder(
  orderId: string
): Promise<{ data: PayPalOrder; status: number; simulated: boolean }> {
  if (!isConfigured) {
    logger.warn('SIMULATION: authorizeOrder', { orderId });
    const authId = mockId('AUTH');
    const mock: PayPalOrder = {
      id: orderId,
      intent: 'AUTHORIZE',
      status: 'COMPLETED',
      purchase_units: [
        {
          reference_id: 'default',
          amount: { currency_code: 'USD', value: '500.00' },
          payments: {
            authorizations: [
              {
                id: authId,
                status: 'CREATED',
                amount: { currency_code: 'USD', value: '500.00' },
                create_time: nowISO(),
                update_time: nowISO(),
                expiration_time: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
                links: mockLinks(`/v2/payments/authorizations/${authId}`),
              },
            ],
          },
        },
      ],
      create_time: nowISO(),
      update_time: nowISO(),
      links: mockLinks(`/v2/checkout/orders/${orderId}`),
    };
    return simResponse(mock);
  }

  try {
    return await paypalRequest<PayPalOrder>(
      'POST',
      `/v2/checkout/orders/${orderId}/authorize`,
      {}
    );
  } catch (err: unknown) {
    return handleApiError('authorizeOrder', err, () => {
      const authId = mockId('AUTH');
      const mock: PayPalOrder = {
        id: orderId,
        intent: 'AUTHORIZE',
        status: 'COMPLETED',
        purchase_units: [
          {
            reference_id: 'default',
            amount: { currency_code: 'USD', value: '500.00' },
            payments: {
              authorizations: [{
                id: authId, status: 'CREATED',
                amount: { currency_code: 'USD', value: '500.00' },
                create_time: nowISO(), update_time: nowISO(),
                links: mockLinks(`/v2/payments/authorizations/${authId}`),
              }],
            },
          },
        ],
        create_time: nowISO(),
        update_time: nowISO(),
        links: mockLinks(`/v2/checkout/orders/${orderId}`),
      };
      return simResponse(mock);
    });
  }
}

// ── Payments v2 ──

export async function reauthorizePayment(
  authorizationId: string
): Promise<{ data: PayPalAuthorization; status: number; simulated: boolean }> {
  if (!isConfigured) {
    logger.warn('SIMULATION: reauthorizePayment', { authorizationId });
    const newAuthId = mockId('AUTH');
    const mock: PayPalAuthorization = {
      id: newAuthId,
      status: 'CREATED',
      amount: { currency_code: 'USD', value: '500.00' },
      create_time: nowISO(),
      update_time: nowISO(),
      expiration_time: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
      links: mockLinks(`/v2/payments/authorizations/${newAuthId}`),
    };
    return simResponse(mock);
  }

  try {
    return await paypalRequest<PayPalAuthorization>(
      'POST',
      `/v2/payments/authorizations/${authorizationId}/reauthorize`,
      {}
    );
  } catch (err: unknown) {
    return handleApiError('reauthorizePayment', err, () => {
      const newAuthId = mockId('AUTH');
      const mock: PayPalAuthorization = {
        id: newAuthId, status: 'CREATED',
        amount: { currency_code: 'USD', value: '500.00' },
        create_time: nowISO(), update_time: nowISO(),
        links: mockLinks(`/v2/payments/authorizations/${newAuthId}`),
      };
      return simResponse(mock);
    });
  }
}

export async function captureAuthorization(
  authorizationId: string,
  amount?: PayPalAmount,
  finalCapture = true
): Promise<{ data: PayPalCapture; status: number; simulated: boolean }> {
  const payload: Record<string, unknown> = { final_capture: finalCapture };
  if (amount) {
    payload.amount = amount;
  }

  if (!isConfigured) {
    logger.warn('SIMULATION: captureAuthorization', { authorizationId, amount, finalCapture });
    const captureId = mockId('CAPTURE');
    const mock: PayPalCapture = {
      id: captureId,
      status: 'COMPLETED',
      amount: amount ?? { currency_code: 'USD', value: '500.00' },
      final_capture: finalCapture,
      create_time: nowISO(),
      update_time: nowISO(),
      links: mockLinks(`/v2/payments/captures/${captureId}`),
    };
    return simResponse(mock);
  }

  try {
    return await paypalRequest<PayPalCapture>(
      'POST',
      `/v2/payments/authorizations/${authorizationId}/capture`,
      payload
    );
  } catch (err: unknown) {
    return handleApiError('captureAuthorization', err, () => {
      const captureId = mockId('CAPTURE');
      const mock: PayPalCapture = {
        id: captureId, status: 'COMPLETED',
        amount: amount ?? { currency_code: 'USD', value: '500.00' },
        final_capture: finalCapture,
        create_time: nowISO(), update_time: nowISO(),
        links: mockLinks(`/v2/payments/captures/${captureId}`),
      };
      return simResponse(mock);
    });
  }
}

export async function voidAuthorization(
  authorizationId: string
): Promise<{ data: Record<string, unknown>; status: number; simulated: boolean }> {
  if (!isConfigured) {
    logger.warn('SIMULATION: voidAuthorization', { authorizationId });
    return simResponse({ status: 'VOIDED', authorization_id: authorizationId });
  }

  try {
    return await paypalRequest<Record<string, unknown>>(
      'POST',
      `/v2/payments/authorizations/${authorizationId}/void`,
      {}
    );
  } catch (err: unknown) {
    return handleApiError('voidAuthorization', err, () =>
      simResponse({ status: 'VOIDED', authorization_id: authorizationId })
    );
  }
}

// ── Customer Disputes v1 ──

export async function makeDisputeOffer(
  disputeId: string,
  offerAmount: PayPalAmount,
  offerType: 'REFUND' | 'REFUND_WITH_RETURN' | 'REFUND_WITH_REPLACEMENT' = 'REFUND',
  note?: string
): Promise<{ data: Record<string, unknown>; status: number; simulated: boolean }> {
  const payload: Record<string, unknown> = {
    offer_type: offerType,
    offer_amount: offerAmount,
    note: note ?? 'Offer submitted via Aegis dispute resolution',
  };

  if (!isConfigured) {
    logger.warn('SIMULATION: makeDisputeOffer', { disputeId, offerAmount, offerType });
    return simResponse({
      dispute_id: disputeId,
      status: 'WAITING_FOR_BUYER_RESPONSE',
      offer: {
        seller_offered_amount: offerAmount,
        offer_type: offerType,
      },
      links: mockLinks(`/v1/customer/disputes/${disputeId}`),
    });
  }

  try {
    return await paypalRequest(
      'POST',
      `/v1/customer/disputes/${disputeId}/make-offer`,
      payload
    );
  } catch (err: unknown) {
    return handleApiError('makeDisputeOffer', err, () =>
      simResponse({
        dispute_id: disputeId,
        status: 'WAITING_FOR_BUYER_RESPONSE',
        offer: { seller_offered_amount: offerAmount, offer_type: offerType },
        links: mockLinks(`/v1/customer/disputes/${disputeId}`),
      })
    );
  }
}

export async function provideDisputeEvidence(
  disputeId: string,
  evidenceInfo: Record<string, unknown>,
  _files?: Buffer[] // multipart support placeholder
): Promise<{ data: Record<string, unknown>; status: number; simulated: boolean }> {
  if (!isConfigured) {
    logger.warn('SIMULATION: provideDisputeEvidence', { disputeId });
    return simResponse({
      dispute_id: disputeId,
      status: 'UNDER_REVIEW',
      evidence_submitted: true,
      evidence_info: evidenceInfo,
      links: mockLinks(`/v1/customer/disputes/${disputeId}`),
    });
  }

  try {
    // For multipart uploads, we need to use form-data.
    // When files are provided, they'd be sent as multipart/related.
    // For now, JSON-only evidence submission:
    return await paypalRequest(
      'POST',
      `/v1/customer/disputes/${disputeId}/provide-evidence`,
      evidenceInfo,
      _files?.length
        ? { 'Content-Type': 'multipart/related' }
        : undefined
    );
  } catch (err: unknown) {
    return handleApiError('provideDisputeEvidence', err, () =>
      simResponse({
        dispute_id: disputeId,
        status: 'UNDER_REVIEW',
        evidence_submitted: true,
        evidence_info: evidenceInfo,
        links: mockLinks(`/v1/customer/disputes/${disputeId}`),
      })
    );
  }
}

// ── Reporting / Balances v1 ──

export async function getBalances(): Promise<{
  data: PayPalBalancesResponse;
  status: number;
  simulated: boolean;
}> {
  if (!isConfigured) {
    logger.warn('SIMULATION: getBalances');
    const mock: PayPalBalancesResponse = {
      account_id: 'ACCT-SIM-DEMO',
      balances: [
        {
          currency: 'USD',
          primary: true,
          total_balance: { currency_code: 'USD', value: '12450.00' },
          available_balance: { currency_code: 'USD', value: '10200.00' },
          withheld_balance: { currency_code: 'USD', value: '2250.00' },
        },
        {
          currency: 'EUR',
          primary: false,
          total_balance: { currency_code: 'EUR', value: '3200.50' },
          available_balance: { currency_code: 'EUR', value: '3200.50' },
          withheld_balance: { currency_code: 'EUR', value: '0.00' },
        },
      ],
    };
    return simResponse(mock);
  }

  try {
    return await paypalRequest<PayPalBalancesResponse>(
      'GET',
      '/v1/reporting/balances'
    );
  } catch (err: unknown) {
    return handleApiError('getBalances', err, () => {
      const mock: PayPalBalancesResponse = {
        account_id: 'ACCT-SIM-FALLBACK',
        balances: [{
          currency: 'USD', primary: true,
          total_balance: { currency_code: 'USD', value: '12450.00' },
          available_balance: { currency_code: 'USD', value: '10200.00' },
          withheld_balance: { currency_code: 'USD', value: '2250.00' },
        }],
      };
      return simResponse(mock);
    });
  }
}

// ── Error Handler ──────────────────────────────────────────────────────

function handleApiError<T>(
  operation: string,
  err: unknown,
  fallback: () => T
): T {
  if (err instanceof Error && err.message === 'PAYPAL_NOT_CONFIGURED') {
    return fallback();
  }

  const axiosErr = err as AxiosError;
  const status = axiosErr.response?.status;
  const data = axiosErr.response?.data;
  const message = err instanceof Error ? err.message : String(err);

  logger.error(`SafeGate ${operation} failed — falling back to simulation`, {
    status,
    error: message,
    responseData: data,
  });

  return fallback();
}

// ── Aggregated SafeGate Exports ────────────────────────────────────────

export const safeGate = {
  // OAuth
  oauth: oauthManager,

  // Orders
  createOrder,
  getOrder,
  authorizeOrder,

  // Payments
  reauthorizePayment,
  captureAuthorization,
  voidAuthorization,

  // Disputes
  makeDisputeOffer,
  provideDisputeEvidence,

  // Reporting
  getBalances,

  // Tool Router
  getToolsForPhase,
  resolveToolForPhase,
  normalizeToolName,
  getAllTools,
  getWorkflowPhases,

  // HITL Gate
  interceptAction,
  approveAction,
  rejectAction,
  requiresApproval,
  getPendingApprovals,
  getAllApprovals,
  registerSocketEmitter,
  MONEY_MOVING_ACTIONS,

  // Config info
  isConfigured,
  sandboxMode: true as const, // HARDCODED: always sandbox
};

export default safeGate;
