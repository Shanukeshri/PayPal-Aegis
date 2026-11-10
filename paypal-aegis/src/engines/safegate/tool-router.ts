/**
 * Dynamic Tool Context Router
 *
 * Exposes only the relevant PayPal Agent Toolkit tools for the
 * current workflow phase.  Normalises naming discrepancies so
 * callers can use either singular or plural forms.
 */

import logger from '../../lib/logger';

// ── Workflow Phases ────────────────────────────────────────────────────

export type WorkflowPhase =
  | 'ESCROW_SETUP'
  | 'DELIVERY_AUDIT'
  | 'DISPUTE_DEFENSE';

// ── Tool Schema Definition ─────────────────────────────────────────────

export interface ToolSchema {
  name: string;
  description: string;
  category: string;
  paypalEndpoint?: string;
  requiredScopes?: string[];
}

// ── Canonical Tool Registry ────────────────────────────────────────────

const TOOL_REGISTRY: ToolSchema[] = [
  // Orders
  {
    name: 'create_order',
    description: 'Create a PayPal order with AUTHORIZE or CAPTURE intent',
    category: 'ORDERS',
    paypalEndpoint: 'POST /v2/checkout/orders',
    requiredScopes: ['https://uri.paypal.com/services/payments/orders'],
  },
  {
    name: 'get_order',
    description: 'Retrieve details of an existing order',
    category: 'ORDERS',
    paypalEndpoint: 'GET /v2/checkout/orders/{id}',
  },
  {
    name: 'authorize_order',
    description: 'Authorize an approved order',
    category: 'ORDERS',
    paypalEndpoint: 'POST /v2/checkout/orders/{id}/authorize',
    requiredScopes: ['https://uri.paypal.com/services/payments/orders'],
  },
  {
    name: 'capture_order',
    description: 'Capture payment for an approved order',
    category: 'ORDERS',
    paypalEndpoint: 'POST /v2/checkout/orders/{id}/capture',
    requiredScopes: ['https://uri.paypal.com/services/payments/orders'],
  },

  // Payments / Authorizations
  {
    name: 'capture_authorization',
    description: 'Capture an authorized payment',
    category: 'PAYMENTS',
    paypalEndpoint: 'POST /v2/payments/authorizations/{id}/capture',
    requiredScopes: ['https://uri.paypal.com/services/payments/payment'],
  },
  {
    name: 'reauthorize_payment',
    description: 'Reauthorize an expiring authorization (Day-3 honor window)',
    category: 'PAYMENTS',
    paypalEndpoint: 'POST /v2/payments/authorizations/{id}/reauthorize',
    requiredScopes: ['https://uri.paypal.com/services/payments/payment'],
  },
  {
    name: 'void_authorization',
    description: 'Void an authorization that is no longer needed',
    category: 'PAYMENTS',
    paypalEndpoint: 'POST /v2/payments/authorizations/{id}/void',
    requiredScopes: ['https://uri.paypal.com/services/payments/payment'],
  },

  // Invoicing
  {
    name: 'send_invoice',
    description: 'Create and send a PayPal invoice',
    category: 'INVOICING',
    paypalEndpoint: 'POST /v2/invoicing/invoices/{id}/send',
    requiredScopes: ['https://uri.paypal.com/services/invoicing'],
  },

  // Products / Catalog
  {
    name: 'list_products',
    description: 'List products in the catalog',
    category: 'CATALOG',
    paypalEndpoint: 'GET /v1/catalogs/products',
  },
  {
    name: 'create_product',
    description: 'Create a new product in the catalog',
    category: 'CATALOG',
    paypalEndpoint: 'POST /v1/catalogs/products',
  },

  // Disputes
  {
    name: 'list_disputes',
    description: 'List disputes with optional filters',
    category: 'DISPUTES',
    paypalEndpoint: 'GET /v1/customer/disputes',
    requiredScopes: ['https://uri.paypal.com/services/disputes/read-seller'],
  },
  {
    name: 'get_dispute',
    description: 'Get dispute details',
    category: 'DISPUTES',
    paypalEndpoint: 'GET /v1/customer/disputes/{id}',
    requiredScopes: ['https://uri.paypal.com/services/disputes/read-seller'],
  },
  {
    name: 'make_dispute_offer',
    description: 'Make a settlement offer on a dispute',
    category: 'DISPUTES',
    paypalEndpoint: 'POST /v1/customer/disputes/{id}/make-offer',
    requiredScopes: ['https://uri.paypal.com/services/disputes/update-seller'],
  },
  {
    name: 'provide_dispute_evidence',
    description: 'Upload evidence for a dispute (multipart)',
    category: 'DISPUTES',
    paypalEndpoint: 'POST /v1/customer/disputes/{id}/provide-evidence',
    requiredScopes: ['https://uri.paypal.com/services/disputes/update-seller'],
  },
  {
    name: 'accept_dispute_claim',
    description: 'Accept the buyer claim and issue refund',
    category: 'DISPUTES',
    paypalEndpoint: 'POST /v1/customer/disputes/{id}/accept-claim',
    requiredScopes: ['https://uri.paypal.com/services/disputes/update-seller'],
  },

  // Reporting
  {
    name: 'get_balances',
    description: 'Retrieve current account balances',
    category: 'REPORTING',
    paypalEndpoint: 'GET /v1/reporting/balances',
  },

  // Refunds
  {
    name: 'create_refund',
    description: 'Refund a captured payment',
    category: 'REFUNDS',
    paypalEndpoint: 'POST /v2/payments/captures/{id}/refund',
    requiredScopes: ['https://uri.paypal.com/services/payments/refund'],
  },
];

