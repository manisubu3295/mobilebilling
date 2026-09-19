'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Phone, Mail, MapPin, MessageSquare, ChevronDown, ChevronRight, Package } from 'lucide-react';
import api from '@/lib/api';

interface LeadItem { productId: string; name: string; qty: number }
interface Lead {
  id: string;
  customerName: string;
  phone: string;
  email: string | null;
  address: string | null;
  message: string | null;
  items: LeadItem[];
  source: 'WHATSAPP' | 'FORM';
  status: 'NEW' | 'CONTACTED' | 'QUOTED' | 'CONVERTED' | 'CLOSED';
  notes: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-amber-100 text-amber-700',
  QUOTED: 'bg-purple-100 text-purple-700',
  CONVERTED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

const STATUSES: Lead['status'][] = ['NEW', 'CONTACTED', 'QUOTED', 'CONVERTED', 'CLOSED'];

const waHref = (phone: string) => `https://wa.me/91${phone.replace(/\D/g, '').replace(/^91/, '')}`;

export default function WebsiteLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | Lead['status']>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = statusFilter === 'ALL' ? leads : leads.filter((l) => l.status === statusFilter);

  const updateStatus = async (id: string, status: Lead['status']) => {
    setBusyId(id);
    try {
      await api.patch(`/leads/${id}`, { status });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const saveNotes = async (id: string) => {
    setBusyId(id);
    try {
      await api.patch(`/leads/${id}`, { notes: notesDraft });
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><UserPlus className="h-5 w-5 text-red-700" /> Website Leads</h1>
        <p className="text-sm text-gray-500 mt-0.5">Enquiries from the website's cart — WhatsApp and form submissions both land here.</p>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(['ALL', ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                statusFilter === s ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <UserPlus className="h-10 w-10 opacity-40" />
            <p>No leads {statusFilter === 'ALL' ? 'yet' : 'in this status'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((l) => {
              const expanded = expandedId === l.id;
              return (
                <div key={l.id} className="bg-white rounded-xl border p-4">
                  <button
                    onClick={() => { setExpandedId(expanded ? null : l.id); setNotesDraft(l.notes || ''); }}
                    className="w-full flex items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{l.customerName}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[l.status]}`}>{l.status}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                          via {l.source === 'WHATSAPP' ? 'WhatsApp' : 'Form'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{l.phone}{l.email ? ` · ${l.email}` : ''}</p>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Package className="h-3 w-3" /> {l.items.length} item{l.items.length === 1 ? '' : 's'}
                        {' · '}{new Date(l.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    {expanded ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                  </button>

                  {expanded && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      <div className="flex items-center gap-3 flex-wrap text-sm">
                        <a href={`tel:${l.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline"><Phone className="h-3.5 w-3.5" /> Call</a>
                        <a href={waHref(l.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:underline"><MessageSquare className="h-3.5 w-3.5" /> WhatsApp</a>
                        {l.email && <a href={`mailto:${l.email}`} className="flex items-center gap-1 text-gray-600 hover:underline"><Mail className="h-3.5 w-3.5" /> Email</a>}
                      </div>
                      {l.address && (
                        <p className="text-sm text-gray-600 flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" /> {l.address}</p>
                      )}
                      {l.message && (
                        <p className="text-sm text-gray-700 bg-gray-50 border rounded-lg px-3 py-2">{l.message}</p>
                      )}
                      <div className="border rounded-lg divide-y">
                        {l.items.map((it, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-1.5 text-sm">
                            <span>{it.name}</span>
                            <span className="text-gray-500">× {it.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="text-xs font-medium text-gray-600">Status</label>
                        <select
                          value={l.status}
                          onChange={(e) => updateStatus(l.id, e.target.value as Lead['status'])}
                          disabled={busyId === l.id}
                          className="border rounded-lg px-2 py-1.5 text-sm"
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="Follow-up notes…"
                          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <button
                          onClick={() => saveNotes(l.id)}
                          disabled={busyId === l.id}
                          className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
