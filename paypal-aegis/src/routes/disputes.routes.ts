import { Router, Request, Response } from 'express';
import { disputeShield } from '../engines/dispute-shield';
import { safeGate } from '../engines/safegate';
import { compileRagEvidenceForDispute } from '../services/disputes';
import logger from '../lib/logger';
import { store } from '../lib/store';
import {
  publishEcosystemEvent,
  publishStateMutationDiff,
} from '../lib/ecosystem-bus';

const router = Router();

// GET /api/disputes/telemetry/rag — Latest Elasticsearch RAG Query Trace
router.get('/telemetry/rag', (req: Request, res: Response) => {
  const telemetry = store.getLatestRagTelemetry();
  res.json({ success: true, data: telemetry });
});

// GET /api/disputes/telemetry/agent — Latest Agent Tool-Calling Trace
router.get('/telemetry/agent', (req: Request, res: Response) => {
  const telemetry = store.getLatestAgentTelemetry();
  res.json({ success: true, data: telemetry });
});

// GET /api/disputes — List all disputes
router.get('/', (req: Request, res: Response) => {
  const disputes = store.getAllDisputes();
  res.json({ success: true, data: disputes });
});

// GET /api/disputes/ratio — Rolling 90-day dispute ratio radar
router.get('/ratio', (req: Request, res: Response) => {
  const ratio = disputeShield.calculateDisputeRatio();
  const history = store.getDisputeRatioHistory();
  res.json({
    success: true,
    data: {
      current: ratio,
      history,
    },
  });
});

// GET /api/disputes/:id — Single dispute with triage details
router.get('/:id', async (req: Request, res: Response) => {
  const dispute = store.getDispute(req.params.id);
  if (!dispute) {
    return res.status(404).json({ success: false, error: 'Dispute not found' });
  }

  const triage = store.getDisputeTriageResult(req.params.id) || (await disputeShield.triageDispute(dispute));
  res.json({ success: true, data: { dispute, triage } });
});

