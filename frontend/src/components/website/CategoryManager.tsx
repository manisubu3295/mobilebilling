'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Pencil, Plus, Trash2, X } from 'lucide-react';
import api from '@/lib/api';

export interface WebsiteCategory {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number; subProducts: number; children: number };
}

// Two-level storefront menu: top categories and their sub-categories
// ("Domestic Spares" → "Membrane"). Changes show on the website immediately.
export function CategoryManager({ categories, onChange, onClose }: {
  categories: WebsiteCategory[];
  onChange: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [newTop, setNewTop] = useState('');
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tops = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChange();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const add = (name: string, parentId?: string) =>
    run(async () => {
      if (!name.trim()) return;
      const siblings = parentId ? childrenOf(parentId) : tops;
      await api.post('/website-categories', { name: name.trim(), parentId, sortOrder: siblings.length });
      if (parentId) setNewSub((s) => ({ ...s, [parentId]: '' }));
      else setNewTop('');
    });

  const row = (c: WebsiteCategory, isChild: boolean) => {
    const count = (c._count?.products ?? 0) + (c._count?.subProducts ?? 0);
    return (
      <div className={`flex items-center gap-2 py-1.5 ${isChild ? 'pl-7' : ''}`}>
        {!isChild && (
          <button onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))} className="text-gray-400">
            {open[c.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
        {renaming?.id === c.id ? (
          <input
            autoFocus
            value={renaming.name}
            onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') run(async () => { await api.patch(`/website-categories/${c.id}`, { name: renaming.name }); setRenaming(null); });
              if (e.key === 'Escape') setRenaming(null);
            }}
            className="flex-1 border rounded px-2 py-1 text-sm"
          />
        ) : (
          <span className={`flex-1 text-sm ${isChild ? '' : 'font-semibold'} ${c.isActive ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
            {c.name}
            {count > 0 && <span className="ml-1.5 text-xs font-normal text-gray-400">({count})</span>}
          </span>
        )}
        <button title="Rename" onClick={() => setRenaming({ id: c.id, name: c.name })} className="text-gray-400 hover:text-gray-700">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          title={c.isActive ? 'Hide from website' : 'Show on website'}
          onClick={() => run(() => api.patch(`/website-categories/${c.id}`, { isActive: !c.isActive }))}
          className="text-gray-400 hover:text-gray-700"
        >
          {c.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
        <button title="Delete" onClick={() => run(() => api.delete(`/website-categories/${c.id}`))} className="text-gray-400 hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">Website Categories</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          {tops.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-600">
              <p>No categories yet.</p>
              <button
                disabled={busy}
                onClick={() => run(() => api.post('/website-categories/load-defaults'))}
                className="mt-2 px-3 py-1.5 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800 disabled:opacity-50"
              >
                Load water-purifier categories
              </button>
              <p className="mt-1 text-xs text-gray-400">Domestic RO System, Domestic Spares (Membrane, Filter…), Industrial RO…</p>
            </div>
          )}

          <div className="divide-y">
            {tops.map((c) => (
              <div key={c.id} className="py-1">
                {row(c, false)}
                {open[c.id] && (
                  <>
                    {childrenOf(c.id).map((sub) => <div key={sub.id}>{row(sub, true)}</div>)}
                    <div className="flex gap-2 pl-7 py-1.5">
                      <input
                        value={newSub[c.id] || ''}
                        onChange={(e) => setNewSub((s) => ({ ...s, [c.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && add(newSub[c.id] || '', c.id)}
                        placeholder={`Add under ${c.name}…`}
                        className="flex-1 border rounded px-2 py-1 text-sm"
                      />
                      <button disabled={busy} onClick={() => add(newSub[c.id] || '', c.id)} className="text-red-700 disabled:opacity-50">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <input
              value={newTop}
              onChange={(e) => setNewTop(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add(newTop)}
              placeholder="New top-level category…"
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
            />
            <button
              disabled={busy}
              onClick={() => add(newTop)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          <p className="text-xs text-gray-400">A category with products can&apos;t be deleted — hide it instead.</p>
        </div>
      </div>
    </div>
  );
}
