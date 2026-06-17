'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
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
  INVOICE_CREATE: 'bg-green-100 text-green-700',
  INVOICE_CANCEL: 'bg-red-100 text-red-600',
  STOCK_IN: 'bg-blue-100 text-blue-700',
  STOCK_OUT: 'bg-orange-100 text-orange-700',
  PRICE_CHANGE: 'bg-purple-100 text-purple-700',
  STOCK_ADJUST: 'bg-yellow-100 text-yellow-700',
  RETURN_PROCESS: 'bg-pink-100 text-pink-700',
  USER_CREATE: 'bg-cyan-100 text-cyan-700',
  USER_UPDATE: 'bg-indigo-100 text-indigo-700',
  DISCOUNT_OVERRIDE: 'bg-amber-100 text-amber-700',
};

const ACTIONS = ['', 'INVOICE_CREATE', 'INVOICE_CANCEL', 'STOCK_IN', 'STOCK_OUT', 'PRICE_CHANGE', 'STOCK_ADJUST', 'RETURN_PROCESS', 'USER_CREATE', 'USER_UPDATE', 'DISCOUNT_OVERRIDE'];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '25' });
      if (action) params.set('action', action);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const { data } = await api.get(`/audit/logs?${params}`);
      setLogs(data.data);
      setTotal(data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [action, from, to]);

  useEffect(() => { load(1); }, [load]);

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total entries</p>
        </div>
        <button onClick={() => load(1)} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-gray-400" />
        <select value={action} onChange={(e) => setAction(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
          {ACTIONS.map((a) => <option key={a} value={a}>{a || 'All Actions'}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        <button onClick={() => { setAction(''); setFrom(''); setTo(''); }}
          className="text-xs text-red-600 hover:underline">Clear</button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-gray-400">No logs found</div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
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
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => load(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${p === page ? 'bg-red-700 text-white' : 'border text-gray-600 hover:bg-gray-50'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
