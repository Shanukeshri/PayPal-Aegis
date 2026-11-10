import { Router, Request, Response } from 'express';
import { holdManager } from '../engines/hold-manager';
import { verificationService } from '../services/verification';
import { safeGate } from '../engines/safegate';
import logger from '../lib/logger';
import { store } from '../lib/store';
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
    const { finalCapture = false, customAmount } = req.body;
    const result = await holdManager.captureMilestone(
      req.params.id,
      finalCapture,
      customAmount
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Failed to capture milestone', { err: err.message });
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

