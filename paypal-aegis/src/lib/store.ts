/**
 * In-Memory Data Store
 * 
 * Provides a lightweight in-memory store for development and demo mode.
 * Gracefully handles cases where Redis/Elasticsearch are not configured.
 */

import Redis from 'ioredis';
import {
  Project, Milestone, HITLApprovalRequest, DurableTimer,
  IdempotencyRecord, DisputeRatioSnapshot, DisputeTriageResult,
  PayPalDispute, AuthorizationRecord, WebhookVerificationResult
} from '../types';
import { config } from '../config';
import logger from './logger';

class InMemoryStore {
  private projects: Map<string, Project> = new Map();
  private milestones: Map<string, Milestone> = new Map();
  private approvalRequests: Map<string, HITLApprovalRequest> = new Map();
  private timers: Map<string, DurableTimer> = new Map();
  private idempotencyCache: Map<string, IdempotencyRecord> = new Map();
  private webhookDedup: Map<string, number> = new Map(); // eventId -> timestamp
  private disputes: Map<string, PayPalDispute> = new Map();
  private disputeTriageResults: Map<string, DisputeTriageResult> = new Map();
  private disputeRatioHistory: DisputeRatioSnapshot[] = [];
  private auditLog: Array<{ timestamp: Date; action: string; details: Record<string, unknown> }> = [];
  private redisClient: Redis | null = null;

  // Demo data counters
  private salesCount90d = 150;
  private disputeCount90d = 2;

  constructor() {
    if (config.redis.isConfigured) {
      try {
        this.redisClient = new Redis(config.redis.url, {
          maxRetriesPerRequest: 2,
          enableReadyCheck: true,
          lazyConnect: true,
        });
        this.redisClient.connect().then(() => {
          logger.info('Connected to Redis instance', { url: config.redis.url });
        }).catch((err) => {
          logger.warn('Redis connection failed, continuing with in-memory store', { error: err.message });
        });
      } catch (err: any) {
        logger.warn('Failed to initialize Redis client', { error: err.message });
      }
    } else {
      logger.info('InMemoryStore initialized — running in demo/development mode');
    }
  }