// POST /api/disputes/:id/make-offer — Settle inquiry at $0 fee
router.post('/:id/make-offer', async (req: Request, res: Response) => {
  try {
    const disputeId = req.params.id;
    const rawOffer = req.body?.offerAmount;
    const offerAmount =
      rawOffer && typeof rawOffer === 'object' && 'value' in rawOffer
        ? {
            currency_code: String(rawOffer.currency_code || 'USD'),
            value: String(rawOffer.value || '350.00'),
          }
        : {
            currency_code: 'USD',
            value: String(rawOffer || '350.00'),
          };
    const note = req.body?.note || 'Pre-escalation settlement offer ($0 dispute fee)';
    const offerType = req.body?.offerType || 'REFUND';

    const prevDispute = store.getDispute(disputeId);
    const prevStatus = prevDispute?.status || 'WAITING_FOR_SELLER_RESPONSE';

    const result = await disputeShield.executeMakeOffer(
      disputeId,
      offerAmount,
      note,
      offerType
    );

    const dispute = store.getDispute(disputeId);
    if (dispute) {
      dispute.status = 'WAITING_FOR_BUYER_RESPONSE';
      dispute.offer = {
        seller_offered_amount: offerAmount,
        offer_type: offerType,
      };
      dispute.messages = dispute.messages || [];
      dispute.messages.push({
        posted_by: 'SELLER',
        content: `Pre-escalation settlement offered: $${offerAmount.value} ${offerAmount.currency_code} instant refund ($0 dispute fee).`,
        time_posted: new Date().toISOString(),
      });
      dispute.update_time = new Date().toISOString();
      store.setDispute(dispute);
    }

    // Clear pending MAKE_DISPUTE_OFFER HITL item if present
    const pendingOffer = store
      .getPendingApprovals()
      .find((r) => r.type === 'MAKE_DISPUTE_OFFER');
    if (pendingOffer) {
      await safeGate.approveAction(pendingOffer.id, 'Merchant Dispute Defense Dispatch');
    }

    publishEcosystemEvent({
      sender: 'BUSINESS',
      recipient: 'CLIENT',
      agentName: 'DisputeStrategist (Branch A: $0 Fee)',
      eventType: 'OFFER_DISPATCHED',
      title: `Pre-Escalation Offer Sent ($${offerAmount.value})`,
      message: `Aegis Dev Studio proposed $${offerAmount.value} instant refund to resolve ${disputeId} amicably ($0 dispute fee). Action waiting on Client.`,
      payload: {
        disputeId,
        offerAmount,
        offerType,
      },
    });

    const diff = publishStateMutationDiff({
      actionLabel: 'Merchant Dispatched Pre-Escalation Settlement Offer',
      actor: 'BUSINESS',
      agentName: 'DisputeStrategist (Branch A)',
      targetId: disputeId,
      changes: [
        {
          field: 'Dispute Status',
          previousValue: prevStatus,
          newValue: 'WAITING_FOR_BUYER_RESPONSE',
          badge: '$0 FEE OFFER ACTIVE',
          highlightType: 'SETTLED',
        },
        {
          field: 'Seller Offer',
          previousValue: 'NONE',
          newValue: `$${offerAmount.value} ${offerAmount.currency_code} REFUND`,
          badge: 'CLIENT ACTION READY',
          highlightType: 'SETTLED',
        },
      ],
      downstreamImpact:
        'Offer delivered to Client Buyer Portal. Once Client accepts, inquiry closes immediately with $0 penalty and restores 90-day dispute ratio.',
    });

    res.json({ success: true, data: { ...result, dispute, diff } });
  } catch (err: any) {
    logger.error('Failed to execute make-offer', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// Shared handler for POST /api/disputes/:id/accept-offer and /resolve
async function handleClientAcceptOffer(req: Request, res: Response) {
  try {
    const disputeId = req.params.id;
    let dispute = store.getDispute(disputeId);

    const prevRatio = disputeShield.calculateDisputeRatio();
    const prevRatioPct = (prevRatio.ratio * 100).toFixed(2) + '%';

    const settlementVal =
      req.body?.settlementAmount ||
      dispute?.offer?.seller_offered_amount?.value ||
      dispute?.dispute_amount?.value ||
      '350.00';

    if (!dispute) {
      dispute = {
        dispute_id: disputeId,
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString(),
        status: 'WAITING_FOR_SELLER_RESPONSE',
        reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
        dispute_amount: { currency_code: 'USD', value: String(settlementVal) },
        dispute_life_cycle_stage: 'INQUIRY',
        dispute_channel: 'INTERNAL',
        messages: [],
        links: [],
      };
    }

    const prevStatus = dispute.status;

    if (prevStatus !== 'RESOLVED') {
      dispute.status = 'RESOLVED';
      dispute.update_time = new Date().toISOString();
      dispute.offer = {
        buyer_requested_amount: { currency_code: 'USD', value: String(settlementVal) },
        seller_offered_amount: { currency_code: 'USD', value: String(settlementVal) },
        offer_type: 'REFUND',
      };
      dispute.messages = dispute.messages || [];
      dispute.messages.push(
        {
          posted_by: 'BUYER',
          content: `Accepted $${settlementVal} USD pre-escalation settlement offer.`,
          time_posted: new Date().toISOString(),
        },
        {
          posted_by: 'ARBITER',
          content: `Inquiry ${disputeId} resolved at $0.00 dispute fee. Instant credit issued to buyer; formal chargeback prevented.`,
          time_posted: new Date().toISOString(),
        }
      );
      store.setDispute(dispute);

      // Decrement rolling 90d dispute counter (e.g. 3/211 = 1.42% -> 2/211 = 0.95% Safe Tier)
      store.decrementDisputes(1);
    }

    // Clear any pending dispute HITL requests
    const pendingDisputeHitl = store
      .getPendingApprovals()
      .filter((r) => r.type === 'MAKE_DISPUTE_OFFER' || r.type === 'PROVIDE_DISPUTE_EVIDENCE');
    for (const item of pendingDisputeHitl) {
      await safeGate.approveAction(item.id, 'Client Offer Acceptance Auto-Close');
    }

    const updatedRatio = disputeShield.calculateDisputeRatio();
    const newRatioPct = (updatedRatio.ratio * 100).toFixed(2) + '%';

    store.addAuditEntry('DISPUTE_OFFER_ACCEPTED_BY_CLIENT', {
      disputeId,
      settlementVal,
      previousRatio: prevRatioPct,
      restoredRatio: newRatioPct,
      feeIncurred: '$0.00',
    });

    publishEcosystemEvent({
      sender: 'CLIENT',
      recipient: 'ALL',
      agentName: 'Client Portal + DisputeStrategist',
      eventType: 'OFFER_ACCEPTED',
      title: `Client Accepted $${settlementVal} Settlement — Ratio Restored (${newRatioPct})`,
      message: `Acme Global accepted $${settlementVal} instant refund ($0 dispute fee). Inquiry ${disputeId} RESOLVED; rolling 90-day dispute ratio dropped from ${prevRatioPct} to ${newRatioPct} (Safe Tier).`,
      payload: {
        disputeId,
        settlementAmount: settlementVal,
        previousRatio: prevRatioPct,
        restoredRatio: newRatioPct,
        feeSaved: '$30.00',
      },
    });

    const diff = publishStateMutationDiff({
      actionLabel: 'Client Accepted Pre-Escalation Settlement ($0 Fee)',
      actor: 'CLIENT',
      agentName: 'DisputeStrategist (1.5% Shield)',
      targetId: disputeId,
      changes: [
        {
          field: '90-Day Dispute Ratio',
          previousValue: prevRatioPct,
          newValue: `${newRatioPct} (${updatedRatio.totalDisputes90d}/${updatedRatio.totalSales90d})`,
          badge: 'SAFE TIER RESTORED',
          highlightType: 'SAFE',
        },
        {
          field: 'Dispute Status',
          previousValue: prevStatus,
          newValue: 'RESOLVED ($0.00 Fee)',
          badge: 'SAVED $30 CLIFF',
          highlightType: 'SETTLED',
        },
      ],
      downstreamImpact: `Pre-escalation settlement avoided $30.00 High-Volume fee cliff. Buyer credited $${settlementVal} instantly; Business health restored to ${newRatioPct}.`,
    });

    res.json({
      success: true,
      message: `Settlement accepted. Dispute ${disputeId} resolved at $0 fee; dispute ratio restored to ${newRatioPct}.`,
      data: {
        dispute,
        ratio: updatedRatio,
        diff,
      },
    });
  } catch (err: any) {
    logger.error('Failed to accept dispute offer', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
}

router.post('/:id/accept-offer', handleClientAcceptOffer);
router.post('/:id/resolve', handleClientAcceptOffer);

// POST /api/disputes/:id/provide-evidence — Multipart PDF evidence submission
router.post('/:id/provide-evidence', async (req: Request, res: Response) => {
  try {
    const disputeId = req.params.id;
    const { metadata } = req.body || {};
    const prevStatus = store.getDispute(disputeId)?.status || 'WAITING_FOR_SELLER_RESPONSE';

    const result = await disputeShield.executeProvideEvidence(disputeId, metadata);

    // Clear pending PROVIDE_DISPUTE_EVIDENCE HITL request if any
    const pendingEv = store
      .getPendingApprovals()
      .find((r) => r.type === 'PROVIDE_DISPUTE_EVIDENCE');
    if (pendingEv) {
      await safeGate.approveAction(pendingEv.id, 'Merchant Evidence Dispatch');
    }

    publishEcosystemEvent({
      sender: 'BUSINESS',
      recipient: 'PAYPAL_ENGINE',
      agentName: 'DisputeStrategist (Audit RAG + A4)',
      eventType: 'EVIDENCE_SUBMITTED',
      title: `A4 Evidence Bundle Submitted (${disputeId})`,
      message: `Multipart/related A4 legal PDF representment uploaded to PayPal Disputes API with buyer IP telemetry & SHA-256 hash.`,
      payload: {
        disputeId,
        uploadResult: result,
      },
    });

    const diff = publishStateMutationDiff({
      actionLabel: 'Multipart A4 Legal Evidence Dispatched',
      actor: 'BUSINESS',
      agentName: 'DisputeStrategist (Audit RAG + A4)',
      targetId: disputeId,
      changes: [
        {
          field: 'Dispute Status',
          previousValue: prevStatus,
          newValue: 'UNDER_REVIEW',
          badge: 'EVIDENCE FILED',
          highlightType: 'CAPTURED',
        },
      ],
      downstreamImpact:
        'PayPal representment SLA satisfied ahead of 10-day deadline with immutable Elastic audit evidence.',
    });

    res.json({ success: true, data: { ...result, diff } });
  } catch (err: any) {
    logger.error('Failed to submit dispute evidence', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/disputes/:id/evidence-pdf — Preview or download compiled A4 PDF with Elasticsearch RAG
router.get('/:id/evidence-pdf', async (req: Request, res: Response) => {
  try {
    const dispute = store.getDispute(req.params.id) || {
      dispute_id: req.params.id,
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
      status: 'WAITING_FOR_SELLER_RESPONSE' as const,
      reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED' as const,
      dispute_amount: { currency_code: 'USD', value: '450.00' },
      dispute_life_cycle_stage: 'CHARGEBACK' as const,
      dispute_channel: 'INTERNAL' as const,
      links: [],
    };

    const { pdfBuffer } = await compileRagEvidenceForDispute(dispute);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="evidence_${req.params.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err: any) {
    logger.error('Failed to generate evidence PDF via RAG', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

