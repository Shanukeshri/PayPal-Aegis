import { Router, Request, Response } from 'express';
import { safeGate } from '../engines/safegate';
import { holdManager } from '../engines/hold-manager';
import { disputeShield } from '../engines/dispute-shield';
import logger from '../lib/logger';
import { store } from '../lib/store';

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
    const approved = safeGate.approveAction(approvalId, approver);

    res.json({
      success: true,
      data: {
        approval: approved,
        executionResult,
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
    res.json({ success: true, data: rejected });
  } catch (err: any) {
    logger.error('Failed to reject HITL action', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

