/**
 * Human-in-the-Loop Approval Gate
 *
 * Intercepts money-moving PayPal actions and gates them behind
 * manual user approval. Emits Socket.IO events for real-time UI updates.
 */

import { v4 as uuidv4 } from 'uuid';
import { store } from '../../lib/store';
import logger from '../../lib/logger';
import type { HITLApprovalRequest, HITLActionType } from '../../types';

// ── Money-Moving Actions (always require approval) ─────────────────────

export const MONEY_MOVING_ACTIONS: HITLActionType[] = [
  'CAPTURE_AUTHORIZATION',
  'CREATE_REFUND',
  'ACCEPT_DISPUTE',
  'SEND_INVOICE',
  'REAUTHORIZE',
  'MAKE_DISPUTE_OFFER',
  'PROVIDE_DISPUTE_EVIDENCE',
];

/**
 * Maps raw action strings from external callers to canonical HITLActionType.
 */
const ACTION_MAP: Record<string, HITLActionType> = {
  pay_order: 'CAPTURE_AUTHORIZATION',
  capture_authorization: 'CAPTURE_AUTHORIZATION',
  create_refund: 'CREATE_REFUND',
  accept_dispute_claim: 'ACCEPT_DISPUTE',
  send_invoice: 'SEND_INVOICE',
  capture_authorization_reauth: 'REAUTHORIZE',
  make_dispute_offer: 'MAKE_DISPUTE_OFFER',
  provide_dispute_evidence: 'PROVIDE_DISPUTE_EVIDENCE',
};

// ── Socket.IO integration ──────────────────────────────────────────────

type SocketEmitter = (event: string, data: unknown) => void;
let socketEmit: SocketEmitter | null = null;

/**
 * Registers the Socket.IO emitter so state changes are broadcast.
 * Called once during server startup.
 */
export function registerSocketEmitter(emitter: SocketEmitter): void {
  socketEmit = emitter;
  logger.info('HITL gate: Socket.IO emitter registered');
}

