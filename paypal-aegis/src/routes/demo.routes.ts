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
 * Normalizes dollar amounts to enforce fail-safe positive guardrails.
 * Any non-positive (<= 0) or unparseable value is normalized to minimum $10.00.
 */
function normalizeAmount(val: any): { value: string; wasNormalized: boolean } {
  let num = typeof val === 'number' ? val : parseFloat(String(val || '0').replace(/[^0-9.-]/g, ''));
  if (isNaN(num) || num <= 0) {
    return { value: '10.00', wasNormalized: true };
  }
  return { value: num.toFixed(2), wasNormalized: false };
}

/**
 * Robust SOW text parser with fail-safe fallback.
 * If text is malformed or gibberish, triggers fallback to a single generic milestone priced at $100.00.
 */
function parseRawSow(rawText: string): {
  project: Partial<Project>;
  milestones: any[];
  isFallback: boolean;
} {
  const fallbackMilestone = {
    id: 'm1-custom-deliverable',
    name: 'Milestone 1: Custom Deliverable Delivery',
    description:
      rawText && rawText.trim().length > 0
        ? rawText.trim().slice(0, 180)
        : 'General delivery & verification phase.',
    amount: { currency_code: 'USD', value: '100.00' },
    status: 'DRAFT' as const,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    dependencies: [],
    deliverables: [],
    evidenceDocuments: [],
    authorizationHistory: [],
  };

  const fallback = {
    project: {
      name: 'Custom Contract Scope (Fail-Safe Fallback Active)',
      clientName: 'Enterprise Client LLC',
      clientEmail: 'billing@client-enterprise.sandbox.com',
      description:
        rawText && rawText.trim().length > 0
          ? rawText.trim().slice(0, 300)
          : 'Custom milestone contract delivery.',
      totalAmount: { currency_code: 'USD', value: '100.00' },
    },
    milestones: [fallbackMilestone],
    isFallback: true,
  };

  if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 8) {
    return fallback;
  }

  // Try parsing as JSON first in case user pastes JSON
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed.milestones) && parsed.milestones.length > 0) {
      const parsedMilestones = parsed.milestones.map((m: any, idx: number) => {
        const norm = normalizeAmount(m.amount?.value || m.amount);
        return {
          id: m.id || `m${idx + 1}-custom`,
          name: m.name || `Milestone ${idx + 1}`,
          description: m.description || `Custom scope deliverable for milestone ${idx + 1}`,
          amount: { currency_code: 'USD', value: norm.value },
          status: 'DRAFT' as const,
          dueDate: new Date(Date.now() + (idx + 1) * 7 * 24 * 60 * 60 * 1000),
          dependencies: idx > 0 ? [`m${idx}-custom`] : [],
          deliverables: [],
          evidenceDocuments: [],
          authorizationHistory: [],
        };
      });
      const totalVal = parsedMilestones.reduce((acc: number, m: any) => acc + parseFloat(m.amount.value), 0);
      return {
        project: {
          name: parsed.project?.name || 'Custom JSON Contract Scope',
          clientName: parsed.project?.clientName || 'Enterprise Client LLC',
          clientEmail: parsed.project?.clientEmail || 'billing@client-enterprise.sandbox.com',
          description: parsed.project?.description || 'Custom JSON contract statement of work.',
          totalAmount: { currency_code: 'USD', value: totalVal.toFixed(2) },
        },
        milestones: parsedMilestones,
        isFallback: false,
      };
    }
  } catch {
    // Continue to natural text parsing
  }

  // Parse lines for milestone patterns
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const extractedMilestones: any[] = [];
  let currentMilestone: any = null;

  for (const line of lines) {
    const isHeader = /^(?:milestone|phase|\d+[\.\):])\s*(.*?)(?::|$)/i.test(line);
    const amountMatch =
      line.match(/\$\s*([0-9,]+(?:\.[0-9]{2})?)/) || line.match(/([0-9,]+(?:\.[0-9]{2})?)\s*USD/i);

    if (isHeader || (amountMatch && !currentMilestone)) {
      if (currentMilestone && currentMilestone.name) {
        extractedMilestones.push(currentMilestone);
      }
      const amountNum = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 100.0;
      const norm = normalizeAmount(amountNum);
      const nameMatch = line.match(/^(?:milestone|phase|\d+[\.\):])\s*([^$\n-:]+)/i);
      const name =
        nameMatch && nameMatch[1].trim()
          ? `Milestone ${extractedMilestones.length + 1}: ${nameMatch[1].trim()}`
          : line.slice(0, 50);

      currentMilestone = {
        id: `m${extractedMilestones.length + 1}-custom`,
        name,
        description: line,
        amount: { currency_code: 'USD', value: norm.value },
        status: 'DRAFT' as const,
        dueDate: new Date(Date.now() + (extractedMilestones.length + 1) * 7 * 24 * 60 * 60 * 1000),
        dependencies:
          extractedMilestones.length > 0 ? [extractedMilestones[extractedMilestones.length - 1].id] : [],
        deliverables: [],
        evidenceDocuments: [],
        authorizationHistory: [],
      };
    } else if (currentMilestone) {
      currentMilestone.description += ' ' + line;
      if (amountMatch && currentMilestone.amount.value === '10.00') {
        const norm = normalizeAmount(amountMatch[1].replace(/,/g, ''));
        currentMilestone.amount.value = norm.value;
      }
    }
  }

  if (currentMilestone && currentMilestone.name) {
    extractedMilestones.push(currentMilestone);
  }

  if (extractedMilestones.length === 0) {
    // Malformed text or gibberish (e.g., "asdjkskdfjk") triggers fallback
    return fallback;
  }

  const totalVal = extractedMilestones.reduce((acc: number, m: any) => acc + parseFloat(m.amount.value), 0);
  return {
    project: {
      name: 'Custom Parsed SOW Contract',
      clientName: 'Enterprise Client LLC',
      clientEmail: 'billing@client-enterprise.sandbox.com',
      description: rawText.slice(0, 300),
      totalAmount: { currency_code: 'USD', value: totalVal.toFixed(2) },
    },
    milestones: extractedMilestones,
    isFallback: false,
  };
}

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
 * Judge Demo Button 1 & Custom Input Sandbox:
 * Ingests contract (default or custom/raw text SOW) into Bryntum Gantt,
 * applies fail-safe guardrails (normalized positive amounts, fallback on malformed text),
 * and locks Milestone 1 in PayPal escrow hold (intent: AUTHORIZE).
 */
