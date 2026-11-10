import { Router, Request, Response } from 'express';
import { holdManager } from '../engines/hold-manager';
import { disputeShield } from '../engines/dispute-shield';
import { verificationService } from '../services/verification';
import { safeGate } from '../engines/safegate';
import logger from '../lib/logger';
import { store } from '../lib/store';
import { config } from '../config';
import type { Project, Milestone } from '../types';

const router = Router();

// Sample Pre-Loaded B2B Agency Statement of Work
const DEFAULT_DEMO_PROJECT: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Acme Global — Enterprise Cloud & ERP Migration',
  clientName: 'Acme Global Ventures LLC',
  clientEmail: 'procurement@acmeglobal.sandbox.com',
  description:
    'Full-lifecycle milestone delivery: Cloud Infrastructure Architecture, Custom ERP Reconciliation Module, and Production SOC2 Audit.',
  totalAmount: { currency_code: 'USD', value: '4500.00' },
  status: 'ACTIVE',
  milestones: [],
};

const DEFAULT_DEMO_MILESTONES = [
  {
    id: 'm1-cloud-arch',
    name: 'Milestone 1: Cloud Infrastructure & High-Availability Plan',
    description: 'Design and deploy multi-region VPCs, Terraform modules, and CI/CD pipelines.',
    amount: { currency_code: 'USD', value: '1250.00' },
    status: 'DRAFT' as const,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    dependencies: [],
    deliverables: [],
    evidenceDocuments: [],
    authorizationHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: 'proj-aegis-demo',
  },
  {
    id: 'm2-erp-sync',
    name: 'Milestone 2: Custom PayPal ERP Reconciliation Module',
    description: 'Develop bidirectional ledger synchronization with Orders v2 and dispute webhooks.',
    amount: { currency_code: 'USD', value: '1750.00' },
    status: 'DRAFT' as const,
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    dependencies: ['m1-cloud-arch'],
    deliverables: [],
    evidenceDocuments: [],
    authorizationHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: 'proj-aegis-demo',
  },
  {
    id: 'm3-soc2-audit',
    name: 'Milestone 3: Production SOC2 Audit & Final Sign-Off',
    description: 'Third-party penetration testing, audit trail indexing, and final sign-off.',
    amount: { currency_code: 'USD', value: '1500.00' },
    status: 'DRAFT' as const,
    dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    dependencies: ['m2-erp-sync'],
    deliverables: [],
    evidenceDocuments: [],
    authorizationHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    projectId: 'proj-aegis-demo',
  },
];

/**
 * GET /api/demo/status
 * Returns system configuration state, credentials status, and demo counters.
 */
router.get('/status', (req: Request, res: Response) => {
  const ratio = disputeShield.calculateDisputeRatio();
  res.json({
    success: true,
    data: {
      paypalConfigured: config.paypal.isConfigured,
      channel3Configured: config.channel3.isConfigured,
      elasticConfigured: config.elasticsearch.isConfigured,
      mode: config.paypal.isConfigured ? 'LIVE_SANDBOX' : 'DETERMINISTIC_SIMULATION',
      disputeRatio: ratio,
      projectsCount: store.getAllProjects().length,
      milestonesCount: store.getAllMilestones().length,
      pendingApprovalsCount: store.getPendingApprovals().length,
      activeTimersCount: store.getActiveTimers().length,
    },
  });
});

/**
 * POST /api/demo/fixtures/seed-contract
 * Judge Demo Button 1:
 * Seeds the contract into Bryntum Gantt and locks Milestone 1 in PayPal escrow hold.
 */
