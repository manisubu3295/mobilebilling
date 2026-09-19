'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCircle, StickyNote, ChevronDown, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  status: 'UNREAD' | 'ACKNOWLEDGED' | 'ACTION_NOTED' | 'RESOLVED';
  actionNote: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  UNREAD: 'bg-blue-100 text-blue-700',
  ACKNOWLEDGED: 'bg-gray-100 text-gray-500',
  ACTION_NOTED: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [notingId, setNotingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
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
        <p className="text-sm text-gray-500 mt-0.5">Service visits completed by staff — review, mark OK, or leave yourself a follow-up note.</p>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
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

                    {notingId === n.id ? (
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
