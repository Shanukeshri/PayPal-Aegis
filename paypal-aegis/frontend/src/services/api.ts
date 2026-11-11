import axios from 'axios';
import type {
  Project,
  Milestone,
  HITLApprovalRequest,
  DisputeRatioSnapshot,
  PayPalDispute,
  DisputeTriageResult,
} from '../types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:3001/api');

const client = axios.create({
  baseURL: API_BASE,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Demo status & fixtures
  getDemoStatus: () => client.get('/demo/status').then((r) => r.data),
  getEcosystemFeed: () => client.get('/demo/ecosystem-feed').then((r) => r.data.data),
  resetDemo: () => client.post('/demo/reset').then((r) => r.data),

  // Judge Demo Buttons & Custom Playground
  fixtureSeedContract: (payload?: any) =>
    client.post('/demo/fixtures/seed-contract', payload || {}).then((r) => r.data),
  fixtureFastForwardDay3: (milestoneId?: string, simulateNegativeTesting = false) =>
    client.post('/demo/fixtures/fast-forward-day3', { milestoneId, simulateNegativeTesting }).then((r) => r.data),
  fixtureVerifyDeliverable: (payloadOrMilestoneId?: any) => {
    const payload =
      typeof payloadOrMilestoneId === 'string'
        ? { milestoneId: payloadOrMilestoneId }
        : payloadOrMilestoneId || {};
    return client.post('/demo/fixtures/verify-deliverable', payload).then((r) => r.data);
  },
  fixtureSimulateDispute: (payload?: any) =>
    client.post('/demo/fixtures/simulate-dispute', payload || {}).then((r) => r.data),

  // Escrow / Milestones
  getProjects: () => client.get<any, { data: { success: boolean; data: Project[] } }>('/escrow/projects').then((r) => r.data.data),
  getMilestones: () => client.get<any, { data: { success: boolean; data: Milestone[] } }>('/escrow/milestones').then((r) => r.data.data),
  createMilestoneHold: (id: string) => client.post(`/escrow/milestones/${id}/hold`).then((r) => r.data),
  reauthorizeMilestone: (id: string) => client.post(`/escrow/milestones/${id}/reauthorize`).then((r) => r.data),
  captureMilestone: (id: string, finalCapture = false) =>
    client.post(`/escrow/milestones/${id}/capture`, { finalCapture }).then((r) => r.data),
  voidMilestone: (id: string, reason?: string) =>
    client.post(`/escrow/milestones/${id}/void`, { reason }).then((r) => r.data),
  verifyDeliverable: (id: string, name?: string) =>
    client.post(`/escrow/milestones/${id}/deliverable`, { name }).then((r) => r.data),
  clientApproveMilestone: (id: string) =>
    client.post(`/escrow/milestones/${id}/client-approve`).then((r) => r.data),
  clientDisputeMilestone: (
    id: string,
    payload?: { reason?: string; message?: string; disputeAmount?: string }
  ) => client.post(`/escrow/milestones/${id}/client-dispute`, payload || {}).then((r) => r.data),

  // Disputes & Ratio Radar
  getDisputes: () => client.get<any, { data: { success: boolean; data: PayPalDispute[] } }>('/disputes').then((r) => r.data.data),
  getDisputeRatio: () => client.get<any, { data: { success: boolean; data: { current: DisputeRatioSnapshot; history: DisputeRatioSnapshot[] } } }>('/disputes/ratio').then((r) => r.data.data),
  makeDisputeOffer: (id: string, offerAmount: any, note: string) =>
    client.post(`/disputes/${id}/make-offer`, { offerAmount, note }).then((r) => r.data),
  acceptDisputeOffer: (id: string, settlementAmount?: string) =>
    client.post(`/disputes/${id}/accept-offer`, { settlementAmount }).then((r) => r.data),
  provideDisputeEvidence: (id: string) => client.post(`/disputes/${id}/provide-evidence`).then((r) => r.data),
  simulateEscalatedChargeback: (disputeAmount = '350.00') =>
    client.post('/disputes/simulate-escalated-chargeback', { disputeAmount }).then((r) => r.data),
  getEvidencePdfUrl: (id: string) => `${API_BASE}/disputes/${id}/evidence-pdf`,
  getRagTelemetry: () => client.get('/disputes/telemetry/rag').then((r) => r.data.data),
  getAgentTelemetry: () => client.get('/disputes/telemetry/agent').then((r) => r.data.data),

  // HITL Approval Gate
  getPendingApprovals: () => client.get<any, { data: { success: boolean; data: HITLApprovalRequest[] } }>('/hitl/pending').then((r) => r.data.data),
  getAllApprovals: () => client.get<any, { data: { success: boolean; data: HITLApprovalRequest[] } }>('/hitl/all').then((r) => r.data.data),
  approveHitlAction: (id: string, approver?: string) =>
    client.post(`/hitl/${id}/approve`, { approver }).then((r) => r.data),
  rejectHitlAction: (id: string, rejecter?: string, reason?: string) =>
    client.post(`/hitl/${id}/reject`, { rejecter, reason }).then((r) => r.data),

  // SafeGate Reporting
  getBalances: () => client.get('/safegate/balances').then((r) => r.data),
  getTools: (phase = 'ESCROW_SETUP') => client.get(`/safegate/tools?phase=${phase}`).then((r) => r.data),
};

export default api;

