/**
 * Persistent Write-Through Data Store
 *
 * Provides in-memory storage backed by an atomic write-through JSON disk cache
 * (/tmp/aegis-state.json) so active holds, rotated authorization IDs, audit logs,
 * and dispute ratio counters survive server restarts on Render or container recycles.
 * Also handles optional Redis client when REDIS_URL is configured.
 */

import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';
import {
  Project, Milestone, HITLApprovalRequest, DurableTimer,
  IdempotencyRecord, DisputeRatioSnapshot, DisputeTriageResult,
  PayPalDispute, AuthorizationRecord, WebhookVerificationResult,
  EcosystemEvent, StateMutationDiff
} from '../types';
import { config } from '../config';
import logger from './logger';

export interface StoredAuditDocument {
  id: string;
  transactionId: string;
  invoiceId?: string;
  buyerEmail: string;
  buyerName: string;
  buyerIp: string;
  downloadTimestamp: string;
  policyAccepted: boolean;
  deliverableSha256: string;
  imageKnnSimilarityScore: number;
  isAuthentic: boolean;
  featureVector?: number[];
  cosineMath?: {
    dotProduct: number;
    normA: number;
    normB: number;
    similarity: number;
  };
  indexedAt: string;
}

export interface StoredAgentTelemetry {
  agentName: string;
  phase: string;
  scopedTools: string[];
  selectedTool: string;
  arguments: Record<string, unknown>;
  reasoning: string;
  timestamp: string;
  latencyMs: number;
}

export interface StoredRagTelemetry {
  elasticEndpoint: string;
  query: Record<string, unknown>;
  documentsRetrieved: number;
  transactionId: string;
  cosineMath?: {
    dotProduct: number;
    normA: number;
    normB: number;
    similarity: number;
  };
  latencyMs: number;
  timestamp: string;
}

const STATE_FILE_PATH = process.env.AEGIS_STATE_FILE || '/tmp/aegis-state.json';

class PersistentStore {
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
  private auditDocuments: Map<string, StoredAuditDocument> = new Map(); // transactionId -> doc
  private latestAgentTelemetry: StoredAgentTelemetry | null = null;
  private latestRagTelemetry: StoredRagTelemetry | null = null;
  private ecosystemEvents: EcosystemEvent[] = [];
  private mutationDiffs: StateMutationDiff[] = [];
  private redisClient: Redis | null = null;

