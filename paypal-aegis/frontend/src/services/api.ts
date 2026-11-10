import axios from 'axios';
import type {
  Project,
  Milestone,
  HITLApprovalRequest,
  DisputeRatioSnapshot,
  PayPalDispute,
  DisputeTriageResult,
} from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Demo status & fixtures
  getDemoStatus: () => client.get('/demo/status').then((r) => r.data),
  resetDemo: () => client.post('/demo/reset').then((r) => r.data),

  // Judge Demo Buttons
  fixtureSeedContract: () => client.post('/demo/fixtures/seed-contract').then((r) => r.data),
  fixtureFastForwardDay3: (milestoneId?: string, simulateNegativeTesting = false) =>
    client.post('/demo/fixtures/fast-forward-day3', { milestoneId, simulateNegativeTesting }).then((r) => r.data),
  fixtureVerifyDeliverable: (milestoneId?: string) =>
    client.post('/demo/fixtures/verify-deliverable', { milestoneId }).then((r) => r.data),
  fixtureSimulateDispute: () => client.post('/demo/fixtures/simulate-dispute').then((r) => r.data),

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

  // Disputes & Ratio Radar
  getDisputes: () => client.get<any, { data: { success: boolean; data: PayPalDispute[] } }>('/disputes').then((r) => r.data.data),
  getDisputeRatio: () => client.get<any, { data: { success: boolean; data: { current: DisputeRatioSnapshot; history: DisputeRatioSnapshot[] } } }>('/disputes/ratio').then((r) => r.data.data),
  makeDisputeOffer: (id: string, offerAmount: any, note: string) =>
    client.post(`/disputes/${id}/make-offer`, { offerAmount, note }).then((r) => r.data),
  provideDisputeEvidence: (id: string) => client.post(`/disputes/${id}/provide-evidence`).then((r) => r.data),
  getEvidencePdfUrl: (id: string) => `${API_BASE}/disputes/${id}/evidence-pdf`,

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

