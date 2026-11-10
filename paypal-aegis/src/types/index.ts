// PayPal Aegis — Core Type Definitions

// ============================================
// PayPal API Types
// ============================================

export interface PayPalAmount {
  currency_code: string;
  value: string;
}

export interface PayPalLink {
  href: string;
  rel: string;
  method: string;
}

export interface PayPalAuthorization {
  id: string;
  status: 'CREATED' | 'CAPTURED' | 'DENIED' | 'EXPIRED' | 'PARTIALLY_CAPTURED' | 'VOIDED' | 'PENDING';
  amount: PayPalAmount;
  create_time: string;
  update_time: string;
  expiration_time?: string;
  links: PayPalLink[];
}

export interface PayPalOrder {
  id: string;
  intent: 'CAPTURE' | 'AUTHORIZE';
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  purchase_units: PayPalPurchaseUnit[];
  create_time: string;
  update_time: string;
  links: PayPalLink[];
}

export interface PayPalPurchaseUnit {
  reference_id?: string;
  amount: PayPalAmount;
  description?: string;
  payments?: {
    authorizations?: PayPalAuthorization[];
    captures?: PayPalCapture[];
  };
}

export interface PayPalCapture {
  id: string;
  status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'REFUNDED' | 'FAILED';
  amount: PayPalAmount;
  final_capture: boolean;
  create_time: string;
  update_time: string;
  links: PayPalLink[];
}

export interface PayPalDispute {
  dispute_id: string;
  create_time: string;
  update_time: string;
  status: 'OPEN' | 'WAITING_FOR_BUYER_RESPONSE' | 'WAITING_FOR_SELLER_RESPONSE' | 'UNDER_REVIEW' | 'RESOLVED' | 'OTHER';
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED' | 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED' | 'UNAUTHORISED' | 'CREDIT_NOT_PROCESSED' | 'DUPLICATE_TRANSACTION' | 'INCORRECT_AMOUNT' | 'PAYMENT_BY_OTHER_MEANS' | 'CANCELED_RECURRING_BILLING' | 'PROBLEM_WITH_REMITTANCE' | 'OTHER';
  dispute_amount: PayPalAmount;
  dispute_life_cycle_stage: 'INQUIRY' | 'CHARGEBACK' | 'PRE_ARBITRATION' | 'ARBITRATION';
  dispute_channel: 'INTERNAL' | 'EXTERNAL' | 'ALERT';
  seller_response_due_date?: string;
  messages?: PayPalDisputeMessage[];
  offer?: PayPalDisputeOffer;
  links: PayPalLink[];
}

export interface PayPalDisputeMessage {
  posted_by: 'BUYER' | 'SELLER' | 'ARBITER';
  content: string;
  time_posted: string;
}

export interface PayPalDisputeOffer {
  buyer_requested_amount?: PayPalAmount;
  seller_offered_amount?: PayPalAmount;
  offer_type: 'REFUND' | 'REFUND_WITH_RETURN' | 'REFUND_WITH_REPLACEMENT';
}

export interface PayPalBalance {
  currency: string;
  primary: boolean;
  total_balance: PayPalAmount;
  available_balance: PayPalAmount;
  withheld_balance: PayPalAmount;
}

export interface PayPalBalancesResponse {
  balances: PayPalBalance[];
  account_id: string;
}

export interface PayPalWebhookEvent {
  id: string;
  create_time: string;
  resource_type: string;
  event_type: string;
  summary: string;
  resource: Record<string, unknown>;
  links: PayPalLink[];
}

export interface PayPalOAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  nonce: string;
}

// ============================================
// Application Domain Types
// ============================================

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  amount: PayPalAmount;
  status: MilestoneStatus;
  orderId?: string;
  activeAuthorizationId?: string;
  originalAuthorizationId?: string;
  authorizationHistory: AuthorizationRecord[];
  captureId?: string;
  honorPeriodExpiresAt?: Date;
  hardExpirationAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date;
  dependencies: string[];
  deliverables: Deliverable[];
  evidenceDocuments: EvidenceDocument[];
}

