import { Router, Request, Response } from 'express';
import { disputeShield } from '../engines/dispute-shield';
import logger from '../lib/logger';
import { store } from '../lib/store';

const router = Router();

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
    const { offerAmount, note, offerType = 'REFUND' } = req.body;
    const result = await disputeShield.executeMakeOffer(
      req.params.id,
      offerAmount,
      note || 'Settlement offer to resolve inquiry amicably',
      offerType
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Failed to execute make-offer', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/disputes/:id/provide-evidence — Multipart PDF evidence submission
router.post('/:id/provide-evidence', async (req: Request, res: Response) => {
  try {
    const { metadata } = req.body;
    const result = await disputeShield.executeProvideEvidence(req.params.id, metadata);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('Failed to submit dispute evidence', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/disputes/:id/evidence-pdf — Preview or download compiled A4 PDF
router.get('/:id/evidence-pdf', async (req: Request, res: Response) => {
  try {
    const dispute = store.getDispute(req.params.id);
    const evidenceData = dispute
      ? disputeShield.createDemoEvidenceData(dispute)
      : disputeShield.createDemoEvidenceData({
          dispute_id: req.params.id,
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
          status: 'WAITING_FOR_SELLER_RESPONSE',
          reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
          dispute_amount: { currency_code: 'USD', value: '450.00' },
          dispute_life_cycle_stage: 'CHARGEBACK',
          dispute_channel: 'INTERNAL',
          links: [],
        });

    const pdfBuffer = await disputeShield.compileEvidencePdf(evidenceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="evidence_${req.params.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err: any) {
    logger.error('Failed to generate evidence PDF', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

