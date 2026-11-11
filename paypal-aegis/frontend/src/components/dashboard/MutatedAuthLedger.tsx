import React, { useMemo, useState, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, GridApi } from 'ag-grid-community';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  SparklesIcon,
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState('');
  const gridApiRef = useRef<GridApi | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
  }, []);

  const onQuickFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuickFilter(val);
    if (gridApiRef.current) {
      gridApiRef.current.setGridOption('quickFilterText', val);
    }
  };

  // Flatten milestone records into ledger rows
  const rowData = useMemo(() => {
    return milestones.map((m) => {
      const isMutated = Boolean(
        m.activeAuthorizationId &&
        m.originalAuthorizationId &&
        m.activeAuthorizationId !== m.originalAuthorizationId
      );

      const latestHistory = m.authorizationHistory?.[m.authorizationHistory.length - 1];

      return {
        id: m.id,
        name: m.name,
        amount: `${m.amount.currency_code} $${m.amount.value}`,
        numericAmount: parseFloat(m.amount.value) || 0,
        orderId: m.orderId || '8CP91024MV91820',
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
          : '72h Active Window',
        requestId: latestHistory?.requestId || 'd3b0c442-98fc-1c14-9afb-f4c8996fb924',
        historyCount: m.authorizationHistory?.length || 0,
      };
    });
  }, [milestones]);

  const mutatedCount = useMemo(() => {
    return rowData.filter((r) => r.isMutated).length;
  }, [rowData]);

  const totalHeldValue = useMemo(() => {
    const heldStatuses = new Set(['AUTHORIZED', 'REAUTHORIZED', 'VERIFIED']);
    return rowData
      .filter((r) => heldStatuses.has(r.status))
      .reduce((acc, r) => acc + r.numericAmount, 0)
      .toFixed(2);
  }, [rowData]);

  const columnDefs = useMemo<ColDef[]>(() => {
    return [
      {
        headerName: 'Order ID',
        field: 'orderId',
        width: 155,
        minWidth: 145,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: any) => (
          <div className="flex items-center space-x-1.5 font-mono text-xs text-[#1C1917] h-full">
            <span className="font-semibold truncate">{params.value}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(params.value)}
              className="p-1 hover:text-[#0070BA] transition text-[#78716C]"
              title="Copy Order ID"
            >
              {copiedKey === params.value ? (
                <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ClipboardDocumentIcon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ),
      },
      {
        headerName: 'Milestone Deliverable',
        field: 'name',
        flex: 1,
        minWidth: 185,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: any) => (
          <div className="font-medium text-[#1C1917] flex items-center h-full">
            <span className="truncate">{params.value}</span>
          </div>
        ),
      },
      {
        headerName: 'Amount',
        field: 'amount',
        width: 120,
        minWidth: 110,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: any) => (
          <div className="flex items-center h-full font-mono text-[#1C1917] font-bold text-xs">
            {params.value}
          </div>
        ),
      },
      {
        headerName: 'Authorization Mutation Diff (Old → New)',
        field: 'activeAuthId',
        width: 345,
        minWidth: 330,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: any) => {
          const isMutated = params.data.isMutated;
          const orig = params.data.originalAuthId;
          const active = params.data.activeAuthId;

          if (isMutated) {
            return (
              <div className="flex items-center gap-1.5 font-mono text-xs h-full">
                <span
                  className="line-through text-[#78716C] bg-[#F5F5F4] px-1.5 py-0.5 rounded border border-[#E7E5E4] text-[11px]"
                  title={`Superseded Original ID: ${orig}`}
                >
                  {orig}
                </span>
                <ArrowRightIcon className="w-3 h-3 text-[#0070BA] flex-shrink-0 animate-pulse" />
                <span
                  className="font-bold text-[#0070BA] bg-[#E6F2FA] px-2 py-0.5 rounded border border-[#0070BA]/40 text-[11px]"
                  title={`Active Rotated ID: ${active}`}
                >
                  {active}
                </span>
                <span
                  className="text-[10px] bg-[#0070BA] text-white font-extrabold px-1.5 py-0.5 rounded shadow-sm tracking-wide"
                  title="Day-3 Reauthorization rotated authorization pointer"
                >
                  Rotated
                </span>
              </div>
            );
          }

          return (
            <div className="flex items-center gap-1.5 font-mono text-xs h-full">
              <span className="text-[#1C1917] bg-[#F9F8F5] px-2 py-0.5 rounded border border-[#E5E0D8] text-[11px]">
                {active}
              </span>
              <span className="text-[10px] text-[#78716C] bg-[#F5F5F4] px-1.5 py-0.5 rounded border border-[#E5E0D8]">
                Original
              </span>
            </div>
          );
        },
      },
      {
        headerName: '36-Char Idempotency UUID',
        field: 'requestId',
        width: 240,
        minWidth: 215,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: any) => {
          const val = params.value;
          return (
            <div className="flex items-center space-x-1.5 font-mono text-[11px] h-full">
              <span
                className="bg-[#F9F8F5] text-[#1C1917] px-2 py-0.5 rounded border border-[#E5E0D8] font-medium truncate max-w-[185px]"
                title={`PayPal-Request-Id UUID v4: ${val}`}
              >
                {val}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(val)}
                className="p-1 hover:text-[#0070BA] transition text-[#78716C]"
                title="Copy full 36-character UUID"
              >
                {copiedKey === val ? (
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        },
      },
      {
        headerName: 'Hold Status',
        field: 'status',
        width: 135,
        minWidth: 125,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: any) => {
          const status = params.value;
          const isCaptured = status === 'CAPTURED';
          const isAuthorized = status === 'AUTHORIZED' || status === 'REAUTHORIZED';
          const isVerified = status === 'VERIFIED';

          let badgeStyle = 'bg-[#F9F8F5] text-[#57534E] border-[#E5E0D8]';
          if (isCaptured) {
            badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold';
          } else if (isAuthorized) {
            badgeStyle = 'bg-[#E6F2FA] text-[#0070BA] border-[#0070BA]/40 font-bold';
          } else if (isVerified) {
            badgeStyle = 'bg-amber-50 text-amber-700 border-amber-300 font-bold';
          }

          return (
            <div className="flex items-center h-full">
              <span className={`px-2.5 py-0.5 rounded-md text-xs border ${badgeStyle}`}>
                {status}
              </span>
            </div>
          );
        },
      },
      {
        headerName: '72h Window',
        field: 'honorExpires',
        width: 140,
        minWidth: 130,
        cellRenderer: (params: any) => (
          <div className="flex items-center text-xs text-[#57534E] h-full">
            <ClockIcon className="w-3.5 h-3.5 mr-1 text-[#0070BA] flex-shrink-0" />
            <span className="truncate">{params.value}</span>
          </div>
        ),
      },
      {
        headerName: 'Lifecycle Action',
        field: 'id',
        width: 140,
        minWidth: 130,
        cellRenderer: (params: any) => {
          const status = params.data.status;
          return (
            <div className="flex items-center space-x-1.5 h-full">
              {status === 'AUTHORIZED' && (
                <button
                  onClick={() => onFastForwardDay3(params.value)}
                  className="px-2.5 py-1 text-xs bg-white hover:bg-[#F4F1EA] text-[#0070BA] border border-[#E5E0D8] rounded-lg flex items-center gap-1.5 transition shadow-subtle font-semibold"
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
              {status === 'CAPTURED' && (
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckIcon className="w-3.5 h-3.5" />
                  Settled
                </span>
              )}
            </div>
          );
        },
      },
    ];
  }, [onFastForwardDay3, onCapture, copiedKey]);

  return (
    <section className="bg-white border border-[#E5E0D8] rounded-xl p-5 shadow-subtle w-full">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-[#F4F1EA] text-[#0070BA] border border-[#E5E0D8]">
            <ShieldCheckIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#1C1917]">
              Authorization Ledger
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              Tracks active and superseded authorization IDs across 72h hold renewals with idempotency keys
            </p>
          </div>
        </div>

        {/* Real-time Summary Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-[#F9F8F5] px-3 py-1 rounded-md border border-[#E5E0D8] flex items-center gap-1.5">
            <span className="text-[#57534E]">Total Milestones:</span>
            <span className="font-bold text-[#1C1917]">{rowData.length}</span>
          </div>
          <div className="bg-[#E6F2FA] text-[#0070BA] px-3 py-1 rounded-md border border-[#0070BA]/30 flex items-center gap-1.5 font-semibold">
            <SparklesIcon className="w-3.5 h-3.5" />
            <span>Rotated IDs:</span>
            <span className="font-mono font-bold">{mutatedCount}</span>
          </div>
          <div className="bg-[#F9F8F5] px-3 py-1 rounded-md border border-[#E5E0D8] flex items-center gap-1.5 font-mono">
            <span className="text-[#57534E]">Total Held:</span>
            <span className="font-bold text-[#1C1917]">${totalHeldValue} USD</span>
          </div>
        </div>
      </div>

      {/* Grid Controls: Quick Filter Search Input */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="relative w-full max-w-sm">
          <MagnifyingGlassIcon className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
          <input
            id="ledger-quick-filter"
            name="ledgerQuickFilter"
            aria-label="Quick search across all ledger columns"
            type="text"
            value={quickFilter}
            onChange={onQuickFilterChange}
            placeholder="Quick search across all columns (Order ID, Auth ID, UUID)..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F9F8F5] border border-[#E5E0D8] rounded-lg text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#0070BA] focus:ring-1 focus:ring-[#0070BA] transition"
          />
        </div>
        <div className="text-[11px] text-[#78716C] hidden sm:block">
          {rowData.length === 0 ? 'No authorization records yet' : `${rowData.length} milestone record${rowData.length === 1 ? '' : 's'}`}
        </div>
      </div>

      {/* AG Grid React Container */}
      <div className="ag-theme-quartz w-full h-[310px] rounded-lg border border-[#E5E0D8] overflow-hidden">
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          getRowClass={(params) =>
            params.data?.isMutated
              ? 'ag-row-mutated animate-pulse ring-2 ring-blue-500 bg-blue-500/10'
              : ''
          }
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          pagination={true}
          paginationPageSize={5}
          paginationPageSizeSelector={[5, 10, 20, 50]}
          onGridReady={onGridReady}
          animateRows={true}
          rowHeight={48}
          headerHeight={38}
        />
      </div>
    </section>
  );
};

export default MutatedAuthLedger;
