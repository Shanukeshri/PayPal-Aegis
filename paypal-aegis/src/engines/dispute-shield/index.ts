/**
 * Dispute Shield & Evidence Compiler — Engine 4
 *
 * Implements:
 * 1. Rolling 90-day dispute ratio calculator & 1.5% fee cliff radar
 * 2. Pre-escalation inquiry settlement ($0 dispute fee) via make-offer
 * 3. Autonomous multimodal PDF evidence compiler (<10MB A4 with linked headers)
 * 4. Multipart/related provide-evidence representment uploader
 * 5. HITL approval staging for all money-moving/legal dispute actions
 */

import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import logger from '../../lib/logger';
import { store } from '../../lib/store';
import { safeGate } from '../safegate';
import { calculateDisputeRatio } from './ratio-calculator';
import {
  compileEvidencePdf,
  createDemoEvidenceData,
  EvidenceData,
} from './evidence-compiler';
import {
  uploadEvidence,
  EvidenceMetadata,
  EvidenceUploadResult,
} from './evidence-uploader';
import type {
  PayPalDispute,
  DisputeTriageResult,
  DisputeRatioSnapshot,
  PayPalAmount,
  HITLApprovalRequest,
} from '../../types';

// ============================================
// Dispute Shield Main Interface
// ============================================

/**
 * Triages an incoming or open PayPal dispute.
 * Evaluates the 1.5% fee cliff risk and recommends either:
 * - Branch A: Pre-escalation make-offer settlement ($0 fee)
 * - Branch B: Multipart PDF representment evidence upload
 */
