import { Router, Request, Response } from 'express';
import { holdManager } from '../engines/hold-manager';
import { disputeShield } from '../engines/dispute-shield';
import { verificationService } from '../services/verification';
import { runDisputeStrategistAgent } from '../services/agents';
import { safeGate } from '../engines/safegate';
import logger from '../lib/logger';
import { store } from '../lib/store';
import {
  publishEcosystemEvent,
  publishStateMutationDiff,
  emitAgentState,
} from '../lib/ecosystem-bus';
import type { Milestone, Project, Deliverable } from '../types';

const router = Router();

// GET /api/escrow/projects — List all projects
router.get('/projects', (req: Request, res: Response) => {
  const projects = store.getAllProjects();
  res.json({ success: true, data: projects });
});

// GET /api/escrow/milestones — List all milestones
router.get('/milestones', (req: Request, res: Response) => {
  const milestones = store.getAllMilestones();
  res.json({ success: true, data: milestones });
});

// GET /api/escrow/milestones/:id — Single milestone
router.get('/milestones/:id', (req: Request, res: Response) => {
  const milestone = store.getMilestone(req.params.id);
  if (!milestone) {
    return res.status(404).json({ success: false, error: 'Milestone not found' });
  }
  res.json({ success: true, data: milestone });
});

// POST /api/escrow/milestones/:id/hold — Lock funds (Step 1)
router.post('/milestones/:id/hold', async (req: Request, res: Response) => {
  try {
    const result = await holdManager.createMilestoneHold(req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Failed to create milestone hold', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/escrow/milestones/:id/authorize-approved — Finalize live Sandbox auth after buyer checkout approval
router.post('/milestones/:id/authorize-approved', async (req: Request, res: Response) => {
  try {
    const result = await holdManager.completeApprovedAuthorization(req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Failed to complete approved milestone authorization', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/escrow/milestones/:id/reauthorize — Execute Day-3 Reauthorization
router.post('/milestones/:id/reauthorize', async (req: Request, res: Response) => {
  try {
    const { simulateFailure } = req.body;
    const result = await holdManager.executeReauthorization(req.params.id, simulateFailure);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Failed to execute reauthorization', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/escrow/milestones/:id/fast-forward — Judge Demo Fast-Forward Day-3
router.post('/milestones/:id/fast-forward', async (req: Request, res: Response) => {
  try {
    const { simulateNegativeTesting } = req.body;
    const result = await holdManager.fastForwardDay3Reauthorization(
      req.params.id,
      simulateNegativeTesting
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Fast-forward reauthorization failed', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/escrow/milestones/:id/capture — Evidence-gated capture
router.post('/milestones/:id/capture', async (req: Request, res: Response) => {
  try {
    const { finalCapture = false, customAmount } = req.body || {};
    const prevMilestone = store.getMilestone(req.params.id);
    const prevStatus = prevMilestone?.status || 'VERIFIED';

    const result = await holdManager.captureMilestone(
      req.params.id,
      finalCapture,
      customAmount
    );

    publishEcosystemEvent({
      sender: 'PAYPAL_ENGINE',
      recipient: 'ALL',
      agentName: 'SafeGate HITL',
      eventType: 'CAPTURE_SETTLED',
      title: `Payment Captured ($${result.amount.value})`,
      message: `Capture ${result.captureId} settled $${result.amount.value} USD to Merchant balance; official tax receipt issued to Buyer.`,
      payload: {
        milestoneId: req.params.id,
        captureId: result.captureId,
        amount: result.amount.value,
      },
    });

    const diff = publishStateMutationDiff({
      actionLabel: 'SafeGate Capture Executed',
      actor: 'PAYPAL_ENGINE',
      agentName: 'SafeGate HITL',
      targetId: req.params.id,
      changes: [
        {
          field: 'Milestone Status',
          previousValue: prevStatus,
          newValue: 'CAPTURED',
          badge: 'FUNDS SETTLED',
          highlightType: 'CAPTURED',
        },
        {
          field: 'Capture Receipt ID',
          previousValue: 'PENDING_APPROVAL',
          newValue: result.captureId,
          badge: `+$${result.amount.value}`,
          highlightType: 'CAPTURED',
        },
      ],
      downstreamImpact:
        'Escrow funds released to Business balance. Next dependent milestone is now unlocked in Bryntum Gantt.',
    });

    res.json({ success: true, data: { ...result, diff } });
  } catch (err: any) {
    logger.error('Failed to capture milestone', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/escrow/milestones/:id/client-approve — Client approves deliverable & releases escrow
router.post('/milestones/:id/client-approve', async (req: Request, res: Response) => {
  try {
    const milestoneId = req.params.id;
    let milestone = store.getMilestone(milestoneId);
    if (!milestone) {
      const first = store.getAllMilestones()[0];
      if (!first) {
        return res.status(404).json({ success: false, error: 'Milestone not found' });
      }
      milestone = first;
    }

    const prevStatus = milestone.status;
    if (milestone.status === 'CAPTURED') {
      return res.json({
        success: true,
        message: 'Milestone already captured & settled.',
        data: { milestone },
      });
    }

    milestone.clientApprovedAt = new Date().toISOString();
    store.setMilestone(milestone);

    // Resolve any pending CAPTURE_AUTHORIZATION HITL item cleanly
    const pendingCapture = store
      .getPendingApprovals()
      .find((r) => r.type === 'CAPTURE_AUTHORIZATION' && (!r.milestoneId || r.milestoneId === milestone!.id));

    const captureResult = await holdManager.captureMilestone(milestone.id, false);
    if (pendingCapture) {
      await safeGate.approveAction(pendingCapture.id, 'Client Sign-Off (Acme Global) + SafeGate');
    }

    const updated = store.getMilestone(milestone.id);

    publishEcosystemEvent({
      sender: 'CLIENT',
      recipient: 'ALL',
      agentName: 'Client Portal + SafeGate HITL',
      eventType: 'CAPTURE_SETTLED',
      title: `Client Approved Deliverable & Released $${captureResult.amount.value}`,
      message: `Acme Global Ventures signed off on deliverable & authorized capture ${captureResult.captureId}. $${captureResult.amount.value} settled to Aegis Dev Studio.`,
      payload: {
        milestoneId: milestone.id,
        captureId: captureResult.captureId,
        amount: captureResult.amount.value,
      },
    });

    const diff = publishStateMutationDiff({
      actionLabel: 'Client Deliverable Approval & Escrow Release',
      actor: 'CLIENT',
      agentName: 'Client Portal + SafeGate HITL',
      targetId: milestone.id,
      changes: [
        {
          field: 'Milestone Status',
          previousValue: prevStatus,
          newValue: 'CAPTURED',
          badge: 'CLIENT APPROVED',
          highlightType: 'CAPTURED',
        },
        {
          field: 'PayPal Capture ID',
          previousValue: 'ESCROW_HELD',
          newValue: captureResult.captureId,
          badge: `$${captureResult.amount.value} SETTLED`,
          highlightType: 'CAPTURED',
        },
      ],
      downstreamImpact:
        'Client confirmed deliverable acceptance. SafeGate queue cleared and Milestone 2 unlocked in Gantt timeline.',
    });

    res.json({
      success: true,
      message: `Client approved deliverable. $${captureResult.amount.value} captured (${captureResult.captureId}).`,
      data: {
        milestone: updated,
        captureResult,
        diff,
      },
    });
  } catch (err: any) {
    logger.error('Client deliverable approval failed', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/escrow/milestones/:id/client-dispute — Client raises live SNAD dispute inquiry
router.post('/milestones/:id/client-dispute', async (req: Request, res: Response) => {
  try {
    const milestoneId = req.params.id;
    const {
      reason = 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
      message = 'The milestone deliverables did not match the agreed technical specifications.',
      disputeAmount = '350.00',
    } = req.body || {};

    const prevRatio = disputeShield.calculateDisputeRatio();
    const prevRatioPct = (prevRatio.ratio * 100).toFixed(2) + '%';

    // Default demo baseline: 3 disputes / 211 sales = 1.42% (approaching 1.5% cliff)
    const sales = Math.max(prevRatio.totalSales90d, 211);
    const targetDisputes = prevRatio.totalDisputes90d < 3 ? 3 : prevRatio.totalDisputes90d + 1;
    const ratio = targetDisputes / sales;

    const result = await disputeShield.simulateSnadDisputeFixture(
      ratio,
      sales,
      targetDisputes,
      String(disputeAmount)
    );

    if (result.dispute) {
      result.dispute.reason = reason;
      if (result.dispute.messages && result.dispute.messages[0]) {
        result.dispute.messages[0].content = message;
      }
      store.setDispute(result.dispute);
    }

    emitAgentState('DisputeStrategist', 'DISPUTE_RESOLUTION', 'THINKING');
    try {
      await runDisputeStrategistAgent({
        disputeId: result.dispute.dispute_id,
        disputeReason: result.dispute.reason,
        stage: result.dispute.dispute_life_cycle_stage,
        currentRatio: ratio,
        thresholdProximity: ratio / 0.015,
        amount: result.dispute.dispute_amount,
      });
      await verificationService.searchAuditTrailByTransaction(result.dispute.dispute_id);
    } catch (agentErr: any) {
      logger.warn('DisputeStrategistAgent note', { error: agentErr.message });
    }
    emitAgentState('DisputeStrategist', 'DISPUTE_RESOLUTION', 'COMPLETED');

    const newRatioPct = (ratio * 100).toFixed(2) + '%';

    publishEcosystemEvent({
      sender: 'CLIENT',
      recipient: 'BUSINESS',
      agentName: 'DisputeStrategist (1.5% Shield)',
      eventType: 'DISPUTE_OPENED',
      title: `Client Opened Dispute Inquiry (${result.dispute.dispute_id})`,
      message: `Acme Global raised a $${disputeAmount} inquiry on ${milestoneId}: "${message}". Rolling ratio jumped to ${newRatioPct} (Cliff: 1.50%).`,
      payload: {
        disputeId: result.dispute.dispute_id,
        milestoneId,
        ratio: newRatioPct,
        amount: disputeAmount,
      },
    });

    const diff = publishStateMutationDiff({
      actionLabel: 'Client Raised Pre-Escalation Inquiry',
      actor: 'CLIENT',
      agentName: 'DisputeStrategist (1.5% Shield)',
      targetId: result.dispute.dispute_id,
      changes: [
        {
          field: '90-Day Dispute Ratio',
          previousValue: prevRatioPct,
          newValue: newRatioPct,
          badge: ratio >= 0.015 ? '$30 PENALTY TIER' : 'APPROACHING 1.5% CLIFF',
          highlightType: 'DISPUTED',
        },
        {
          field: 'Dispute Status',
          previousValue: 'NONE',
          newValue: 'INQUIRY (WAITING_FOR_SELLER_RESPONSE)',
          badge: 'BRANCH A: $0 FEE MAKE-OFFER',
          highlightType: 'DISPUTED',
        },
      ],
      downstreamImpact:
        'Business alerted immediately. Pre-escalation $350.00 settlement staged to prevent $30.00 non-refundable chargeback tier.',
    });

    res.json({
      success: true,
      message: `Client raised inquiry ${result.dispute.dispute_id}. Dispute ratio now ${newRatioPct}.`,
      data: {
        ...result,
        ratio: newRatioPct,
        diff,
      },
    });
  } catch (err: any) {
    logger.error('Client dispute creation failed', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/escrow/milestones/:id/void — Void hold immediately
router.post('/milestones/:id/void', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const result = await holdManager.voidMilestone(req.params.id, reason);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Failed to void milestone', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/escrow/milestones/:id/deliverable — Upload & verify completion artifact
router.post('/milestones/:id/deliverable', async (req: Request, res: Response) => {
  try {
    const milestoneId = req.params.id;
    const milestone = store.getMilestone(milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: 'Milestone not found' });
    }

    const { name, query, isStockMock = false } = req.body;
    const deliverableName = name || 'Milestone Deliverable Archive';
    const filename = isStockMock ? 'stock_photo_shutterstock.jpg' : 'milestone_deliverable_proof.png';

    // 1. Channel3 Catalog Spec Verification
    const ch3Spec = await verificationService.verifyWithChannel3(query || milestone.name);

    // 2. Elastic kNN Vector Authenticity Verification
    const fakeBuffer = Buffer.from(`Deliverable artifact content for milestone ${milestoneId} - ${Date.now()}`);
    const elasticAuth = await verificationService.verifyDeliverableAuthenticity(filename, fakeBuffer);

    const deliverable: Deliverable = {
      id: `deliv-${Date.now()}`,
      milestoneId,
      name: deliverableName,
      type: 'FILE',
      sha256Hash: elasticAuth.sha256Hash,
      uploadedAt: new Date(),
      verified: elasticAuth.isAuthentic,
      verificationDetails: {
        channel3Verified: ch3Spec.verified,
        channel3SkuMatch: ch3Spec.sku,
        elasticKnnScore: elasticAuth.knnScore,
        isStockPhoto: elasticAuth.isStockPhoto,
        featureVector: elasticAuth.featureVector.slice(0, 16),
        cosineSimilarityMath: elasticAuth.cosineSimilarityMath,
        verifiedAt: new Date(),
      },
    };

    if (!milestone.deliverables) {
      milestone.deliverables = [];
    }
    milestone.deliverables.push(deliverable);
    milestone.status = 'VERIFIED';
    store.setMilestone(milestone);

    // 3. Index into Elastic Audit Vault
    await verificationService.indexAuditTrail({
      transactionId: milestone.activeAuthorizationId || milestone.id,
      buyerEmail: 'client.enterprise@sandbox.paypal.com',
      buyerName: 'Acme Global Ventures LLC',
      buyerIp: '198.51.100.42',
      downloadTimestamp: new Date().toISOString(),
      policyAccepted: true,
      deliverableSha256: elasticAuth.sha256Hash,
      imageKnnSimilarityScore: elasticAuth.knnScore,
      isAuthentic: elasticAuth.isAuthentic,
      featureVector: elasticAuth.featureVector,
      cosineMath: elasticAuth.cosineSimilarityMath,
    });

    // 4. Stage capture in HITL Gate!
    const hitlRes = safeGate.interceptAction(
      'CAPTURE_AUTHORIZATION',
      {
        milestoneId,
        authorizationId: milestone.activeAuthorizationId,
        amount: milestone.amount,
        finalCapture: false,
        deliverableId: deliverable.id,
        knnScore: elasticAuth.knnScore,
        skuMatch: ch3Spec.sku,
      },
      `Approve capture of $${milestone.amount.value} for milestone "${milestone.name}" (Channel3 & Elastic Verified)`,
      'MEDIUM',
      undefined,
      { milestoneId }
    );

    res.json({
      success: true,
      data: {
        deliverable,
        channel3Spec: ch3Spec,
        elasticVerification: elasticAuth,
        hitlRequestId: hitlRes.id,
      },
    });
  } catch (err: any) {
    logger.error('Failed to verify deliverable', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

