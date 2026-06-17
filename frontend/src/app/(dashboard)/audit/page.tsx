'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: any;
  newValues: any;
  ipAddress: string | null;
  createdAt: string;
  user: { name: string; role: string };
}

const ACTION_STYLE: Record<string, string> = {
  INVOICE_CREATE:    'bg-green-100 text-green-700',
  INVOICE_CANCEL:    'bg-red-100 text-red-600',
  STOCK_IN:          'bg-blue-100 text-blue-700',
  STOCK_OUT:         'bg-orange-100 text-orange-700',
  PRICE_CHANGE:      'bg-purple-100 text-purple-700',
  STOCK_ADJUST:      'bg-yellow-100 text-yellow-700',
  RETURN_PROCESS:    'bg-pink-100 text-pink-700',
  USER_CREATE:       'bg-cyan-100 text-cyan-700',
  USER_UPDATE:       'bg-indigo-100 text-indigo-700',
  DISCOUNT_OVERRIDE: 'bg-amber-100 text-amber-700',
};

const ACTIONS = [
  '', 'INVOICE_CREATE', 'INVOICE_CANCEL', 'STOCK_IN', 'STOCK_OUT',
  'PRICE_CHANGE', 'STOCK_ADJUST', 'RETURN_PROCESS', 'USER_CREATE',
  'USER_UPDATE', 'DISCOUNT_OVERRIDE',
];

const PAGE_SIZE = 25;
const PAGE_WINDOW = 7;

export default function AuditPage() {
  const [logs, setLogs]       = useState<AuditLog[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [action, setAction]   = useState('');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (action) params.set('action', action);
      if (from)   params.set('from', from);
      if (to)     params.set('to', to);
      const { data } = await api.get(`/audit/logs?${params}`);
      setLogs(data.data);
      setTotal(data.total);
      setPage(p);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [action, from, to]);

  useEffect(() => { load(1); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // 7-page sliding window
  const pageNums = (() => {
    if (totalPages <= PAGE_WINDOW) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const half = Math.floor(PAGE_WINDOW / 2);
    let start = Math.max(1, page - half);
    let end   = start + PAGE_WINDOW - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - PAGE_WINDOW + 1); }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })();

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} total entries</p>
        </div>
        <button
          onClick={() => load(page)}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-4 sm:px-6 py-3 flex items-center gap-2 flex-wrap shrink-0">
        <Filter className="h-4 w-4 text-gray-400 shrink-0" />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        >
          {ACTIONS.map((a) => <option key={a} value={a}>{a || 'All Actions'}</option>)}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          onClick={() => { setAction(''); setFrom(''); setTo(''); }}
          className="text-xs text-red-600 hover:underline"
        >
          Clear
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : error ? (
          <div className="flex justify-center items-center h-40 text-red-500">{error}</div>
        ) : logs.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-gray-400">No logs found</div>
        ) : (
          <>
            {/* ── Mobile: card list ─────────────────────────────── */}
            <div className="sm:hidden space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="bg-white rounded-xl border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_STYLE[log.action] || 'bg-gray-100 text-gray-600'}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                      {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">{log.entityType}</span>
                    <span className="text-gray-400 font-mono text-xs ml-2 truncate">{log.entityId.slice(0, 8)}…</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    By <span className="font-medium text-gray-700">{log.user?.name}</span>
                    {' · '}{log.user?.role?.replace(/_/g, ' ')}
                    {log.ipAddress && <span className="ml-1 font-mono text-gray-400">({log.ipAddress})</span>}
                  </div>
                  {(log.oldValues || log.newValues) && (
                    <button
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {expanded === log.id ? 'Hide details' : 'View details'}
                    </button>
                  )}
                  {expanded === log.id && (
                    <div className="grid grid-cols-1 gap-3 text-xs font-mono mt-1">
                      {log.oldValues && (
                        <div>
                          <p className="font-semibold text-gray-500 mb-1 font-sans">Old Values</p>
                          <pre className="bg-red-50 p-2 rounded overflow-auto max-h-24 text-red-800 text-xs">
                            {JSON.stringify(log.oldValues, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.newValues && (
                        <div>
                          <p className="font-semibold text-gray-500 mb-1 font-sans">New Values</p>
                          <pre className="bg-green-50 p-2 rounded overflow-auto max-h-24 text-green-800 text-xs">
                            {JSON.stringify(log.newValues, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Desktop: table ────────────────────────────────── */}
            <div className="hidden sm:block bg-white rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">By</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_STYLE[log.action] || 'bg-gray-100 text-gray-600'}`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{log.entityType}</p>
                          <p className="text-xs text-gray-400 font-mono truncate max-w-[120px]">{log.entityId}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{log.user?.name}</p>
                          <p className="text-xs text-gray-400">{log.user?.role?.replace(/_/g, ' ')}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ipAddress || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3">
                          {(log.oldValues || log.newValues) && (
                            <button
                              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              {expanded === log.id ? 'Hide' : 'Details'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded === log.id && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 bg-gray-50">
                            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                              {log.oldValues && (
                                <div>
                                  <p className="font-semibold text-gray-500 mb-1 font-sans">Old Values</p>
                                  <pre className="bg-red-50 p-2 rounded overflow-auto max-h-24 text-red-800">
                                    {JSON.stringify(log.oldValues, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.newValues && (
                                <div>
                                  <p className="font-semibold text-gray-500 mb-1 font-sans">New Values</p>
                                  <pre className="bg-green-50 p-2 rounded overflow-auto max-h-24 text-green-800">
                                    {JSON.stringify(log.newValues, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1 mt-4">
            <button
              onClick={() => load(page - 1)}
              disabled={page === 1}
              className="p-2 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNums[0] > 1 && (
              <>
                <button onClick={() => load(1)} className="px-3 py-1.5 rounded-lg text-sm border text-gray-600 hover:bg-gray-50">1</button>
                {pageNums[0] > 2 && <span className="px-1 text-gray-400">…</span>}
              </>
            )}
            {pageNums.map((p) => (
              <button
                key={p}
                onClick={() => load(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${p === page ? 'bg-red-700 text-white' : 'border text-gray-600 hover:bg-gray-50'}`}
              >
                {p}
              </button>
            ))}
            {pageNums[pageNums.length - 1] < totalPages && (
              <>
                {pageNums[pageNums.length - 1] < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}
                <button onClick={() => load(totalPages)} className="px-3 py-1.5 rounded-lg text-sm border text-gray-600 hover:bg-gray-50">{totalPages}</button>
              </>
            )}
            <button
              onClick={() => load(page + 1)}
              disabled={page === totalPages}
              className="p-2 rounded-lg border text-gray-600 hover:bg-gray-50 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
