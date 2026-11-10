import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { RefreshCw, CheckCircle, Clock, ShieldCheck, Lock } from 'lucide-react';
import type { Milestone } from '../../types';

interface MutatedAuthLedgerProps {
  milestones: Milestone[];
  onFastForwardDay3: (milestoneId: string) => void;
  onCapture: (milestoneId: string) => void;
}

const LedgerEmptyOverlay: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-8 text-center gap-2 pointer-events-none">
    <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#0070BA] mb-2">
      <Lock className="w-5 h-5" strokeWidth={1.75} />
    </div>
    <p className="text-sm font-bold text-[#0F172A] leading-[1.5]">
      No authorization holds recorded yet
    </p>
    <p className="text-xs font-normal text-[#6B7280] max-w-sm leading-[1.5]">
      Run Judge Demo Fixture 1 above to seed contract milestones and initialize PayPal authorization pointers.
    </p>
  </div>
);

export const MutatedAuthLedger: React.FC<MutatedAuthLedgerProps> = ({
  milestones,
  onFastForwardDay3,
  onCapture,
}) => {
  // Flatten milestone records into ledger rows
  const rowData = useMemo(() => {
    return milestones.map((m) => {
      const isMutated =
        m.activeAuthorizationId &&
        m.originalAuthorizationId &&
        m.activeAuthorizationId !== m.originalAuthorizationId;

      const latestHistory = m.authorizationHistory?.[m.authorizationHistory.length - 1];

      return {
        id: m.id,
        name: m.name,
        amount: `${m.amount.currency_code} $${m.amount.value}`,
        orderId: m.orderId || 'PENDING',
        originalAuthId: m.originalAuthorizationId || 'N/A',
        activeAuthId: m.activeAuthorizationId || 'N/A',
        isMutated,
        status: m.status,
        honorExpires: m.honorPeriodExpiresAt
          ? new Date(m.honorPeriodExpiresAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              month: 'short',
              day: 'numeric',
            })
          : 'N/A',
        requestId: latestHistory?.requestId
          ? `${latestHistory.requestId.substring(0, 8)}...`
          : 'UUID-36',
        historyCount: m.authorizationHistory?.length || 0,
      };
    });
  }, [milestones]);

  const columnDefs = useMemo<ColDef[]>(() => {
    return [
      {
        headerName: 'Milestone',
        field: 'name',
        flex: 1.8,
        minWidth: 220,
        cellRenderer: (params: any) => (
          <div className="h-full flex items-center font-medium text-sm text-[#0F172A]">
            <span className="truncate">{params.value}</span>
          </div>
        ),
      },
      {
        headerName: 'Amount',
        field: 'amount',
        width: 130,
        cellRenderer: (params: any) => (
          <div className="h-full flex items-center text-sm font-bold text-[#0F172A] tabular-nums">
            {params.value}
          </div>
        ),
      },
      {
        headerName: 'Initial Auth ID',
        field: 'originalAuthId',
        width: 170,
        cellRenderer: (params: any) => (
          <div className="h-full flex items-center">
            <span className="h-6 px-2 rounded-lg text-xs font-medium text-[#4B5563] bg-[#F1F5F9] border border-[#E2E8F0] inline-flex items-center tabular-nums truncate max-w-full">
              {params.value}
            </span>
          </div>
        ),
      },
      {
        headerName: 'Active (Mutated) Auth ID',
        field: 'activeAuthId',
        width: 240,
        cellRenderer: (params: any) => {
          const isMutated = params.data.isMutated;
          return (
            <div className="h-full flex items-center gap-2 min-w-0">
              <span
                className={`h-6 px-2 rounded-lg text-xs font-medium border inline-flex items-center tabular-nums truncate ${
                  isMutated
                    ? 'bg-blue-50 text-[#003087] border-blue-200 font-bold'
                    : 'bg-[#F8FAFC] text-[#4B5563] border-[#E2E8F0]'
                }`}
              >
                {params.value}
              </span>
              {isMutated && (
                <span
                  className="h-6 px-2 rounded-lg bg-[#0070BA] text-white text-xs font-bold inline-flex items-center shrink-0"
                  title="Mutated on Day-3 reauthorization"
                >
                  ROTATED
                </span>
              )}
            </div>
          );
        },
      },
      {
        headerName: 'Status',
        field: 'status',
        width: 150,
        cellRenderer: (params: any) => {
          const status = params.value;
          let color = 'bg-[#F1F5F9] text-[#4B5563] border-[#E2E8F0]';
          if (status === 'AUTHORIZED') color = 'bg-blue-50 text-[#003087] border-blue-200';
          if (status === 'REAUTHORIZED') color = 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
          if (status === 'CAPTURED') color = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
          if (status === 'VERIFIED') color = 'bg-blue-50 text-[#003087] border-blue-200 font-bold';
          if (status === 'VOIDED' || status === 'FAILED') color = 'bg-red-50 text-red-800 border-red-200';

          return (
            <div className="h-full flex items-center">
              <span className={`h-6 px-2 rounded-lg text-xs font-medium border inline-flex items-center ${color}`}>
                {status}
              </span>
            </div>
          );
        },
      },
      {
        headerName: '72h Honor Window',
        field: 'honorExpires',
        width: 160,
        cellRenderer: (params: any) => (
          <div className="h-full flex items-center gap-2 text-xs font-normal text-[#6B7280] tabular-nums">
            <Clock className="w-4 h-4 text-[#0070BA] shrink-0" strokeWidth={1.75} />
            <span className="truncate">{params.value}</span>
          </div>
        ),
      },
      {
        headerName: 'Idempotency Key',
        field: 'requestId',
        width: 140,
        cellRenderer: (params: any) => (
          <div className="h-full flex items-center text-xs font-normal text-[#6B7280] tabular-nums">
            {params.value}
          </div>
        ),
      },
      {
        headerName: 'Action',
        field: 'id',
        width: 160,
        cellRenderer: (params: any) => {
          const status = params.data.status;
          return (
            <div className="h-full flex items-center gap-2">
              {status === 'AUTHORIZED' && (
                <button
                  type="button"
                  onClick={() => onFastForwardDay3(params.value)}
                  className="h-8 px-2 text-xs font-medium bg-transparent hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] rounded-lg inline-flex items-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA]"
                  title="Simulate Day-3 Reauth & Mutate Auth ID"
                >
                  <RefreshCw className="w-4 h-4 text-[#0070BA]" strokeWidth={1.75} />
                  <span>Day-3 Reauth</span>
                </button>
              )}
              {status === 'VERIFIED' && (
                <button
                  type="button"
                  onClick={() => onCapture(params.value)}
                  className="h-8 px-4 text-xs font-bold bg-[#0070BA] hover:bg-[#003087] text-white rounded-lg shadow-subtle inline-flex items-center gap-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070BA]"
                >
                  <CheckCircle className="w-4 h-4" strokeWidth={1.75} />
                  <span>Capture</span>
                </button>
              )}
            </div>
          );
        },
      },
    ];
  }, [onFastForwardDay3, onCapture]);

  return (
    <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 sm:p-8 shadow-card">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0070BA] shrink-0">
            <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#0F172A] leading-[1.5]">
                AG Studio 3: Mutated Authorization Ledger
              </h2>
              <span className="h-6 px-2 rounded-lg text-xs font-medium bg-[#F1F5F9] text-[#4B5563] border border-[#E2E8F0] inline-flex items-center">
                Engine 1 & 2
              </span>
            </div>
            <p className="text-sm font-normal text-[#6B7280] leading-[1.6] mt-2">
              Tracks active vs original authorization_id pointers across 72h honor period renewals with 36-char idempotency keys
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-medium text-[#6B7280] shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#0070BA]" />
          <span>Live Pointer Synchronization Active</span>
        </div>
      </div>

      <div className="ag-theme-quartz w-full h-[384px]">
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          rowHeight={56}
          headerHeight={48}
          noRowsOverlayComponent={LedgerEmptyOverlay}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          pagination={true}
          paginationPageSize={5}
        />
      </div>
    </section>
  );
};

export default MutatedAuthLedger;
