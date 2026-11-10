import { Router, Request, Response } from 'express';
import { processWebhookEvent } from '../engines/webhook-gateway';
import { generateDemoHmac } from '../engines/webhook-gateway/hmac-fallback';
import logger from '../lib/logger';
import { store } from '../lib/store';

const router = Router();

/**
 * POST /api/webhooks/paypal
 * Authoritative PayPal Webhook Ingestion Route.
 * Expects raw byte buffer (via express.raw({ type: '*\/*' })) to preserve
 * exact CRC32 checksum before JSON parsing.
 */
router.post('/paypal', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    let rawBuffer: Buffer;

    if (Buffer.isBuffer(req.body)) {
      rawBuffer = req.body;
    } else if (typeof req.body === 'string') {
      rawBuffer = Buffer.from(req.body, 'utf8');
    } else {
      rawBuffer = Buffer.from(JSON.stringify(req.body), 'utf8');
    }

    logger.info('Received incoming PayPal webhook request', {
      contentLength: rawBuffer.length,
      transmissionId: req.headers['paypal-transmission-id'],
      eventType: req.headers['paypal-event-type'] || 'unknown',
    });

    const result = await processWebhookEvent(rawBuffer, req.headers as Record<string, string | undefined>);

    // If duplicate or signature invalid, still acknowledge with appropriate status
    if (!result.verification.verified) {
      logger.warn('Webhook verification failed', {
        error: result.error,
        eventId: result.verification.eventId,
      });
      return res.status(400).json({
        status: 'VERIFICATION_FAILED',
        error: result.error,
      });
    }

    // PayPal requires HTTP 200 within 25 retries over 3 days
    res.status(200).json({
      status: 'RECEIVED',
      eventId: result.verification.eventId,
      mode: result.verification.mode,
      duplicate: result.verification.isDuplicate,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (err: any) {
    logger.error('Error in webhook ingestion route', { err: err.message });
    // Still return 200 if parsed to avoid webhook loop in demo mode
    res.status(200).json({ status: 'ACKNOWLEDGED_WITH_ERROR', error: err.message });
  }
});

/**
 * POST /api/webhooks/demo
 * Simulator endpoint for Judge Demo Toolbar.
 * Automatically attaches DEMO HMAC signature and processes payload through HATEOAS pipeline.
 */
router.post('/demo', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const bodyStr = JSON.stringify(payload);
    const rawBuffer = Buffer.from(bodyStr, 'utf8');
    const signature = generateDemoHmac(bodyStr);

    const headers: Record<string, string> = {
      'x-aegis-signature': signature,
      'x-demo-event': 'true',
      'paypal-transmission-id': `SIM-TRANS-${Date.now()}`,
      'paypal-transmission-time': new Date().toISOString(),
    };

    const result = await processWebhookEvent(rawBuffer, headers);

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    logger.error('Error in demo webhook route', { err: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

