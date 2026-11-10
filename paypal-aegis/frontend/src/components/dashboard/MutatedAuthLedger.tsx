import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import type { Milestone } from '../../types';

interface MutatedAuthLedgerProps {
  milestones: Milestone[];
  onFastForwardDay3: (milestoneId: string) => void;
  onCapture: (milestoneId: string) => void;
}

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
          : m.status === 'DRAFT'
          ? 'Staged (Pre-Auth)'
          : 'Pending Lock',
        historyCount: m.authorizationHistory?.length || 0,
      };
    });
  }, [milestones]);

  const columnDefs = useMemo<ColDef[]>(() => {
    return [
      {
        headerName: 'Milestone',
        field: 'name',
        flex: 2,
        minWidth: 260,
        cellRenderer: (params: any) => (
          <div className="font-medium text-[#1C1917] flex items-center space-x-1.5">
            <span className="truncate">{params.value}</span>
          </div>
        ),
      },
      {
        headerName: 'Amount',
        field: 'amount',
        width: 140,
        minWidth: 130,
        cellClass: 'font-mono text-[#1C1917] font-semibold',
      },
      {
        headerName: 'Initial Auth ID',
        field: 'originalAuthId',
        width: 180,
        minWidth: 170,
        cellRenderer: (params: any) => (
          <span className="font-mono text-xs text-[#57534E] bg-[#F9F8F5] px-2 py-0.5 rounded-md border border-[#E5E0D8]">
            {params.value}
          </span>
        ),
      },
      {
        headerName: 'Active (Mutated) Auth ID',
        field: 'activeAuthId',
        width: 270,
        minWidth: 260,
        cellRenderer: (params: any) => {
          const isMutated = params.data.isMutated;
          return (
            <div className="flex items-center space-x-2">
              <span
                className={`font-mono text-xs px-2 py-0.5 rounded-md border font-medium ${
                  isMutated
                    ? 'bg-[#F4F1EA] text-[#0070BA] border-[#0070BA]/40'
                    : 'bg-[#F9F8F5] text-[#57534E] border-[#E5E0D8]'
                }`}
              >
                {params.value}
              </span>
              {isMutated && (
                <span
                  className="text-[10px] bg-[#0070BA] text-white font-bold px-2 py-0.5 rounded-md shadow-subtle tracking-wide"
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
        width: 140,
        minWidth: 130,
        cellRenderer: (params: any) => {
          const status = params.value;
          const isAccent = status === 'CAPTURED' || status === 'REAUTHORIZED' || status === 'AUTHORIZED';
          const badgeClass = isAccent
            ? 'bg-[#F4F1EA] text-[#0070BA] border-[#0070BA]/40 font-semibold'
            : 'bg-[#F9F8F5] text-[#57534E] border-[#E5E0D8]';

          return (
            <span className={`px-2.5 py-0.5 rounded-md text-xs border ${badgeClass}`}>
              {status}
            </span>
          );
        },
      },
      {
        headerName: '72h Honor Window',
        field: 'honorExpires',
        width: 160,
        minWidth: 150,
        cellRenderer: (params: any) => (
          <div className="flex items-center text-xs text-[#57534E]">
            <ClockIcon className="w-3.5 h-3.5 mr-1.5 text-[#0070BA]" />
            <span>{params.value}</span>
          </div>
        ),
      },
      {
        headerName: 'Idempotency Key',
        field: 'requestId',
        width: 160,
        minWidth: 150,
        cellRenderer: (params: any) => {
          const val = params.value;
          const isStaged = val === 'Staged (Pre-Auth)' || val === 'Pending Lock';
          return isStaged ? (
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[#F4F1EA] text-[#57534E] border border-[#E5E0D8]">
              {val}
            </span>
          ) : (
            <span className="font-mono text-xs text-[#1C1917] bg-[#F9F8F5] px-2 py-0.5 rounded-md border border-[#E5E0D8] font-medium" title={val}>
              {val}
            </span>
          );
        },
      },
      {
        headerName: 'Action',
        field: 'id',
        width: 150,
        minWidth: 140,
        cellRenderer: (params: any) => {
          const status = params.data.status;
          return (
            <div className="flex items-center space-x-1.5 py-1">
              {status === 'AUTHORIZED' && (
                <button
                  onClick={() => onFastForwardDay3(params.value)}
                  className="px-2.5 py-1 text-xs bg-white hover:bg-[#F4F1EA] text-[#0070BA] border border-[#E5E0D8] rounded-lg flex items-center gap-1.5 transition shadow-subtle"
                  title="Simulate Day-3 Reauth & Mutate Auth ID"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                  Day-3 Reauth
                </button>
              )}
              {status === 'VERIFIED' && (
                <button
                  onClick={() => onCapture(params.value)}
                  className="px-2.5 py-1 text-xs bg-[#0070BA] hover:bg-[#005EA6] text-white rounded-lg flex items-center gap-1.5 font-semibold transition shadow-subtle"
                >
                  <CheckCircleIcon className="w-3.5 h-3.5 text-white" />
                  Capture
                </button>
              )}
            </div>
          );
        },
      },
    ];
  }, [onFastForwardDay3, onCapture]);

  return (
    <section className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-[#F4F1EA] text-[#0070BA] border border-[#E5E0D8]">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1C1917] flex items-center gap-2">
              AG Studio 3: Mutated Authorization Ledger
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F4F1EA] text-[#57534E] border border-[#E5E0D8]">
                Engine 1 & 2
              </span>
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Tracks active vs original authorization_id pointers across 72h honor period renewals with 36-char idempotency keys
            </p>
          </div>
        </div>

        <div className="text-xs text-[#57534E] font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#0070BA]"></span>
          Live Pointer Synchronization Active
        </div>
      </div>

      <div className="ag-theme-quartz w-full h-[260px]">
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
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
