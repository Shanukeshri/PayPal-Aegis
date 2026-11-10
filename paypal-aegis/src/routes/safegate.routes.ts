import { Router, Request, Response } from 'express';
import { safeGate } from '../engines/safegate';
import { WorkflowPhase } from '../engines/safegate/tool-router';
import logger from '../lib/logger';
import { store } from '../lib/store';

const router = Router();

// GET /api/safegate/balances — Reporting balances
router.get('/balances', async (req: Request, res: Response) => {
  try {
    const balances = await safeGate.getBalances();
    res.json({ success: true, data: balances.data, simulated: balances.simulated });
  } catch (err: any) {
    logger.error('Failed to get balances', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/safegate/tools?phase=... — Dynamic tool catalog
router.get('/tools', (req: Request, res: Response) => {
  const phase = (req.query.phase as WorkflowPhase) || 'ESCROW_SETUP';
  const tools = safeGate.getToolsForPhase(phase);
  res.json({
    success: true,
    data: {
      phase,
      tools,
      availablePhases: safeGate.getWorkflowPhases(),
    },
  });
});

// POST /api/safegate/orders — Create order with intent AUTHORIZE
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const { amount, intent = 'AUTHORIZE', description } = req.body;
    if (!amount || !amount.currency_code || !amount.value) {
      return res.status(400).json({ success: false, error: 'Invalid amount object' });
    }
    const order = await safeGate.createOrder(amount, intent, description);
    res.json({ success: true, data: order.data, simulated: order.simulated });
  } catch (err: any) {
    logger.error('Failed to create order', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/safegate/orders/:id
router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const order = await safeGate.getOrder(req.params.id);
    res.json({ success: true, data: order.data, simulated: order.simulated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/safegate/orders/:id/authorize
router.post('/orders/:id/authorize', async (req: Request, res: Response) => {
  try {
    const auth = await safeGate.authorizeOrder(req.params.id);
    res.json({ success: true, data: auth.data, simulated: auth.simulated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/safegate/authorizations/:id/reauthorize
router.post('/authorizations/:id/reauthorize', async (req: Request, res: Response) => {
  try {
    const reauth = await safeGate.reauthorizePayment(req.params.id);
    res.json({ success: true, data: reauth.data, simulated: reauth.simulated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/safegate/authorizations/:id/capture
router.post('/authorizations/:id/capture', async (req: Request, res: Response) => {
  try {
    const { amount, finalCapture } = req.body;
    const capture = await safeGate.captureAuthorization(req.params.id, amount, finalCapture);
    res.json({ success: true, data: capture.data, simulated: capture.simulated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/safegate/authorizations/:id/void
router.post('/authorizations/:id/void', async (req: Request, res: Response) => {
  try {
    const voidRes = await safeGate.voidAuthorization(req.params.id);
    res.json({ success: true, data: voidRes.data, simulated: voidRes.simulated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