function emitEvent(event: string, data: unknown): void {
  if (socketEmit) {
    try {
      socketEmit(event, data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('HITL gate: Socket.IO emit failed', { event, error: message });
    }
  }
}

// ── Executor callback type ─────────────────────────────────────────────

/**
 * Function that performs the actual PayPal API call.
 * Stored alongside the approval request so it can be executed
 * after approval.
 */
export type ActionExecutor = (
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

/** In-memory executor registry (approval-id → executor fn). */
const executorRegistry = new Map<string, ActionExecutor>();

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Returns true if an action type is a money-moving action
 * that requires HITL approval.
 */
export function requiresApproval(actionType: string): boolean {
  const canonical = ACTION_MAP[actionType.toLowerCase()] ?? actionType;
  return MONEY_MOVING_ACTIONS.includes(canonical as HITLActionType);
}

/**
 * Intercepts an action and creates a pending approval request.
 *
 * @returns The created HITLApprovalRequest (status = PENDING_APPROVAL).
 */
export function interceptAction(
  type: HITLActionType,
  payload: Record<string, unknown>,
  description: string,
  riskLevel: HITLApprovalRequest['riskLevel'],
  executor?: ActionExecutor,
  options?: { milestoneId?: string; disputeId?: string; expiresInMs?: number }
): HITLApprovalRequest {
  const id = uuidv4();
  const now = new Date();

  const request: HITLApprovalRequest = {
    id,
    type,
    payload,
    description,
    riskLevel,
    milestoneId: options?.milestoneId,
    disputeId: options?.disputeId,
    requestedAt: now,
    expiresAt: options?.expiresInMs
      ? new Date(now.getTime() + options.expiresInMs)
      : undefined,
    status: 'PENDING_APPROVAL',
  };

  store.setApprovalRequest(request);
  store.addAuditEntry('HITL_INTERCEPT', {
    approvalId: id,
    type,
    riskLevel,
    description,
  });

  if (executor) {
    executorRegistry.set(id, executor);
  }

  emitEvent('hitl:pending', request);

  logger.info('HITL gate: action intercepted — awaiting approval', {
    approvalId: id,
    type,
    riskLevel,
  });

  return request;
}

/**
 * Approves a pending action request and executes the stored executor.
 *
 * @returns The updated HITLApprovalRequest with execution result.
 */
export async function approveAction(
  approvalId: string,
  approvedBy = 'user'
): Promise<HITLApprovalRequest> {
  const request = store.getApprovalRequest(approvalId);

  if (!request) {
    throw new Error(`Approval request not found: ${approvalId}`);
  }

  if (request.status !== 'PENDING_APPROVAL') {
    throw new Error(
      `Approval request ${approvalId} is not pending (status: ${request.status})`
    );
  }

  // Check expiration
  if (request.expiresAt && new Date() > request.expiresAt) {
    request.status = 'EXPIRED';
    store.setApprovalRequest(request);
    emitEvent('hitl:expired', request);
    throw new Error(`Approval request ${approvalId} has expired`);
  }

  request.status = 'APPROVED';
  request.approvedBy = approvedBy;
  request.approvedAt = new Date();

  // Execute the stored action
  const executor = executorRegistry.get(approvalId);
  if (executor) {
    try {
      request.status = 'EXECUTED';
      const result = await executor(request.payload);
      request.executionResult = result;

      store.addAuditEntry('HITL_EXECUTED', {
        approvalId,
        type: request.type,
        approvedBy,
        result,
      });

      logger.info('HITL gate: action approved and executed', {
        approvalId,
        type: request.type,
        approvedBy,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.executionError = message;
      request.status = 'APPROVED'; // Approved but execution failed

      store.addAuditEntry('HITL_EXECUTION_FAILED', {
        approvalId,
        type: request.type,
        error: message,
      });

      logger.error('HITL gate: approved action execution failed', {
        approvalId,
        error: message,
      });
    } finally {
      executorRegistry.delete(approvalId);
    }
  } else {
    // No executor — just mark as approved
    store.addAuditEntry('HITL_APPROVED', {
      approvalId,
      type: request.type,
      approvedBy,
    });

    logger.info('HITL gate: action approved (no executor registered)', {
      approvalId,
      type: request.type,
    });
  }

  store.setApprovalRequest(request);
  emitEvent('hitl:approved', request);

  return request;
}

/**
 * Rejects a pending action request.
 *
 * @returns The updated HITLApprovalRequest.
 */
export function rejectAction(
  approvalId: string,
  rejectedBy = 'user',
  reason?: string
): HITLApprovalRequest {
  const request = store.getApprovalRequest(approvalId);

  if (!request) {
    throw new Error(`Approval request not found: ${approvalId}`);
  }

  if (request.status !== 'PENDING_APPROVAL') {
    throw new Error(
      `Approval request ${approvalId} is not pending (status: ${request.status})`
    );
  }

  request.status = 'REJECTED';
  request.approvedBy = rejectedBy;
  request.approvedAt = new Date();
  if (reason) {
    request.executionError = reason;
  }

  store.setApprovalRequest(request);
  executorRegistry.delete(approvalId);

  store.addAuditEntry('HITL_REJECTED', {
    approvalId,
    type: request.type,
    rejectedBy,
    reason,
  });

  emitEvent('hitl:rejected', request);

  logger.info('HITL gate: action rejected', {
    approvalId,
    type: request.type,
    rejectedBy,
  });

  return request;
}

/**
 * Returns all pending approval requests.
 */
export function getPendingApprovals(): HITLApprovalRequest[] {
  return store.getPendingApprovals();
}

/**
 * Returns all approval requests (any status).
 */
export function getAllApprovals(): HITLApprovalRequest[] {
  return store.getAllApprovals();
}
