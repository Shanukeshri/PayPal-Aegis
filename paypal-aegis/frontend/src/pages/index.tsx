import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { io, Socket } from 'socket.io-client';
import { ShieldCheck, DollarSign, Lock, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import JudgeDemoToolbar from '../components/toolbar/JudgeDemoToolbar';
import DisputeRatioRadar from '../components/dashboard/DisputeRatioRadar';
import MutatedAuthLedger from '../components/dashboard/MutatedAuthLedger';
import BryntumGanttView from '../components/gantt/BryntumGanttView';
import HITLApprovalDrawer from '../components/hitl/HITLApprovalDrawer';
import type {
  Milestone,
  Project,
  HITLApprovalRequest,
  DisputeRatioSnapshot,
  PayPalDispute,
} from '../types';

export default function Dashboard() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<HITLApprovalRequest[]>([]);
  const [ratioSnapshot, setRatioSnapshot] = useState<DisputeRatioSnapshot | null>(null);
  const [disputes, setDisputes] = useState<PayPalDispute[]>([]);
  const [demoStatus, setDemoStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);

  // Fetch all live dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      const [statusRes, milestonesData, approvalsData, ratioData, disputesData] =
        await Promise.all([
          api.getDemoStatus().catch(() => ({ data: {} })),
          api.getMilestones().catch(() => []),
          api.getPendingApprovals().catch(() => []),
          api.getDisputeRatio().catch(() => null),
          api.getDisputes().catch(() => []),
        ]);

      setDemoStatus(statusRes.data || {});
      setMilestones(milestonesData || []);
      setPendingApprovals(approvalsData || []);
      if (ratioData && ratioData.current) {
        setRatioSnapshot(ratioData.current);
      }
      setDisputes(disputesData || []);
    } catch (err) {
      console.error('Error fetching dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize data and real-time Socket.IO listener
  useEffect(() => {
    loadDashboardData();

    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    let socket: Socket;

    try {
      socket = io(socketUrl, { transports: ['websocket', 'polling'] });

      socket.on('connect', () => {
        setSocketConnected(true);
      });

      socket.on('disconnect', () => {
        setSocketConnected(false);
      });

      socket.on('hitl:action_intercepted', () => {
        loadDashboardData();
      });

      socket.on('hitl:action_resolved', () => {
        loadDashboardData();
      });

      socket.on('schedule:sync', () => {
        loadDashboardData();
      });

      return () => {
        socket.disconnect();
      };
    } catch (err) {
      console.warn('Socket.IO connection failed', err);
    }
  }, [loadDashboardData]);

  // Fast-Forward Day-3 handler for individual milestone row
  const handleFastForwardDay3 = async (milestoneId: string) => {
    try {
      await api.fixtureFastForwardDay3(milestoneId);
      loadDashboardData();
    } catch (err: any) {
      alert(`Error during Day-3 reauthorization: ${err.message}`);
    }
  };

  // Capture handler
  const handleCapture = async (milestoneId: string) => {
    try {
      await api.captureMilestone(milestoneId);
      loadDashboardData();
    } catch (err: any) {
      alert(`Error capturing milestone: ${err.message}`);
    }
  };

  // Aggregate stats
  const totalLockedAmount = milestones
    .filter((m) => m.status === 'AUTHORIZED' || m.status === 'REAUTHORIZED' || m.status === 'VERIFIED')
    .reduce((sum, m) => sum + parseFloat(m.amount.value || '0'), 0);

  const totalCapturedAmount = milestones
    .filter((m) => m.status === 'CAPTURED')
    .reduce((sum, m) => sum + parseFloat(m.amount.value || '0'), 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Head>
        <title>PayPal Aegis — Milestone Escrow & Dispute Compliance OS</title>
        <meta
          name="description"
          content="Autonomous Milestone Escrow, Delivery Verification & Dispute Compliance Operating System"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Top 1-Click Judge Demo Toolbar */}
      <JudgeDemoToolbar
        onActionComplete={loadDashboardData}
        statusInfo={{
          mode: demoStatus.mode,
          paypalConfigured: demoStatus.paypalConfigured,
          pendingApprovalsCount: pendingApprovals.length,
        }}
      />

      {/* Main Constrained Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Executive KPI Summary Grid */}
        <section
          aria-label="Executive escrow metrics"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {/* Card 1: Active Escrow Holds */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-card flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider leading-[1.5] block">
                Active Escrow Holds
              </span>
              <span className="text-2xl font-bold text-[#0F172A] tabular-nums leading-[1.25] block mt-2">
                {loading ? '—' : `$${totalLockedAmount.toFixed(2)} USD`}
              </span>
              <span className="text-xs font-normal text-[#6B7280] leading-[1.5] block mt-2">
                intent: &ldquo;AUTHORIZE&rdquo; holds
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#0070BA] border border-blue-200 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          {/* Card 2: Settled Milestones */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-card flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider leading-[1.5] block">
                Settled Milestones
              </span>
              <span className="text-2xl font-bold text-[#0F172A] tabular-nums leading-[1.25] block mt-2">
                {loading ? '—' : `$${totalCapturedAmount.toFixed(2)} USD`}
              </span>
              <span className="text-xs font-normal text-[#6B7280] leading-[1.5] block mt-2">
                Evidence-verified captures
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          {/* Card 3: Rolling 90-Day Dispute Ratio */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-card flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider leading-[1.5] block">
                Dispute Ratio Radar
              </span>
              <span className="text-2xl font-bold text-[#0F172A] tabular-nums leading-[1.25] block mt-2">
                {ratioSnapshot ? `${(ratioSnapshot.ratio * 100).toFixed(2)}%` : '1.33%'}
              </span>
              <span className="text-xs font-normal text-[#6B7280] leading-[1.5] block mt-2">
                1.5% High Volume Threshold
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>

          {/* Card 4: HITL Gate Queue */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-card flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider leading-[1.5] block">
                HITL Approval Gate
              </span>
              <span className="text-2xl font-bold text-[#0F172A] tabular-nums leading-[1.25] block mt-2">
                {pendingApprovals.length} Actions
              </span>
              <span className="text-xs font-normal text-[#6B7280] leading-[1.5] block mt-2">
                Awaiting Human Confirmation
              </span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
            </div>
          </div>
        </section>

        {/* 1.5% Dispute Ratio Radar Component */}
        <DisputeRatioRadar ratioSnapshot={ratioSnapshot} />

        {/* SafeGate HITL Approval Drawer */}
        <HITLApprovalDrawer
          pendingApprovals={pendingApprovals}
          onActionComplete={loadDashboardData}
        />

        {/* AG Studio 3: Mutated Authorization ID Ledger */}
        <MutatedAuthLedger
          milestones={milestones}
          onFastForwardDay3={handleFastForwardDay3}
          onCapture={handleCapture}
        />

        {/* Bryntum Gantt & Calendar Operating View */}
        <BryntumGanttView milestones={milestones} disputes={disputes} />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-wrap items-center justify-between gap-4 text-xs text-[#6B7280] leading-[1.5]">
          <span>
            <strong className="font-bold text-[#0F172A]">PayPal Aegis</strong> — Built for the PayPal AI Hackathon (Build What&apos;s Next with PayPal &amp; AI).
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  socketConnected ? 'bg-emerald-600' : 'bg-slate-400'
                }`}
              />
              <span>{socketConnected ? 'Realtime Sync Connected' : 'Realtime Sync Standby'}</span>
            </span>
            <span>
              APIMatic Context Grounded • AG Studio 3 • Bryntum Suite • Channel3 • Elastic Cloud • Render Workflows
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
