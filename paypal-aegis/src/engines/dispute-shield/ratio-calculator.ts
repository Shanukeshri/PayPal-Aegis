/**
 * Dispute Shield — Rolling 90-Day Dispute Ratio Calculator
 *
 * Calculates the dispute-to-sales ratio over a rolling 90-day window.
 * Determines tier classification and threshold proximity to the
 * PayPal dispute ratio limit of 1.5%.
 */

import logger from '../../lib/logger';
import { store } from '../../lib/store';
import { DisputeRatioSnapshot } from '../../types';

/** PayPal's dispute ratio threshold (1.5%) */
const DISPUTE_RATIO_THRESHOLD = 0.015;

/**
 * Calculates the current rolling 90-day dispute ratio snapshot.
 *
 * Uses the in-memory store's sales and dispute counters to compute:
 * - ratio: totalDisputes90d / totalSales90d
 * - tier: STANDARD (< 1.5%) or HIGH_VOLUME (>= 1.5%)
 * - thresholdProximity: 0.0 to 1.0, where 1.0 = at or above 1.5%
 *
 * @returns DisputeRatioSnapshot with current metrics
 */
export function calculateDisputeRatio(): DisputeRatioSnapshot {
  const snapshot = store.getDisputeRatio();

  logger.info('Dispute ratio calculated', {
    totalSales90d: snapshot.totalSales90d,
    totalDisputes90d: snapshot.totalDisputes90d,
    ratio: (snapshot.ratio * 100).toFixed(3) + '%',
    tier: snapshot.tier,
    thresholdProximity: snapshot.thresholdProximity.toFixed(3),
  });

  // Emit warning if approaching threshold
  if (snapshot.thresholdProximity >= 0.8 && snapshot.tier === 'STANDARD') {
    logger.warn('⚠️ Dispute ratio approaching 1.5% threshold', {
      ratio: (snapshot.ratio * 100).toFixed(3) + '%',
      proximity: (snapshot.thresholdProximity * 100).toFixed(1) + '%',
      remainingBuffer: Math.max(
        0,
        Math.floor(snapshot.totalSales90d * DISPUTE_RATIO_THRESHOLD) - snapshot.totalDisputes90d
      ) + ' disputes before threshold',
    });
  }

  if (snapshot.tier === 'HIGH_VOLUME') {
    logger.error('🚨 Dispute ratio ABOVE 1.5% threshold — HIGH_VOLUME tier', {
      ratio: (snapshot.ratio * 100).toFixed(3) + '%',
      totalDisputes90d: snapshot.totalDisputes90d,
      totalSales90d: snapshot.totalSales90d,
    });
  }

  store.addAuditEntry('DISPUTE_RATIO_CALCULATED', {
    ratio: snapshot.ratio,
    tier: snapshot.tier,
    thresholdProximity: snapshot.thresholdProximity,
    totalSales90d: snapshot.totalSales90d,
    totalDisputes90d: snapshot.totalDisputes90d,
  });

  return snapshot;
}

/**
 * Checks whether a ratio is near the threshold and recommends an offer.
 *
 * If the ratio is at or above 80% of the 1.5% threshold, this returns true
 * indicating that the seller should consider making an offer to resolve
 * disputes quickly and bring the ratio down.
 *
 * @param snapshot - The current dispute ratio snapshot
 * @returns Whether making an offer is recommended
 */
export function shouldRecommendOffer(snapshot: DisputeRatioSnapshot): boolean {
  return snapshot.thresholdProximity >= 0.8;
}

/**
 * Calculates how many additional disputes would push the ratio over 1.5%.
 *
 * @param snapshot - The current dispute ratio snapshot
 * @returns Number of disputes remaining before threshold breach
 */
export function disputesUntilThreshold(snapshot: DisputeRatioSnapshot): number {
  const maxDisputes = Math.floor(snapshot.totalSales90d * DISPUTE_RATIO_THRESHOLD);
  return Math.max(0, maxDisputes - snapshot.totalDisputes90d);
}

/**
 * Returns a human-readable summary of the dispute ratio status.
 */
export function formatRatioSummary(snapshot: DisputeRatioSnapshot): string {
  const pctStr = (snapshot.ratio * 100).toFixed(2);
  const remaining = disputesUntilThreshold(snapshot);

  if (snapshot.tier === 'HIGH_VOLUME') {
    return `🚨 CRITICAL: Dispute ratio at ${pctStr}% (ABOVE 1.5% threshold). ` +
      `${snapshot.totalDisputes90d} disputes / ${snapshot.totalSales90d} sales in 90d. ` +
      `Immediate action required to reduce dispute volume.`;
  }

  if (snapshot.thresholdProximity >= 0.8) {
    return `⚠️ WARNING: Dispute ratio at ${pctStr}% (${(snapshot.thresholdProximity * 100).toFixed(0)}% of 1.5% threshold). ` +
      `${remaining} more dispute(s) before breach. ` +
      `${snapshot.totalDisputes90d} disputes / ${snapshot.totalSales90d} sales in 90d. ` +
      `Consider resolving open disputes via offers.`;
  }

  return `✅ Dispute ratio at ${pctStr}% (STANDARD tier). ` +
    `${remaining} dispute(s) remaining before 1.5% threshold. ` +
    `${snapshot.totalDisputes90d} disputes / ${snapshot.totalSales90d} sales in 90d.`;
}