router.post('/fixtures/seed-contract', async (req: Request, res: Response) => {
  try {
    const projectId = 'proj-aegis-demo';
    const now = new Date();

    const project: Project = {
      ...DEFAULT_DEMO_PROJECT,
      id: projectId,
      createdAt: now,
      updatedAt: now,
      milestones: [],
    };

    store.setProject(project);

    // Seed Milestones
    for (const m of DEFAULT_DEMO_MILESTONES) {
      store.setMilestone({ ...m, projectId });
    }

    // Immediately execute Milestone 1 Escrow Hold (Step 1)
    const holdResult = await holdManager.createMilestoneHold('m1-cloud-arch');

    const updatedMilestones = store.getMilestonesByProject(projectId);
    project.milestones = updatedMilestones;
    store.setProject(project);

    logger.info('Judge Demo: Button 1 (Seed Contract & Lock Sandbox Hold) executed', {
      projectId,
      milestoneId: 'm1-cloud-arch',
      holdResult,
    });

    res.json({
      success: true,
      message: 'Contract successfully ingested into Bryntum Gantt and Milestone 1 funds locked in PayPal Escrow hold.',
      data: {
        project,
        milestones: updatedMilestones,
        holdResult,
      },
    });
  } catch (err: any) {
    logger.error('Judge Demo Button 1 failed', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/demo/fixtures/fast-forward-day3
 * Judge Demo Button 2:
 * Simulates 72-hour timer elapsing: triggers Day-3 reauthorization,
 * visibly rotates the authorization_id in AG Studio ledger, and shifts Gantt tasks if negative testing is enabled.
 */
router.post('/fixtures/fast-forward-day3', async (req: Request, res: Response) => {
  try {
    const { milestoneId = 'm1-cloud-arch', simulateNegativeTesting = false } = req.body;

    const result = await holdManager.fastForwardDay3Reauthorization(
      milestoneId,
      simulateNegativeTesting
    );

    const milestone = store.getMilestone(milestoneId);

    logger.info('Judge Demo: Button 2 (Fast-Forward Day-3 Honor Period) executed', {
      milestoneId,
      result,
      simulateNegativeTesting,
    });

    res.json({
      success: true,
      message: simulateNegativeTesting
        ? 'Simulated card-issuer reauthorization decline. Downstream Gantt tasks shifted forward.'
        : `Day-3 Honor Period renewed. authorization_id rotated from ${result.previousAuthorizationId} to ${result.newAuthorizationId}.`,
      data: {
        result,
        milestone,
        history: milestone?.authorizationHistory,
      },
    });
  } catch (err: any) {
    logger.error('Judge Demo Button 2 failed', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/demo/fixtures/verify-deliverable
 * Judge Demo Button 3:
 * Verifies milestone deliverable via Channel3 catalog spec check & Elastic kNN embedding,
 * then stages capture in the HITL approval queue.
 */
router.post('/fixtures/verify-deliverable', async (req: Request, res: Response) => {
  try {
    const { milestoneId = 'm1-cloud-arch', query = 'enterprise-cloud-architecture' } = req.body;
    const milestone = store.getMilestone(milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: 'Milestone not found' });
    }

    // 1. Channel3 Catalog Spec Verification
    const ch3Spec = await verificationService.verifyWithChannel3(query);

    // 2. Elastic kNN Vector Authenticity Verification
    const fakeBuffer = Buffer.from(`Deliverable artifact content for ${milestone.name}`);
    const elasticAuth = await verificationService.verifyDeliverableAuthenticity(
      'production_cloud_architecture_spec.pdf',
      fakeBuffer
    );

    const deliverable = {
      id: `deliv-${Date.now()}`,
      milestoneId,
      name: ch3Spec.title,
      type: 'FILE' as const,
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

    milestone.deliverables = [deliverable];
    milestone.status = 'VERIFIED';
    store.setMilestone(milestone);

    // 3. Index in Elastic Audit Vault
    await verificationService.indexAuditTrail({
      transactionId: milestone.activeAuthorizationId || milestone.id,
      buyerEmail: 'procurement@acmeglobal.sandbox.com',
      buyerName: 'Acme Global Ventures LLC',
      buyerIp: '198.51.100.42',
      downloadTimestamp: new Date().toISOString(),
      policyAccepted: true,
      deliverableSha256: elasticAuth.sha256Hash,
      imageKnnSimilarityScore: elasticAuth.knnScore,
      isAuthentic: elasticAuth.isAuthentic,
    });

    // 4. Stage capture in HITL Gate
    const hitlRes = safeGate.interceptAction(
      'CAPTURE_AUTHORIZATION',
      {
        milestoneId,
        authorizationId: milestone.activeAuthorizationId,
        amount: milestone.amount,
        finalCapture: false,
        deliverableTitle: ch3Spec.title,
        knnScore: elasticAuth.knnScore,
        channel3Sku: ch3Spec.sku,
      },
      `Approve capture of $${milestone.amount.value} for "${milestone.name}" (Channel3 SKU: ${ch3Spec.sku}, Elastic kNN: ${(elasticAuth.knnScore * 100).toFixed(1)}%)`,
      'MEDIUM',
      undefined,
      { milestoneId }
    );

    logger.info('Judge Demo: Button 3 (Verify Deliverable via Channel3 & Elastic) executed', {
      milestoneId,
      deliverableId: deliverable.id,
      hitlRequestId: hitlRes.id,
    });

    res.json({
      success: true,
      message: 'Deliverable verified with Channel3 (catalog specs) and Elastic (kNN authenticity). Capture staged in HITL Approval Queue.',
      data: {
        milestone,
        channel3Spec: ch3Spec,
        elasticVerification: elasticAuth,
        hitlRequestId: hitlRes.id,
      },
    });
  } catch (err: any) {
    logger.error('Judge Demo Button 3 failed', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/demo/fixtures/simulate-dispute
 * Judge Demo Button 4:
 * Injects a realistic SNAD dispute event at 1.42% ratio to demonstrate:
 * - 1.5% Dispute Ratio Radar
 * - Branch A: Pre-escalation make-offer ($0 fee)
 * - Branch B: Auto-compiled A4 PDF provide-evidence
 */
router.post('/fixtures/simulate-dispute', async (req: Request, res: Response) => {
  try {
    const result = await disputeShield.simulateSnadDisputeFixture(0.0142);

    logger.info('Judge Demo: Button 4 (Simulate SNAD Dispute at 1.42% Ratio) executed', {
      disputeId: result.dispute.dispute_id,
      ratio: result.triage.currentRatio.ratio,
      action: result.triage.recommendedAction,
      hitlRequestId: result.hitlRequestId,
    });

    res.json({
      success: true,
      message: 'Simulated SNAD dispute injected at 1.42% ratio. Dispute Shield triaged case and staged resolution in HITL queue.',
      data: {
        dispute: result.dispute,
        triage: result.triage,
        hitlRequestId: result.hitlRequestId,
        pdfGenerated: !!result.pdfBuffer,
      },
    });
  } catch (err: any) {
    logger.error('Judge Demo Button 4 failed', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/demo/reset
 * Resets the in-memory store to clean initial demo state.
 */
router.post('/reset', (req: Request, res: Response) => {
  store.reset();
  logger.info('Judge Demo: State reset');
  res.json({ success: true, message: 'All demo state, ledger records, and disputes reset.' });
});

export default router;

