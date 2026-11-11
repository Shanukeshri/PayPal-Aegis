import { Router, Request, Response } from 'express';
import { safeGate } from '../engines/safegate';
import { holdManager } from '../engines/hold-manager';
import { disputeShield } from '../engines/dispute-shield';
import logger from '../lib/logger';
import { store } from '../lib/store';
import {
  publishEcosystemEvent,
  publishStateMutationDiff,
} from '../lib/ecosystem-bus';

const router = Router();

// GET /api/hitl/pending — List all pending approvals
router.get('/pending', (req: Request, res: Response) => {
  const pending = safeGate.getPendingApprovals();
  res.json({ success: true, data: pending });
});

// GET /api/hitl/all — Full audit history of approvals
router.get('/all', (req: Request, res: Response) => {
  const all = safeGate.getAllApprovals();
  res.json({ success: true, data: all });
});

// POST /api/hitl/:id/approve — Human click "Approve & Execute"
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const approvalId = req.params.id;
    const approval = store.getApprovalRequest(approvalId);
    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval request not found' });
    }

    const { approver = 'Authorized Merchant Operator' } = req.body;

    logger.info('HITL action approval triggered', {
      approvalId,
      actionType: approval.type,
      approver,
    });

    // Execute the underlying money-moving action based on type
    let executionResult: Record<string, unknown> = {};

    switch (approval.type) {
      case 'CAPTURE_AUTHORIZATION': {
        const payload = approval.payload as any;
        const result = await holdManager.captureMilestone(
          payload.milestoneId,
          payload.finalCapture || false,
          payload.amount
        );
        executionResult = result as unknown as Record<string, unknown>;
        break;
      }

      case 'REAUTHORIZE': {
        const payload = approval.payload as any;
        const result = await holdManager.executeReauthorization(payload.milestoneId);
        executionResult = result as unknown as Record<string, unknown>;
        break;
      }

      case 'VOID_AUTHORIZATION': {
        const payload = approval.payload as any;
        const result = await holdManager.voidMilestone(payload.milestoneId);
        executionResult = result as unknown as Record<string, unknown>;
        break;
      }

      case 'MAKE_DISPUTE_OFFER': {
        const payload = approval.payload as any;
        const result = await disputeShield.executeMakeOffer(
          payload.disputeId,
          payload.offer_amount,
          payload.note,
          payload.offer_type
        );
        executionResult = result as unknown as Record<string, unknown>;
        break;
      }

      case 'PROVIDE_DISPUTE_EVIDENCE': {
        const payload = approval.payload as any;
        const result = await disputeShield.executeProvideEvidence(payload.disputeId);
        executionResult = result as unknown as Record<string, unknown>;
        break;
      }

      default: {
        executionResult = { executed: true, note: 'Default action executed' };
      }
    }

    // Mark as approved in SafeGate
    const approved = await safeGate.approveAction(approvalId, approver);

    let diff = null;
    if (approval.type === 'CAPTURE_AUTHORIZATION') {
      const cap = executionResult as any;
      const amountVal = cap?.amount?.value || (approval.payload as any)?.amount?.value || '1250.00';
      publishEcosystemEvent({
        sender: 'PAYPAL_ENGINE',
        recipient: 'ALL',
        agentName: 'SafeGate HITL Firewall',
        eventType: 'CAPTURE_SETTLED',
        title: `Payment Captured ($${amountVal})`,
        message: `SafeGate approved by ${approver}. Receipt ${cap?.captureId || 'CAP-SETTLED'} generated; $${amountVal} settled to Merchant and receipt dispatched to Client.`,
        payload: {
          milestoneId: (approval.payload as any)?.milestoneId,
          captureId: cap?.captureId,
          amount: amountVal,
          approver,
        },
      });
      diff = publishStateMutationDiff({
        actionLabel: 'SafeGate HITL Capture Approved',
        actor: 'PAYPAL_ENGINE',
        agentName: 'SafeGate HITL Firewall',
        targetId: (approval.payload as any)?.milestoneId || approvalId,
        changes: [
          {
            field: 'Milestone Status',
            previousValue: 'VERIFIED (SafeGate Paused)',
            newValue: 'CAPTURED',
            badge: 'FUNDS RELEASED',
            highlightType: 'CAPTURED',
          },
          {
            field: 'Capture Receipt ID',
            previousValue: 'INTERCEPTED',
            newValue: cap?.captureId || 'CAP-SETTLED',
            badge: `+$${amountVal} USD`,
            highlightType: 'CAPTURED',
          },
        ],
        downstreamImpact:
          'Client receipt issued; Business ledger credited. Next milestone dependency unlocked in Gantt schedule.',
      });
    } else if (approval.type === 'MAKE_DISPUTE_OFFER') {
      const payload = approval.payload as any;
      const offerVal = payload?.offer_amount?.value || '350.00';
      publishEcosystemEvent({
        sender: 'BUSINESS',
        recipient: 'CLIENT',
        agentName: 'SafeGate + DisputeStrategist',
        eventType: 'OFFER_DISPATCHED',
        title: `Pre-Escalation Offer Sent ($${offerVal})`,
        message: `Merchant approved $${offerVal} settlement offer for ${payload?.disputeId || 'Dispute'} ($0 fee). Delivered to Client inbox.`,
        payload,
      });
      diff = publishStateMutationDiff({
        actionLabel: 'SafeGate Approved Pre-Escalation Settlement Offer',
        actor: 'BUSINESS',
        agentName: 'SafeGate + DisputeStrategist',
        targetId: payload?.disputeId || approvalId,
        changes: [
          {
            field: 'Dispute Status',
            previousValue: 'WAITING_FOR_SELLER_RESPONSE',
            newValue: 'WAITING_FOR_BUYER_RESPONSE',
            badge: `$${offerVal} OFFER SENT`,
            highlightType: 'SETTLED',
          },
        ],
        downstreamImpact:
          'Offer live on Client side. Client acceptance settles at $0 dispute fee.',
      });
    } else if (approval.type === 'PROVIDE_DISPUTE_EVIDENCE') {
      const payload = approval.payload as any;
      publishEcosystemEvent({
        sender: 'BUSINESS',
        recipient: 'PAYPAL_ENGINE',
        agentName: 'SafeGate + DisputeStrategist',
        eventType: 'EVIDENCE_SUBMITTED',
        title: `A4 Evidence Dispatched (${payload?.disputeId || 'Dispute'})`,
        message: `SafeGate approved multipart A4 legal PDF evidence upload to PayPal Disputes API.`,
        payload,
      });
    }

    res.json({
      success: true,
      data: {
        approval: approved,
        executionResult,
        diff,
      },
    });
  } catch (err: any) {
    logger.error('Failed to approve HITL action', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/hitl/:id/reject — Human click "Reject"
router.post('/:id/reject', (req: Request, res: Response) => {
  try {
    const approvalId = req.params.id;
    const { rejecter = 'Authorized Merchant Operator', reason } = req.body;
    const rejected = safeGate.rejectAction(approvalId, rejecter, reason);

    publishEcosystemEvent({
      sender: 'PAYPAL_ENGINE',
      recipient: 'ALL',
      agentName: 'SafeGate HITL Firewall',
      eventType: 'SAFEGATE_REJECTED',
      title: `SafeGate Blocked ${rejected.type}`,
      message: `Operator (${rejecter}) rejected execution: ${reason || 'Specification revision required'}. Escrow funds remain safely locked.`,
      payload: {
        approvalId,
        type: rejected.type,
        reason,
      },
    });

    const diff = publishStateMutationDiff({
      actionLabel: 'SafeGate Action Rejected (Fail-Closed)',
      actor: 'PAYPAL_ENGINE',
      agentName: 'SafeGate HITL Firewall',
      targetId: rejected.milestoneId || rejected.disputeId || approvalId,
      changes: [
        {
          field: 'SafeGate Queue Item',
          previousValue: 'PENDING_APPROVAL',
          newValue: 'REJECTED (Funds Protected)',
          badge: 'FAIL-CLOSED BLOCKED',
          highlightType: 'DISPUTED',
        },
      ],
      downstreamImpact:
        'Money movement blocked cleanly. Business must submit revised deliverable or settlement.',
    });

    res.json({ success: true, data: { ...rejected, diff } });
  } catch (err: any) {
    logger.error('Failed to reject HITL action', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