export async function triageDispute(
  dispute: PayPalDispute
): Promise<DisputeTriageResult> {
  const ratioSnapshot = calculateDisputeRatio();
  const disputeId = dispute.dispute_id;

  // Calculate days until seller response deadline
  let daysUntilDeadline = 10;
  if (dispute.seller_response_due_date) {
    const dueDate = new Date(dispute.seller_response_due_date);
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    daysUntilDeadline = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  const isNearFeeCliff =
    ratioSnapshot.thresholdProximity >= 0.8 || ratioSnapshot.tier === 'HIGH_VOLUME';
  const isInquiry = dispute.dispute_life_cycle_stage === 'INQUIRY';
  const isSnadOrInr =
    dispute.reason === 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED' ||
    dispute.reason === 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';

  let recommendedAction: DisputeTriageResult['recommendedAction'];
  let rationale: string;
  let urgency: DisputeTriageResult['urgency'] = 'MEDIUM';
  let settlementAmount: PayPalAmount | undefined;

  if (isInquiry && dispute.status === 'WAITING_FOR_SELLER_RESPONSE') {
    // Branch A: Pre-escalation Inquiry Stage ($0 Dispute Fee)
    if (isNearFeeCliff) {
      recommendedAction = 'MAKE_OFFER';
      urgency = 'HIGH';
      settlementAmount = {
        currency_code: dispute.dispute_amount.currency_code,
        value: dispute.dispute_amount.value,
      };
      rationale = `CRITICAL DEFENSE: Current 90-day dispute ratio is ${(
        ratioSnapshot.ratio * 100
      ).toFixed(
        2
      )}% (approaching 1.5% High Volume cliff). Resolving this inquiry immediately via make-offer incurs a $0 Dispute Fee and prevents entering the $30 non-refundable penalty tier.`;
    } else {
      recommendedAction = 'MAKE_OFFER';
      urgency = 'LOW';
      settlementAmount = {
        currency_code: dispute.dispute_amount.currency_code,
        value: dispute.dispute_amount.value,
      };
      rationale = `Inquiry stage settlement ($0 fee). Offering resolution before buyer escalates to a formal claim.`;
    }
  } else {
    // Branch B: Formal Claim / Chargeback Stage
    recommendedAction = 'PROVIDE_EVIDENCE';
    urgency = daysUntilDeadline <= 3 ? 'CRITICAL' : daysUntilDeadline <= 7 ? 'HIGH' : 'MEDIUM';
    rationale = `ESCALATED CLAIM: Direct messaging disabled. Strict 10-day representment deadline (${daysUntilDeadline} days remaining). Auto-compiling A4 PDF evidence with linked buyer IP, delivery timestamps, and SHA-256 deliverable hashes.`;
  }

  const triageResult: DisputeTriageResult = {
    disputeId,
    lifecycle: dispute.dispute_life_cycle_stage,
    reason: dispute.reason,
    recommendedAction,
    rationale,
    currentRatio: ratioSnapshot,
    settlementAmount,
    urgency,
    daysUntilDeadline,
  };

  store.setDisputeTriageResult(triageResult);
  store.setDispute(dispute);

  logger.info('Dispute triaged by Dispute Shield', {
    disputeId,
    recommendedAction,
    ratio: (ratioSnapshot.ratio * 100).toFixed(3) + '%',
    urgency,
    daysUntilDeadline,
  });

  return triageResult;
}

/**
 * Main Webhook & Event Handler for CUSTOMER.DISPUTE.CREATED / UPDATED
 */
export async function handleDisputeCreated(
  dispute: PayPalDispute,
  autoStageHitl = true
): Promise<{
  triage: DisputeTriageResult;
  hitlRequestId?: string;
  pdfBuffer?: Buffer;
}> {
  store.incrementDisputes(1); // Increment dispute count for rolling ratio
  const triage = await triageDispute(dispute);

  let hitlRequestId: string | undefined;
  let pdfBuffer: Buffer | undefined;

  if (autoStageHitl) {
    if (triage.recommendedAction === 'MAKE_OFFER') {
      // Stage Make-Offer in HITL Gate
      const offerPayload = {
        disputeId: dispute.dispute_id,
        note: `Settlement offer to resolve inquiry amicably: Full refund of ${triage.settlementAmount?.value} ${triage.settlementAmount?.currency_code}`,
        offer_amount: triage.settlementAmount,
        offer_type: 'REFUND',
      };

      const hitlRes = safeGate.interceptAction(
        'MAKE_DISPUTE_OFFER',
        offerPayload,
        `Make settlement offer of $${triage.settlementAmount?.value} to prevent $30 High Volume dispute fee`,
        triage.urgency === 'HIGH' || triage.urgency === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        undefined,
        { disputeId: dispute.dispute_id }
      );

      hitlRequestId = hitlRes.id;
    } else if (triage.recommendedAction === 'PROVIDE_EVIDENCE') {
      // Branch B: Generate PDF Evidence and Stage in HITL Gate
      const evidenceData: EvidenceData = createDemoEvidenceData(dispute);
      pdfBuffer = await compileEvidencePdf(evidenceData);

      const evidencePayload = {
        disputeId: dispute.dispute_id,
        evidenceType: 'PROOF_OF_FULFILLMENT',
        evidenceInfo: {
          tracking_info: [],
        },
        notes: `Automated representment bundle: Electronic Proof of Delivery, buyer access timestamps, client IP telemetry, and SHA-256 deliverable verification.`,
        pdfSizeBytes: pdfBuffer.length,
        hasPdf: true,
      };

      const hitlRes = safeGate.interceptAction(
        'PROVIDE_DISPUTE_EVIDENCE',
        evidencePayload,
        `Submit compiled A4 PDF evidence package (${(pdfBuffer.length / 1024).toFixed(
          1
        )} KB) for ${dispute.dispute_id}`,
        triage.urgency === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        undefined,
        { disputeId: dispute.dispute_id }
      );

      hitlRequestId = hitlRes.id;
    }
  }

  return { triage, hitlRequestId, pdfBuffer };
}

/**
 * Executes a Make-Offer settlement after HITL approval.
 */
export async function executeMakeOffer(
  disputeId: string,
  offerAmount: PayPalAmount,
  note: string,
  offerType: 'REFUND' | 'REFUND_WITH_RETURN' | 'REFUND_WITH_REPLACEMENT' = 'REFUND'
): Promise<{ success: boolean; simulated: boolean; disputeId: string }> {
  logger.info('Executing dispute make-offer settlement', {
    disputeId,
    offerAmount,
    offerType,
  });

  const res = await safeGate.makeDisputeOffer(disputeId, offerAmount, offerType, note);

  // Update dispute status in store
  const dispute = store.getDispute(disputeId);
  if (dispute) {
    dispute.status = 'WAITING_FOR_BUYER_RESPONSE';
    dispute.offer = {
      seller_offered_amount: offerAmount,
      offer_type: offerType,
    };
    store.setDispute(dispute);
  }

  store.addAuditEntry('DISPUTE_OFFER_EXECUTED', {
    disputeId,
    offerAmount,
    offerType,
    simulated: res.simulated,
  });

  return {
    success: true,
    simulated: res.simulated,
    disputeId,
  };
}

/**
 * Executes Evidence Submission after HITL approval.
 */
export async function executeProvideEvidence(
  disputeId: string,
  metadata?: EvidenceMetadata,
  pdfBuffer?: Buffer
): Promise<EvidenceUploadResult> {
  const dispute = store.getDispute(disputeId);
  let bufferToUpload = pdfBuffer;

  if (!bufferToUpload) {
    // Generate fresh PDF if not passed
    const evidenceData = dispute
      ? createDemoEvidenceData(dispute)
      : createDemoEvidenceData({
          dispute_id: disputeId,
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
          status: 'WAITING_FOR_SELLER_RESPONSE',
          reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
          dispute_amount: { currency_code: 'USD', value: '450.00' },
          dispute_life_cycle_stage: 'CHARGEBACK',
          dispute_channel: 'INTERNAL',
          links: [],
        });

    bufferToUpload = await compileEvidencePdf(evidenceData);
  }

  const uploadMetadata: EvidenceMetadata = metadata || {
    evidence_type: 'PROOF_OF_FULFILLMENT',
    evidence_info: {},
    notes: `Electronic proof of digital fulfillment and deliverable integrity. Transaction linked: ${disputeId}.`,
  };

  logger.info('Executing provide-evidence multipart submission', {
    disputeId,
    pdfSize: bufferToUpload.length,
  });

  const uploadRes = await uploadEvidence(disputeId, uploadMetadata, bufferToUpload);

  if (dispute) {
    dispute.status = 'UNDER_REVIEW';
    store.setDispute(dispute);
  }

  store.addAuditEntry('DISPUTE_EVIDENCE_SUBMITTED', {
    disputeId,
    uploadResult: uploadRes,
  });

  return uploadRes;
}

/**
 * Helper to simulate a realistic SNAD dispute event for the Judge Demo Toolbar
 * Injects dispute at 1.42% ratio to show pre-escalation vs provide-evidence branches.
 */
export async function simulateSnadDisputeFixture(
  targetRatio = 0.0142,
  customSales?: number,
  customDisputes?: number,
  customDisputeAmount?: string,
  stage: 'INQUIRY' | 'CHARGEBACK' = 'INQUIRY'
): Promise<{
  dispute: PayPalDispute;
  triage: DisputeTriageResult;
  hitlRequestId?: string;
  pdfBuffer?: Buffer;
}> {
  // If custom counters provided, configure store counters accordingly
  const sales = customSales !== undefined ? Math.max(1, customSales) : 211;
  // Notice: handleDisputeCreated adds 1 dispute, so set baseline to Math.max(0, disputes - 1)
  const targetDisputes = customDisputes !== undefined ? Math.max(1, customDisputes) : 3;
  const existingDisputes = Math.max(0, targetDisputes - 1);
  store.setDisputeRatioCounters(sales, existingDisputes);

  const disputeId = stage === 'CHARGEBACK' ? 'PP-D-40194-CB' : 'PP-D-40193';
  const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const disputeAmountVal = customDisputeAmount || '350.00';

  const mockDispute: PayPalDispute = {
    dispute_id: disputeId,
    create_time: new Date().toISOString(),
    update_time: new Date().toISOString(),
    status: 'WAITING_FOR_SELLER_RESPONSE',
    reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
    dispute_amount: { currency_code: 'USD', value: disputeAmountVal },
    dispute_life_cycle_stage: stage,
    dispute_channel: 'INTERNAL',
    seller_response_due_date: dueDate,
    messages: [
      {
        posted_by: 'BUYER',
        content:
          stage === 'CHARGEBACK'
            ? 'Escalated SNAD chargeback filed against milestone deliverables requiring formal representment evidence.'
            : 'The milestone deliverables did not match the agreed technical specifications.',
        time_posted: new Date().toISOString(),
      },
    ],
    links: [
      {
        href: `https://api-m.sandbox.paypal.com/v1/customer/disputes/${disputeId}`,
        rel: 'self',
        method: 'GET',
      },
    ],
  };

  logger.info('Judge Demo: Injected simulated SNAD dispute at 1.42% ratio', {
    disputeId,
    ratio: targetRatio,
  });

  const result = await handleDisputeCreated(mockDispute, true);
  return { dispute: mockDispute, ...result };
}

export const disputeShield = {
  calculateDisputeRatio,
  triageDispute,
  handleDisputeCreated,
  executeMakeOffer,
  executeProvideEvidence,
  compileEvidencePdf,
  createDemoEvidenceData,
  uploadEvidence,
  simulateSnadDisputeFixture,
};

export default disputeShield;
