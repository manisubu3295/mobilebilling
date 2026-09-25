'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle, StickyNote, ChevronDown, ChevronRight, CalendarClock, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { localDateString } from '@/lib/local-date';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  status: 'UNREAD' | 'ACKNOWLEDGED' | 'ACTION_NOTED' | 'RESOLVED';
  actionNote: string | null;
  serviceJobId: string | null;
  createdAt: string;
}

interface DueSummary { overdue: number; today: number; unassigned: number }

const STATUS_STYLE: Record<string, string> = {
  UNREAD: 'bg-blue-100 text-blue-700',
  ACKNOWLEDGED: 'bg-gray-100 text-gray-500',
  ACTION_NOTED: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const isStaff = user?.role === 'SERVICE_STAFF';
  const [due, setDue] = useState<DueSummary | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, dueRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/warranty/nearing-due', { params: { until: localDateString() } }).catch(() => null),
      ]);
      setNotifications(data);
      if (dueRes) {
        const items: Array<{ overdue: boolean; assignedTo: unknown }> = dueRes.data.items;
        setDue({
          overdue: items.filter((i) => i.overdue).length,
          today: items.filter((i) => !i.overdue).length,
          unassigned: items.filter((i) => !i.assignedTo).length,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const active = notifications.filter((n) => n.status !== 'RESOLVED');
  const resolved = notifications.filter((n) => n.status === 'RESOLVED');

  const acknowledge = async (id: string) => {
    setBusyId(id);
    try {
      await api.patch(`/notifications/${id}/acknowledge`);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const saveActionNote = async (id: string) => {
    if (!noteText.trim()) return;
    setBusyId(id);
    try {
      await api.patch(`/notifications/${id}/action-note`, { note: noteText });
      setNotingId(null);
      setNoteText('');
      load();
    } finally {
      setBusyId(null);
    }
  };

  // Technician service requests are decided right from the notification.
  const decide = async (n: Notification, approve: boolean) => {
    if (!n.serviceJobId) return;
    setBusyId(n.id);
    setActionError('');
    try {
      if (approve) await api.patch(`/warranty/service-requests/${n.serviceJobId}/approve`, {});
      else await api.patch(`/warranty/service-requests/${n.serviceJobId}/reject`, { reason: rejectReason.trim() });
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (e: any) {
      setActionError(e.response?.data?.message || 'Could not update this request');
    } finally {
      setBusyId(null);
    }
  };

  const resolve = async (id: string) => {
    setBusyId(id);
    try {
      await api.patch(`/notifications/${id}/resolve`);
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Bell className="h-5 w-5 text-red-700" /> Notifications</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isStaff
            ? 'Visits assigned to you and replies to your service requests.'
            : 'Service requests from technicians, completed visits and new leads — review, approve, or leave yourself a follow-up note.'}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {due && (due.overdue > 0 || due.today > 0) && (
          <Link
            href={isStaff ? '/service/my-jobs' : '/service/next-service'}
            className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 hover:bg-red-100"
          >
            <CalendarClock className="h-6 w-6 shrink-0 text-red-700" />
            <div className="text-sm">
              <p className="font-semibold text-red-900">
                {due.overdue > 0 && `${due.overdue} overdue`}{due.overdue > 0 && due.today > 0 && ' · '}{due.today > 0 && `${due.today} due today`}
              </p>
              <p className="text-red-700">
                {isStaff ? 'Open My Service Jobs' : `${due.unassigned ? `${due.unassigned} without a technician · ` : ''}Open Next Service to call and assign`}
              </p>
            </div>
          </Link>
        )}
        {actionError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{actionError}</p>}
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Bell className="h-10 w-10 opacity-40" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <>
            {active.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <CheckCircle className="h-10 w-10 opacity-40" />
                <p>All caught up</p>
              </div>
            ) : (
              <div className="space-y-3">
                {active.map((n) => (
                  <div key={n.id} className="bg-white rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{n.title}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[n.status]}`}>
                            {n.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
                        {n.actionNote && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2">
                            <StickyNote className="h-3 w-3 inline mr-1" /> {n.actionNote}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>

                    {!isStaff && n.type === 'SERVICE_REQUESTED' && n.status !== 'RESOLVED' ? (
                      rejectingId === n.id ? (
                        <div className="mt-3 flex gap-2">
                          <input
                            autoFocus
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason (the technician will see this)"
                            className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                          <button
                            onClick={() => decide(n, false)}
                            disabled={busyId === n.id || !rejectReason.trim()}
                            className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button onClick={() => setRejectingId(null)} className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <button
                            onClick={() => decide(n, true)}
                            disabled={busyId === n.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => { setRejectingId(n.id); setRejectReason(''); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                          <Link href="/service" className="text-xs text-gray-500 underline">Open in Service to change date / technician</Link>
                        </div>
                      )
                    ) : isStaff ? (
                      <div className="flex items-center gap-2 mt-3">
                        {n.status === 'UNREAD' && (
                          <button
                            onClick={() => acknowledge(n.id)}
                            disabled={busyId === n.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Mark read
                          </button>
                        )}
                        <Link href="/service/my-jobs" className="text-sm font-medium text-red-700 underline">Open my jobs</Link>
                      </div>
                    ) : notingId === n.id ? (
                      <div className="mt-3 flex gap-2">
                        <input
                          autoFocus
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="e.g. Call customer back about the noise complaint"
                          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <button
                          onClick={() => saveActionNote(n.id)}
                          disabled={busyId === n.id || !noteText.trim()}
                          className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setNotingId(null); setNoteText(''); }}
                          className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-3">
                        {n.status === 'UNREAD' && (
                          <button
                            onClick={() => acknowledge(n.id)}
                            disabled={busyId === n.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Mark OK
                          </button>
                        )}
                        {n.status !== 'ACTION_NOTED' && (
                          <button
                            onClick={() => { setNotingId(n.id); setNoteText(''); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <StickyNote className="h-3.5 w-3.5" /> Add Action Item
                          </button>
                        )}
                        {n.status === 'ACTION_NOTED' && (
                          <button
                            onClick={() => resolve(n.id)}
                            disabled={busyId === n.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Resolve
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {resolved.length > 0 && (
              <div>
                <button
                  onClick={() => setShowResolved((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
                >
                  {showResolved ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Resolved ({resolved.length})
                </button>
                {showResolved && (
                  <div className="space-y-2">
                    {resolved.map((n) => (
                      <div key={n.id} className="bg-white rounded-xl border p-3 opacity-60">
                        <p className="font-medium text-gray-700 text-sm">{n.title}</p>
                        <p className="text-xs text-gray-500">{n.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
