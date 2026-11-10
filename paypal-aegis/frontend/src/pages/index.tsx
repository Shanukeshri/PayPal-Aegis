import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { io, Socket } from 'socket.io-client';
import {
  ShieldCheckIcon,
  CurrencyDollarIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
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
    <div className="min-h-screen bg-[#F9F8F5] text-[#1C1917] flex flex-col font-sans">
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

      {/* Main Container - 60-30-10 palette: Primary (#F9F8F5), Secondary (#FFFFFF / #1C1917 / #E5E0D8), Accent (#0070BA) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Executive Header Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Protected Escrow Funds */}
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex items-center justify-between hover:border-[#D6D0C5] transition-colors">
            <div>
              <span className="text-xs font-semibold text-[#57534E] uppercase tracking-wider block">
                Active Escrow Holds
              </span>
              <span className="text-xl font-bold text-[#1C1917] font-mono mt-0.5 block">
                ${totalLockedAmount.toFixed(2)} USD
              </span>
              <span className="text-xs text-[#57534E] block mt-1">
                intent: "AUTHORIZE" holds
              </span>
            </div>
            <div className="p-3 bg-[#F4F1EA] text-[#0070BA] rounded-lg border border-[#E5E0D8]">
              <LockClosedIcon className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Captured Milestone Funds */}
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex items-center justify-between hover:border-[#D6D0C5] transition-colors">
            <div>
              <span className="text-xs font-semibold text-[#57534E] uppercase tracking-wider block">
                Settled Milestones
              </span>
              <span className="text-xl font-bold text-[#0070BA] font-mono mt-0.5 block">
                ${totalCapturedAmount.toFixed(2)} USD
              </span>
              <span className="text-xs text-[#57534E] block mt-1">
                Evidence-verified captures
              </span>
            </div>
            <div className="p-3 bg-[#F4F1EA] text-[#0070BA] rounded-lg border border-[#E5E0D8]">
              <CurrencyDollarIcon className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Rolling 90-Day Dispute Ratio */}
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex items-center justify-between hover:border-[#D6D0C5] transition-colors">
            <div>
              <span className="text-xs font-semibold text-[#57534E] uppercase tracking-wider block">
                Dispute Ratio Radar
              </span>
              <span className="text-xl font-bold text-[#1C1917] font-mono mt-0.5 block">
                {ratioSnapshot ? (ratioSnapshot.ratio * 100).toFixed(2) + '%' : '1.33%'}
              </span>
              <span className="text-xs text-[#57534E] block mt-1">
                1.5% High Volume Threshold
              </span>
            </div>
            <div className="p-3 bg-[#F4F1EA] text-[#1C1917] rounded-lg border border-[#E5E0D8]">
              <ExclamationTriangleIcon className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: HITL Gate Queue */}
          <div className="bg-white border border-[#E5E0D8] rounded-xl p-4 shadow-subtle flex items-center justify-between hover:border-[#D6D0C5] transition-colors">
            <div>
              <span className="text-xs font-semibold text-[#57534E] uppercase tracking-wider block">
                HITL Approval Gate
              </span>
              <span className="text-xl font-bold text-[#1C1917] font-mono mt-0.5 block">
                {pendingApprovals.length} Action{pendingApprovals.length === 1 ? '' : 's'}
              </span>
              <span className="text-xs text-[#57534E] block mt-1">
                Awaiting Human Confirmation
              </span>
            </div>
            <div className="p-3 bg-[#F4F1EA] text-[#1C1917] rounded-lg border border-[#E5E0D8]">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
          </div>
        </div>

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
      <footer className="border-t border-[#E5E0D8] bg-[#F4F1EA] py-4 px-6 text-center text-xs text-[#57534E]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-[#1C1917]">PayPal Aegis</strong> — Built for the PayPal AI Hackathon (Build What's Next with PayPal & AI).
          </span>
          <span className="font-mono text-[11px] text-[#57534E]">
            APIMatic Context Grounded • AG Studio 3 • Bryntum Suite • Channel3 • Elastic Cloud • Render Workflows
          </span>
        </div>
      </footer>
    </div>
  );
}