// ── Phase → Tool Mapping ───────────────────────────────────────────────

const PHASE_TOOLS: Record<WorkflowPhase, string[]> = {
  ESCROW_SETUP: [
    'create_order',
    'authorize_order',
    'list_products',
    'send_invoice',
  ],
  DELIVERY_AUDIT: [
    'get_order',
    'capture_authorization',
    'reauthorize_payment',
    'void_authorization',
  ],
  DISPUTE_DEFENSE: [
    'list_disputes',
    'get_dispute',
    'make_dispute_offer',
    'provide_dispute_evidence',
  ],
};

// ── Naming Normalisation ───────────────────────────────────────────────

/** Maps common naming variants → canonical name. */
const NAME_ALIASES: Record<string, string> = {
  // Plural / singular mismatches
  list_product: 'list_products',
  list_dispute: 'list_disputes',
  // Alternate verb forms
  pay_order: 'capture_order',
  refund_payment: 'create_refund',
  accept_claim: 'accept_dispute_claim',
  offer_dispute: 'make_dispute_offer',
  upload_evidence: 'provide_dispute_evidence',
  get_balance: 'get_balances',
  void_auth: 'void_authorization',
  capture_auth: 'capture_authorization',
  reauthorize: 'reauthorize_payment',
};

/**
 * Normalises a tool name by resolving known aliases.
 */
export function normalizeToolName(name: string): string {
  const lowered = name.toLowerCase().trim();
  return NAME_ALIASES[lowered] ?? lowered;
}

// ── Router API ─────────────────────────────────────────────────────────

/**
 * Returns the filtered list of tool schemas available for a given
 * workflow phase.
 */
export function getToolsForPhase(phase: WorkflowPhase): ToolSchema[] {
  const toolNames = PHASE_TOOLS[phase];
  if (!toolNames) {
    logger.warn('Unknown workflow phase requested', { phase });
    return [];
  }

  const tools = toolNames
    .map((name) => TOOL_REGISTRY.find((t) => t.name === name))
    .filter((t): t is ToolSchema => t !== undefined);

  logger.debug('Tool router: resolved tools for phase', {
    phase,
    toolCount: tools.length,
    tools: tools.map((t) => t.name),
  });

  return tools;
}

/**
 * Resolves a (possibly aliased) tool name and verifies it is allowed
 * in the given phase.
 *
 * @returns The canonical ToolSchema, or null if not found / not allowed.
 */
export function resolveToolForPhase(
  rawName: string,
  phase: WorkflowPhase
): ToolSchema | null {
  const canonical = normalizeToolName(rawName);
  const allowedNames = PHASE_TOOLS[phase];

  if (!allowedNames?.includes(canonical)) {
    logger.warn('Tool not permitted in current phase', {
      rawName,
      canonical,
      phase,
      allowed: allowedNames,
    });
    return null;
  }

  return TOOL_REGISTRY.find((t) => t.name === canonical) ?? null;
}

/**
 * Returns all available workflow phases.
 */
export function getWorkflowPhases(): WorkflowPhase[] {
  return Object.keys(PHASE_TOOLS) as WorkflowPhase[];
}

/**
 * Returns the full canonical tool registry (all phases).
 */
export function getAllTools(): ToolSchema[] {
  return [...TOOL_REGISTRY];
}