  // Demo data counters
  private salesCount90d = 150;
  private disputeCount90d = 2;

  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    // 1. Initialize Redis if available
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
          logger.warn('Redis connection failed, continuing with persistent disk store', { error: err.message });
        });
      } catch (err: any) {
        logger.warn('Failed to initialize Redis client', { error: err.message });
      }
    }

    // 2. Load state from disk
    this.loadFromDisk();
  }

  // ============================================
  // Persistence Layer (Atomic Write-Through)
  // ============================================
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveToDisk();
    }, 150);
  }

  public saveToDisk(): void {
    try {
      const state = {
        version: 1,
        savedAt: new Date().toISOString(),
        salesCount90d: this.salesCount90d,
        disputeCount90d: this.disputeCount90d,
        projects: Array.from(this.projects.entries()),
        milestones: Array.from(this.milestones.entries()),
        approvalRequests: Array.from(this.approvalRequests.entries()),
        timers: Array.from(this.timers.entries()),
        idempotencyCache: Array.from(this.idempotencyCache.entries()),
        webhookDedup: Array.from(this.webhookDedup.entries()),
        disputes: Array.from(this.disputes.entries()),
        disputeTriageResults: Array.from(this.disputeTriageResults.entries()),
        disputeRatioHistory: this.disputeRatioHistory,
        auditLog: this.auditLog,
        auditDocuments: Array.from(this.auditDocuments.entries()),
        latestAgentTelemetry: this.latestAgentTelemetry,
        latestRagTelemetry: this.latestRagTelemetry,
        ecosystemEvents: this.ecosystemEvents,
        mutationDiffs: this.mutationDiffs,
      };

      const serialized = JSON.stringify(state, null, 2);
      const tempPath = `${STATE_FILE_PATH}.tmp.${process.pid}.${Date.now()}`;

      const dir = path.dirname(STATE_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(tempPath, serialized, 'utf8');
      fs.renameSync(tempPath, STATE_FILE_PATH);
      logger.debug('Aegis state atomically saved to disk', { file: STATE_FILE_PATH, size: serialized.length });
    } catch (err: any) {
      logger.warn('Failed to persist Aegis state to disk', { error: err.message });
    }
  }

  public loadFromDisk(): boolean {
    try {
      if (!fs.existsSync(STATE_FILE_PATH)) {
        logger.info('No existing Aegis state file found; initializing fresh state store', { file: STATE_FILE_PATH });
        return false;
      }

      const content = fs.readFileSync(STATE_FILE_PATH, 'utf8');
      const data = JSON.parse(content);

      if (data.salesCount90d !== undefined) this.salesCount90d = data.salesCount90d;
      if (data.disputeCount90d !== undefined) this.disputeCount90d = data.disputeCount90d;

      if (Array.isArray(data.projects)) {
        this.projects = new Map(data.projects.map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            createdAt: new Date(v.createdAt),
            updatedAt: new Date(v.updatedAt),
          }
        ]));
      }

      if (Array.isArray(data.milestones)) {
        this.milestones = new Map(data.milestones.map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            dueDate: new Date(v.dueDate),
            createdAt: new Date(v.createdAt),
            updatedAt: new Date(v.updatedAt),
            honorPeriodExpiresAt: v.honorPeriodExpiresAt ? new Date(v.honorPeriodExpiresAt) : undefined,
            hardExpirationAt: v.hardExpirationAt ? new Date(v.hardExpirationAt) : undefined,
          }
        ]));
      }

      if (Array.isArray(data.approvalRequests)) {
        this.approvalRequests = new Map(data.approvalRequests.map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            requestedAt: new Date(v.requestedAt),
            decidedAt: v.decidedAt ? new Date(v.decidedAt) : undefined,
          }
        ]));
      }

      if (Array.isArray(data.timers)) {
        this.timers = new Map(data.timers.map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            scheduledFor: new Date(v.scheduledFor),
            createdAt: new Date(v.createdAt),
            executedAt: v.executedAt ? new Date(v.executedAt) : undefined,
          }
        ]));
      }

      if (Array.isArray(data.idempotencyCache)) {
        this.idempotencyCache = new Map(data.idempotencyCache.map(([k, v]: [string, any]) => [
          k,
          {
            ...v,
            firstSeenAt: new Date(v.firstSeenAt),
            cachedAt: new Date(v.cachedAt),
          }
        ]));
      }

      if (Array.isArray(data.webhookDedup)) {
        this.webhookDedup = new Map(data.webhookDedup);
      }

      if (Array.isArray(data.disputes)) {
        this.disputes = new Map(data.disputes);
      }

      if (Array.isArray(data.disputeTriageResults)) {
        this.disputeTriageResults = new Map(data.disputeTriageResults);
      }

      if (Array.isArray(data.disputeRatioHistory)) {
        this.disputeRatioHistory = data.disputeRatioHistory.map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }));
      }

      if (Array.isArray(data.auditLog)) {
        this.auditLog = data.auditLog.map((l: any) => ({
          ...l,
          timestamp: new Date(l.timestamp),
        }));
      }

      if (Array.isArray(data.auditDocuments)) {
        this.auditDocuments = new Map(data.auditDocuments);
      }

      if (data.latestAgentTelemetry) {
        this.latestAgentTelemetry = data.latestAgentTelemetry;
      }

      if (data.latestRagTelemetry) {
        this.latestRagTelemetry = data.latestRagTelemetry;
      }

      if (Array.isArray(data.ecosystemEvents)) {
        this.ecosystemEvents = data.ecosystemEvents;
      }

      if (Array.isArray(data.mutationDiffs)) {
        this.mutationDiffs = data.mutationDiffs;
      }

      logger.info('Loaded persistent Aegis state from disk', {
        file: STATE_FILE_PATH,
        milestones: this.milestones.size,
        disputes: this.disputes.size,
        auditLogs: this.auditLog.length,
      });

      return true;
    } catch (err: any) {
      logger.error('Failed to load Aegis state from disk', { error: err.message });
      return false;
    }
  }

  // ============================================
  // Projects
  // ============================================
  setProject(project: Project): void {
    this.projects.set(project.id, project);
    this.scheduleSave();
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
    this.scheduleSave();
  }

  getMilestone(id: string): Milestone | undefined {
    return this.milestones.get(id);
  }

  getMilestonesByProject(projectId: string): Milestone[] {
    return Array.from(this.milestones.values()).filter(m => m.projectId === projectId);
  }

  clearMilestonesByProject(projectId: string): void {
    for (const [id, m] of this.milestones.entries()) {
      if (m.projectId === projectId) {
        this.milestones.delete(id);
      }
    }
    this.scheduleSave();
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
    this.scheduleSave();
  }

  getApprovalRequest(id: string): HITLApprovalRequest | undefined {
    return this.approvalRequests.get(id);
  }

  getPendingApprovals(): HITLApprovalRequest[] {
    return Array.from(this.approvalRequests.values())
      .filter(r => r.status === 'PENDING_APPROVAL')
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  clearPendingApprovals(): void {
    for (const [id, req] of this.approvalRequests.entries()) {
      if (req.status === 'PENDING_APPROVAL') {
        this.approvalRequests.delete(id);
      }
    }
    this.scheduleSave();
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
    this.scheduleSave();
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
    this.scheduleSave();
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
    this.scheduleSave();
  }

  // ============================================
  // Disputes
  // ============================================
  setDispute(dispute: PayPalDispute): void {
    this.disputes.set(dispute.dispute_id, dispute);
    this.scheduleSave();
  }

  getDispute(id: string): PayPalDispute | undefined {
    return this.disputes.get(id);
  }

  getAllDisputes(): PayPalDispute[] {
    return Array.from(this.disputes.values());
  }

  setDisputeTriageResult(result: DisputeTriageResult): void {
    this.disputeTriageResults.set(result.disputeId, result);
    this.scheduleSave();
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
    this.scheduleSave();
    return snapshot;
  }

  incrementSales(count = 1): void {
    this.salesCount90d += count;
    this.scheduleSave();
  }

  incrementDisputes(count = 1): void {
    this.disputeCount90d += count;
    this.scheduleSave();
  }

  decrementDisputes(count = 1): void {
    this.disputeCount90d = Math.max(0, this.disputeCount90d - count);
    this.scheduleSave();
  }

  setDisputeRatioCounters(sales: number, disputes: number): void {
    this.salesCount90d = sales;
    this.disputeCount90d = disputes;
    this.scheduleSave();
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
    this.scheduleSave();
  }

  getAuditLog(limit = 100): Array<{ timestamp: Date; action: string; details: Record<string, unknown> }> {
    return this.auditLog.slice(-limit);
  }

  // ============================================
  // Audit Documents (RAG Vault)
  // ============================================
  saveAuditDocument(doc: StoredAuditDocument): void {
    this.auditDocuments.set(doc.transactionId, doc);
    this.scheduleSave();
  }

  getAuditDocumentsByTransaction(transactionId: string): StoredAuditDocument[] {
    const results: StoredAuditDocument[] = [];
    for (const doc of this.auditDocuments.values()) {
      if (doc.transactionId === transactionId || doc.transactionId.includes(transactionId) || transactionId.includes(doc.transactionId)) {
        results.push(doc);
      }
    }
    return results;
  }

  getAllAuditDocuments(): StoredAuditDocument[] {
    return Array.from(this.auditDocuments.values());
  }

  // ============================================
  // Live Wire & Telemetry Traces
  // ============================================
  setLatestAgentTelemetry(telemetry: StoredAgentTelemetry): void {
    this.latestAgentTelemetry = telemetry;
    this.scheduleSave();
  }

  getLatestAgentTelemetry(): StoredAgentTelemetry | null {
    return this.latestAgentTelemetry;
  }

  setLatestRagTelemetry(telemetry: StoredRagTelemetry): void {
    this.latestRagTelemetry = telemetry;
    this.scheduleSave();
  }

  getLatestRagTelemetry(): StoredRagTelemetry | null {
    return this.latestRagTelemetry;
  }

  // ============================================
  // Tripartite Ecosystem Events & Mutation Diffs
  // ============================================
  addEcosystemEvent(event: EcosystemEvent): void {
    this.ecosystemEvents.unshift(event);
    if (this.ecosystemEvents.length > 100) {
      this.ecosystemEvents = this.ecosystemEvents.slice(0, 100);
    }
    this.scheduleSave();
  }

  getEcosystemEvents(limit = 50): EcosystemEvent[] {
    return this.ecosystemEvents.slice(0, limit);
  }

  addMutationDiff(diff: StateMutationDiff): void {
    this.mutationDiffs.unshift(diff);
    if (this.mutationDiffs.length > 30) {
      this.mutationDiffs = this.mutationDiffs.slice(0, 30);
    }
    this.scheduleSave();
  }

  getMutationDiffs(limit = 20): StateMutationDiff[] {
    return this.mutationDiffs.slice(0, limit);
  }

  // ============================================
  // Reset Workspace (Maintains clean isolation)
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
    this.auditDocuments.clear();
    this.latestAgentTelemetry = null;
    this.latestRagTelemetry = null;
    this.ecosystemEvents = [];
    this.mutationDiffs = [];
    this.salesCount90d = 150;
    this.disputeCount90d = 2;

    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        fs.unlinkSync(STATE_FILE_PATH);
      }
    } catch (err: any) {
      logger.warn('Failed to remove state file on reset', { error: err.message });
    }

    logger.info('PersistentStore reset successfully');
  }
}

// Singleton export
export const store = new PersistentStore();
export default store;