  // ============================================
  // Projects
  // ============================================
  setProject(project: Project): void {
    this.projects.set(project.id, project);
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  getAllProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  // ============================================
  // Milestones
  // ============================================
  setMilestone(milestone: Milestone): void {
    this.milestones.set(milestone.id, milestone);
  }

  getMilestone(id: string): Milestone | undefined {
    return this.milestones.get(id);
  }

  getMilestonesByProject(projectId: string): Milestone[] {
    return Array.from(this.milestones.values()).filter(m => m.projectId === projectId);
  }

  getMilestoneByAuthId(authId: string): Milestone | undefined {
    return Array.from(this.milestones.values()).find(
      m => m.activeAuthorizationId === authId || m.originalAuthorizationId === authId
    );
  }

  getAllMilestones(): Milestone[] {
    return Array.from(this.milestones.values());
  }

  // ============================================
  // HITL Approval Requests
  // ============================================
  setApprovalRequest(request: HITLApprovalRequest): void {
    this.approvalRequests.set(request.id, request);
  }

  getApprovalRequest(id: string): HITLApprovalRequest | undefined {
    return this.approvalRequests.get(id);
  }

  getPendingApprovals(): HITLApprovalRequest[] {
    return Array.from(this.approvalRequests.values())
      .filter(r => r.status === 'PENDING_APPROVAL')
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  getAllApprovals(): HITLApprovalRequest[] {
    return Array.from(this.approvalRequests.values())
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  // ============================================
  // Durable Timers
  // ============================================
  setTimer(timer: DurableTimer): void {
    this.timers.set(timer.id, timer);
  }

  getTimer(id: string): DurableTimer | undefined {
    return this.timers.get(id);
  }

  getActiveTimers(): DurableTimer[] {
    return Array.from(this.timers.values())
      .filter(t => t.status === 'SCHEDULED' || t.status === 'EXECUTING');
  }

  getTimersByType(type: DurableTimer['type']): DurableTimer[] {
    return Array.from(this.timers.values()).filter(t => t.type === type);
  }

  // ============================================
  // Idempotency Cache
  // ============================================
  setIdempotencyRecord(record: IdempotencyRecord): void {
    this.idempotencyCache.set(record.requestId, record);
    if (this.redisClient) {
      this.redisClient.setex(
        `aegis:idempotency:${record.requestId}`,
        7 * 24 * 60 * 60, // 7 days TTL
        JSON.stringify(record)
      ).catch(() => {});
    }
  }

  getIdempotencyRecord(requestId: string): IdempotencyRecord | undefined {
    return this.idempotencyCache.get(requestId);
  }

  // ============================================
  // Webhook Deduplication
  // ============================================
  isWebhookDuplicate(eventId: string): boolean {
    return this.webhookDedup.has(eventId);
  }

  markWebhookProcessed(eventId: string): void {
    this.webhookDedup.set(eventId, Date.now());
    if (this.redisClient) {
      this.redisClient.setex(
        `aegis:webhook:${eventId}`,
        7 * 24 * 60 * 60, // 7 days TTL
        '1'
      ).catch(() => {});
    }
    // Clean up entries older than 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (const [id, ts] of this.webhookDedup.entries()) {
      if (ts < sevenDaysAgo) this.webhookDedup.delete(id);
    }
  }

  // ============================================
  // Disputes
  // ============================================
  setDispute(dispute: PayPalDispute): void {
    this.disputes.set(dispute.dispute_id, dispute);
  }

  getDispute(id: string): PayPalDispute | undefined {
    return this.disputes.get(id);
  }

  getAllDisputes(): PayPalDispute[] {
    return Array.from(this.disputes.values());
  }

  setDisputeTriageResult(result: DisputeTriageResult): void {
    this.disputeTriageResults.set(result.disputeId, result);
  }

  getDisputeTriageResult(disputeId: string): DisputeTriageResult | undefined {
    return this.disputeTriageResults.get(disputeId);
  }

  // ============================================
  // Dispute Ratio
  // ============================================
  getDisputeRatio(): DisputeRatioSnapshot {
    const ratio = this.disputeCount90d / Math.max(this.salesCount90d, 1);
    const snapshot: DisputeRatioSnapshot = {
      timestamp: new Date(),
      totalSales90d: this.salesCount90d,
      totalDisputes90d: this.disputeCount90d,
      ratio,
      tier: ratio >= 0.015 ? 'HIGH_VOLUME' : 'STANDARD',
      thresholdProximity: Math.min(ratio / 0.015, 1.0),
    };
    this.disputeRatioHistory.push(snapshot);
    return snapshot;
  }

  incrementSales(count = 1): void {
    this.salesCount90d += count;
  }

  incrementDisputes(count = 1): void {
    this.disputeCount90d += count;
  }

  setDisputeRatioCounters(sales: number, disputes: number): void {
    this.salesCount90d = sales;
    this.disputeCount90d = disputes;
  }

  getDisputeRatioHistory(): DisputeRatioSnapshot[] {
    return [...this.disputeRatioHistory];
  }

  // ============================================
  // Audit Log
  // ============================================
  addAuditEntry(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date(), action, details });
    logger.debug('Audit entry', { action, details });
  }

  getAuditLog(limit = 100): Array<{ timestamp: Date; action: string; details: Record<string, unknown> }> {
    return this.auditLog.slice(-limit);
  }

  // ============================================
  // Reset (for testing)
  // ============================================
  reset(): void {
    this.projects.clear();
    this.milestones.clear();
    this.approvalRequests.clear();
    this.timers.clear();
    this.idempotencyCache.clear();
    this.webhookDedup.clear();
    this.disputes.clear();
    this.disputeTriageResults.clear();
    this.disputeRatioHistory = [];
    this.auditLog = [];
    this.salesCount90d = 150;
    this.disputeCount90d = 2;
    logger.info('InMemoryStore reset');
  }
}

// Singleton
export const store = new InMemoryStore();