export type MilestoneStatus =
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

export interface AuthorizationRecord {
  authorizationId: string;
  requestId: string;
  timestamp: Date;
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
  uploadedAt: Date;
  verified: boolean;
  verificationDetails?: VerificationResult;
}

export interface VerificationResult {
  channel3Verified?: boolean;
  channel3SkuMatch?: string;
  elasticKnnScore?: number;
  isStockPhoto?: boolean;
  verifiedAt: Date;
}

export interface EvidenceDocument {
  id: string;
  type: 'PROOF_OF_FULFILLMENT' | 'PROOF_OF_DELIVERY_SIGNATURE' | 'PROOF_OF_REFUND' | 'OTHER';
  filename: string;
  mimeType: string;
  sizeBytes: number;
  generatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// HITL Types
// ============================================

export interface HITLApprovalRequest {
  id: string;
  type: HITLActionType;
  payload: Record<string, unknown>;
  description: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  milestoneId?: string;
  disputeId?: string;
  requestedAt: Date;
  expiresAt?: Date;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED';
  approvedBy?: string;
  approvedAt?: Date;
  executionResult?: Record<string, unknown>;
  executionError?: string;
}

export type HITLActionType =
  | 'CAPTURE_AUTHORIZATION'
  | 'VOID_AUTHORIZATION'
  | 'REAUTHORIZE'
  | 'SEND_INVOICE'
  | 'CREATE_REFUND'
  | 'ACCEPT_DISPUTE'
  | 'MAKE_DISPUTE_OFFER'
  | 'PROVIDE_DISPUTE_EVIDENCE'
  | 'CREATE_ORDER';

// ============================================
// Dispute Shield Types
// ============================================

export interface DisputeRatioSnapshot {
  timestamp: Date;
  totalSales90d: number;
  totalDisputes90d: number;
  ratio: number;
  tier: 'STANDARD' | 'HIGH_VOLUME';
  thresholdProximity: number; // 0.0 to 1.0, where 1.0 = at 1.5%
}

export interface DisputeTriageResult {
  disputeId: string;
  lifecycle: 'INQUIRY' | 'CHARGEBACK' | 'PRE_ARBITRATION' | 'ARBITRATION';
  reason: string;
  recommendedAction: 'MAKE_OFFER' | 'PROVIDE_EVIDENCE' | 'ACCEPT' | 'WAIT';
  rationale: string;
  currentRatio: DisputeRatioSnapshot;
  settlementAmount?: PayPalAmount;
  evidenceSummary?: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  daysUntilDeadline: number;
}

// ============================================
// Webhook Types
// ============================================

export interface WebhookVerificationResult {
  verified: boolean;
  mode: 'CRC32_RSA' | 'HMAC_DEMO' | 'SIMULATION';
  eventId: string;
  eventType: string;
  isDuplicate: boolean;
}

export interface IdempotencyRecord {
  requestId: string;
  endpoint: string;
  method: string;
  payload: Record<string, unknown>;
  response: Record<string, unknown>;
  statusCode: number;
  timestamp: Date;
  ttlDays: number;
}

// ============================================
// Workflow / Timer Types
// ============================================

export interface DurableTimer {
  id: string;
  type: 'REAUTHORIZATION' | 'DISPUTE_DEADLINE' | 'PAYOUT_UNCLAIMED';
  targetId: string;
  scheduledAt: Date;
  executeAt: Date;
  status: 'SCHEDULED' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  metadata: Record<string, unknown>;
}

// ============================================
// Demo / Simulation Types
// ============================================

export interface DemoFixture {
  id: string;
  name: string;
  description: string;
  type: 'CONTRACT_ESCROW' | 'DAY3_REAUTH' | 'DELIVERY_VERIFY' | 'DISPUTE_SNAD';
  steps: DemoStep[];
}

export interface DemoStep {
  order: number;
  action: string;
  description: string;
  endpoint?: string;
  simulatedResponse?: Record<string, unknown>;
}

// ============================================
// API Response Wrappers
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    simulated: boolean;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

