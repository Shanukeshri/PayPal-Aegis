export interface PayPalAmount {
  currency_code: string;
  value: string;
}

export interface AuthorizationRecord {
  authorizationId: string;
  requestId: string;
  timestamp: string;
  type: 'INITIAL' | 'REAUTHORIZATION';
  status: string;
  supersededBy?: string;
}

export interface Deliverable {
  id: string;
  milestoneId: string;
  name: string;
  type: 'FILE' | 'IMAGE' | 'DOCUMENT' | 'CODE' | 'URL';
  url?: string;
  sha256Hash?: string;
  uploadedAt: string;
  verified: boolean;
  verificationDetails?: {
    channel3Verified?: boolean;
    channel3SkuMatch?: string;
    elasticKnnScore?: number;
    isStockPhoto?: boolean;
    verifiedAt: string;
    fileName?: string;
  };
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  amount: PayPalAmount;
  status:
    | 'DRAFT'
    | 'PENDING_AUTHORIZATION'
    | 'AUTHORIZED'
    | 'REAUTHORIZED'
    | 'PENDING_VERIFICATION'
    | 'VERIFIED'
    | 'PENDING_CAPTURE'
    | 'CAPTURED'
    | 'VOIDED'
    | 'EXPIRED'
    | 'FAILED';
  orderId?: string;
  activeAuthorizationId?: string;
  originalAuthorizationId?: string;
  authorizationHistory: AuthorizationRecord[];
  captureId?: string;
  honorPeriodExpiresAt?: string;
  hardExpirationAt?: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  dependencies: string[];
  deliverables: Deliverable[];
  clientApprovedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  clientEmail: string;
  description: string;
  milestones: Milestone[];
  totalAmount: PayPalAmount;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface HITLApprovalRequest {
  id: string;
  type: string;
  payload: Record<string, any>;
  description: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  milestoneId?: string;
  disputeId?: string;
  requestedAt: string;
  expiresAt?: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED';
  approvedBy?: string;
  approvedAt?: string;
}

export interface DisputeRatioSnapshot {
  timestamp: string;
  totalSales90d: number;
  totalDisputes90d: number;
  ratio: number;
  tier: 'STANDARD' | 'HIGH_VOLUME';
  thresholdProximity: number;
}

export interface PayPalDispute {
  dispute_id: string;
  create_time: string;
  update_time: string;
  status: string;
  reason: string;
  dispute_amount: PayPalAmount;
  dispute_life_cycle_stage: 'INQUIRY' | 'CHARGEBACK' | 'PRE_ARBITRATION' | 'ARBITRATION';
  dispute_channel: string;
  seller_response_due_date?: string;
  messages?: Array<{
    posted_by: string;
    content: string;
    time_posted: string;
  }>;
  offer?: {
    seller_offered_amount?: PayPalAmount;
    offer_type: string;
  };
}

export interface DisputeTriageResult {
  disputeId: string;
  lifecycle: string;
  reason: string;
  recommendedAction: 'MAKE_OFFER' | 'PROVIDE_EVIDENCE' | 'ACCEPT' | 'WAIT';
  rationale: string;
  currentRatio: DisputeRatioSnapshot;
  settlementAmount?: PayPalAmount;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  daysUntilDeadline: number;
}

export type EcosystemActor = 'CLIENT' | 'BUSINESS' | 'PAYPAL_ENGINE';

export type EcosystemEventType =
  | 'HOLD_CREATED'
  | 'REAUTH_MUTATED'
  | 'DELIVERABLE_VERIFIED'
  | 'SAFEGATE_INTERCEPT'
  | 'CAPTURE_SETTLED'
  | 'DISPUTE_OPENED'
  | 'OFFER_DISPATCHED'
  | 'OFFER_ACCEPTED'
  | 'EVIDENCE_SUBMITTED'
  | 'SAFEGATE_REJECTED'
  | 'SYSTEM_RESET';

export interface EcosystemEvent {
  id: string;
  timestamp: string;
  sender: EcosystemActor;
  recipient: EcosystemActor | 'ALL';
  agentName: string;
  eventType: EcosystemEventType;
  title: string;
  message: string;
  payload?: Record<string, any>;
}

export interface StateMutationChange {
  field: string;
  previousValue: string;
  newValue: string;
  badge?: string;
  highlightType?: 'ROTATED' | 'CAPTURED' | 'SETTLED' | 'DISPUTED' | 'LOCKED' | 'SAFE';
}

export interface StateMutationDiff {
  id: string;
  timestamp: string;
  actionLabel: string;
  actor: EcosystemActor;
  agentName: string;
  targetId: string;
  changes: StateMutationChange[];
  downstreamImpact: string;
}