router.post('/fixtures/seed-contract', async (req: Request, res: Response) => {
  try {
    const projectId = 'proj-aegis-demo';
    const now = new Date();
    const { customProject, customMilestones, rawSowText } = req.body || {};

    let targetMilestones: any[] = [];
    let targetProject: any = {
      ...DEFAULT_DEMO_PROJECT,
      id: projectId,
      createdAt: now,
      updatedAt: now,
    };
    let guardrailApplied = false;
    let guardrailNotice = '';

    if (rawSowText && typeof rawSowText === 'string') {
      const parsed = parseRawSow(rawSowText);
      targetMilestones = parsed.milestones.map((m) => ({ ...m, projectId, createdAt: now, updatedAt: now }));
      targetProject = { ...targetProject, ...parsed.project };
      if (parsed.isFallback) {
        guardrailApplied = true;
        guardrailNotice =
          'Malformed text or unparseable scope detected: Fallback JSON structure triggered with single generic milestone at $100.00.';
      }
    } else if (Array.isArray(customMilestones) && customMilestones.length > 0) {
      targetMilestones = customMilestones.map((m: any, idx: number) => {
        const norm = normalizeAmount(m.amount?.value || m.amount);
        if (norm.wasNormalized) {
          guardrailApplied = true;
          guardrailNotice = 'Non-positive amount detected; normalized to minimum $10.00.';
        }
        return {
          id: m.id || `m${idx + 1}-custom`,
          name: m.name || `Milestone ${idx + 1}`,
          description: m.description || `Milestone ${idx + 1} scope deliverable`,
          amount: { currency_code: 'USD', value: norm.value },
          status: 'DRAFT' as const,
          dueDate: m.dueDate ? new Date(m.dueDate) : new Date(Date.now() + (idx + 1) * 7 * 24 * 60 * 60 * 1000),
          dependencies: m.dependencies || (idx > 0 ? [`m${idx}-custom`] : []),
          deliverables: [],
          evidenceDocuments: [],
          authorizationHistory: [],
          projectId,
          createdAt: now,
          updatedAt: now,
        };
      });
      if (customProject) {
        targetProject = { ...targetProject, ...customProject };
      }
      const totalVal = targetMilestones.reduce((acc: number, m: any) => acc + parseFloat(m.amount.value), 0);
      targetProject.totalAmount = { currency_code: 'USD', value: totalVal.toFixed(2) };
    } else {
      targetMilestones = DEFAULT_DEMO_MILESTONES.map((m) => ({ ...m, projectId }));
    }

    targetProject.milestones = [];
    store.clearMilestonesByProject(projectId);
    store.setProject(targetProject);
    store.clearPendingApprovals(); // Reset any staged demo approvals from previous runs

    // Seed Milestones into memory store
    for (const m of targetMilestones) {
      store.setMilestone(m);
    }

    // Immediately execute Milestone 1 Escrow Hold (Step 1)
    const firstMilestoneId = targetMilestones[0].id;
    const holdResult = await holdManager.createMilestoneHold(firstMilestoneId);

    const updatedMilestones = store.getMilestonesByProject(projectId);
    targetProject.milestones = updatedMilestones;
    store.setProject(targetProject);
    store.clearPendingApprovals(); // Reset any staged demo approvals from previous runs

    logger.info('Judge Demo: Button 1 (Seed Contract & Lock Sandbox Hold) executed', {
      projectId,
      milestoneId: firstMilestoneId,
      holdResult,
      guardrailApplied,
    });

    res.json({
      success: true,
      message: guardrailNotice
        ? `Contract ingested with guardrails applied: ${guardrailNotice}`
        : 'Contract successfully ingested into Bryntum Gantt and Milestone 1 funds locked in PayPal Escrow hold.',
      guardrailNotice: guardrailNotice || undefined,
      guardrailApplied,
      data: {
        project: targetProject,
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
 * Judge Demo Button 3 & Custom Deliverable/SKU Playground:
 * Verifies milestone deliverable via Channel3 catalog spec check & Elastic kNN embedding,
 * supporting custom product names, custom SKUs, and uploaded filenames.
 * Then stages capture in the HITL approval queue.
 */
router.post('/fixtures/verify-deliverable', async (req: Request, res: Response) => {
  try {
    const {
      milestoneId = 'm1-cloud-arch',
      query,
      customSku,
      customTitle,
      fileName,
    } = req.body || {};

    let milestone = store.getMilestone(milestoneId);
    if (!milestone) {
      const all = store.getAllMilestones();
      if (all.length > 0) {
        milestone = all[0];
      } else {
        return res.status(404).json({ success: false, error: 'Milestone not found' });
      }
    }

    const searchQuery = query || customTitle || 'enterprise-cloud-architecture';

    // 1. Channel3 Catalog Spec Verification
    let ch3Spec = await verificationService.verifyWithChannel3(searchQuery);
    if (customTitle || customSku) {
      ch3Spec = {
        ...ch3Spec,
        title: customTitle || ch3Spec.title,
        sku: customSku || ch3Spec.sku,
      };
    }

    // 2. Elastic kNN Vector Authenticity Verification
    const deliverableFileName = fileName || 'production_cloud_architecture_spec.pdf';
    const fakeBuffer = Buffer.from(
      `Deliverable artifact content for ${milestone.name} - SKU: ${ch3Spec.sku} - File: ${deliverableFileName}`
    );
    const elasticAuth = await verificationService.verifyDeliverableAuthenticity(
      deliverableFileName,
      fakeBuffer
    );

    const deliverable = {
      id: `deliv-${Date.now()}`,
      milestoneId: milestone.id,
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
        fileName: deliverableFileName,
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
        milestoneId: milestone.id,
        authorizationId: milestone.activeAuthorizationId,
        amount: milestone.amount,
        finalCapture: false,
        deliverableTitle: ch3Spec.title,
        knnScore: elasticAuth.knnScore,
        channel3Sku: ch3Spec.sku,
        fileName: deliverableFileName,
      },
      `Approve capture of $${milestone.amount.value} for "${milestone.name}" (SKU: ${ch3Spec.sku}, Elastic kNN: ${(elasticAuth.knnScore * 100).toFixed(1)}%)`,
      'MEDIUM',
      undefined,
      { milestoneId: milestone.id }
    );

    logger.info('Judge Demo: Button 3 (Verify Deliverable via Channel3 & Elastic) executed', {
      milestoneId: milestone.id,
      deliverableId: deliverable.id,
      sku: ch3Spec.sku,
      hitlRequestId: hitlRes.id,
    });

    res.json({
      success: true,
      message: `Deliverable "${ch3Spec.title}" verified via Channel3 (${ch3Spec.sku}) & Elastic (${(elasticAuth.knnScore * 100).toFixed(1)}% kNN). Capture staged in HITL Approval Queue.`,
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
 * Judge Demo Button 4 & Custom Dispute Ratio Playground:
 * Injects a realistic SNAD dispute event with configurable sales & disputes,
 * clamps out-of-bounds dispute ratios to 100%, and activates either:
 * - Branch A: Pre-escalation make-offer ($0 fee) if <1.50%
 * - Branch B: Auto-compiled A4 PDF representment evidence bundle if >=1.50%
 */
router.post('/fixtures/simulate-dispute', async (req: Request, res: Response) => {
  try {
    const { salesCount, disputeCount, disputeAmount } = req.body || {};
    let sales = salesCount !== undefined ? parseInt(salesCount, 10) : 211;
    let disputes = disputeCount !== undefined ? parseInt(disputeCount, 10) : 3;

    if (isNaN(sales) || sales < 1) sales = 211;
    if (isNaN(disputes) || disputes < 0) disputes = 3;

    let clamped = false;
    let guardrailNotice: string | undefined = undefined;

    // Guardrail: Out-of-bounds dispute ratios (e.g., 50 disputes on 10 sales = 500%)
    // must clamp cleanly to 100% and show a "High Risk Penalty Tier Active" notice.
    if (disputes > sales) {
      disputes = sales;
      clamped = true;
      guardrailNotice = '⚠️ Out-of-bounds dispute ratio clamped cleanly to 100.00%. High Risk Penalty Tier Active.';
    }

    const normAmount = normalizeAmount(disputeAmount || '350.00');
    if (normAmount.wasNormalized) {
      guardrailNotice =
        (guardrailNotice ? guardrailNotice + ' ' : '') +
        '⚠️ Value must be positive; normalized to minimum $10.00.';
    }

    const ratio = sales > 0 ? disputes / sales : 0;
    const result = await disputeShield.simulateSnadDisputeFixture(
      ratio,
      sales,
      disputes,
      normAmount.value
    );

    logger.info('Judge Demo: Button 4 (Simulate SNAD Dispute) executed', {
      disputeId: result.dispute.dispute_id,
      ratio: result.triage.currentRatio.ratio,
      action: result.triage.recommendedAction,
      hitlRequestId: result.hitlRequestId,
      clamped,
    });

    const isHighRisk = ratio >= 0.015 || clamped;
    const branchDesc =
      result.triage.recommendedAction === 'PROVIDE_EVIDENCE'
        ? 'High Risk Penalty Tier Active (≥1.50%): Auto-compiled A4 PDF representment evidence bundle'
        : 'Low Risk Tier (<1.50%): Pre-escalation Make-Offer branch active ($0 fee)';

    res.json({
      success: true,
      message: guardrailNotice
        ? `${guardrailNotice} (${branchDesc})`
        : `Simulated SNAD dispute injected at ${(ratio * 100).toFixed(2)}% ratio (${branchDesc}).`,
      clamped,
      guardrailNotice,
      data: {
        dispute: result.dispute,
        triage: result.triage,
        hitlRequestId: result.hitlRequestId,
        pdfGenerated: !!result.pdfBuffer,
        ratio: (ratio * 100).toFixed(2) + '%',
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

/**
 * GET /api/demo/audit-logs
 * Serves the 7 mandatory E2E audit log payloads for judge verification.
 * Supports download as attachment via ?download=true
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const fs = await import('fs');
    const path = await import('path');

    const logFiles = [
      'e2e-safegate-init.log',
      'e2e-escrow-authorize.log',
      'e2e-reauthorize-rotation.log',
      'e2e-idempotency-replay.log',
      'e2e-hitl-capture.log',
      'e2e-webhook-hydration.log',
      'e2e-dispute-defense.log',
    ];

    const searchDirs = [
      path.resolve(__dirname, '../../logs'),
      path.resolve(__dirname, '../../../logs'),
      path.resolve(process.cwd(), 'logs'),
      path.resolve(process.cwd(), '../logs'),
    ];

    const results: Record<string, any> = {};

    for (const filename of logFiles) {
      let content: string | null = null;
      for (const dir of searchDirs) {
        const fullPath = path.join(dir, filename);
        if (fs.existsSync(fullPath)) {
          content = fs.readFileSync(fullPath, 'utf8');
          break;
        }
      }

      if (content) {
        try {
          results[filename] = JSON.parse(content);
        } catch {
          results[filename] = content;
        }
      } else {
        results[filename] = { status: 'PENDING_RUN', filename };
      }
    }

    if (req.query.download === 'true' || req.query.download === '1') {
      res.setHeader('Content-Disposition', 'attachment; filename="paypal-aegis-e2e-audit-logs.json"');
      res.setHeader('Content-Type', 'application/json');
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      logs: results,
      allPassed: Object.values(results).every((r: any) => r.status === 'PASS'),
    });
  } catch (err: any) {
    logger.error('Failed to load audit logs', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

