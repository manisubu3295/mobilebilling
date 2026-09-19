'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Globe, Plus, Pencil, Trash2, Star, EyeOff } from 'lucide-react';
import api from '@/lib/api';

interface WebsiteProduct {
  id: string;
  category: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  mrpPrice: string | null;
  sellingPrice: string | null;
  capacityLph: number | null;
  images: string[];
  specSheetUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
}

type FormState = {
  category: string;
  name: string;
  shortDescription: string;
  description: string;
  mrpPrice: string;
  sellingPrice: string;
  capacityLph: string;
  images: string; // comma-separated in the form, split to an array on save
  specSheetUrl: string;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  category: 'Household RO/UV/Softener',
  name: '',
  shortDescription: '',
  description: '',
  mrpPrice: '',
  sellingPrice: '',
  capacityLph: '',
  images: '',
  specSheetUrl: '',
  isFeatured: false,
  isActive: true,
  sortOrder: '0',
};

function fmt(v: string | null) {
  if (!v) return null;
  return '₹' + parseFloat(v).toLocaleString('en-IN');
}

export default function WebsiteProductsPage() {
  const [products, setProducts] = useState<WebsiteProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WebsiteProduct | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/website-products');
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setError(''); setShowForm(true); };
  const openEdit = (p: WebsiteProduct) => {
    setEditing(p);
    setForm({
      category: p.category,
      name: p.name,
      shortDescription: p.shortDescription || '',
      description: p.description || '',
      mrpPrice: p.mrpPrice || '',
      sellingPrice: p.sellingPrice || '',
      capacityLph: p.capacityLph != null ? String(p.capacityLph) : '',
      images: (p.images || []).join(', '),
      specSheetUrl: p.specSheetUrl || '',
      isFeatured: p.isFeatured,
      isActive: p.isActive,
      sortOrder: String(p.sortOrder),
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim()) { setError('Name and category are required.'); return; }
    setError('');
    setSaving(true);
    const payload = {
      category: form.category.trim(),
      name: form.name.trim(),
      shortDescription: form.shortDescription.trim() || undefined,
      description: form.description.trim() || undefined,
      mrpPrice: form.mrpPrice ? parseFloat(form.mrpPrice) : undefined,
      sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : undefined,
      capacityLph: form.capacityLph ? parseInt(form.capacityLph, 10) : undefined,
      images: form.images.split(',').map((s) => s.trim()).filter(Boolean),
      specSheetUrl: form.specSheetUrl.trim() || undefined,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    };
    try {
      if (editing) {
        await api.patch(`/website-products/${editing.id}`, payload);
      } else {
        await api.post('/website-products', payload);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/website-products/${id}`);
      load();
    } finally {
      setDeletingId(null);
    }
  };

  const categories = Array.from(new Set(products.map((p) => p.category)));

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Globe className="h-5 w-5 text-red-700" /> Website Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">The catalog shown on the public website's shop — {products.length} products</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 shrink-0"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Product</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Globe className="h-10 w-10 opacity-40" />
            <p>No products yet — add your first one</p>
          </div>
        ) : (
          categories.map((cat) => (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</h2>
              <div className="space-y-2">
                {products.filter((p) => p.category === cat).map((p) => {
                  const discount = p.mrpPrice && p.sellingPrice
                    ? Math.round((1 - parseFloat(p.sellingPrice) / parseFloat(p.mrpPrice)) * 100)
                    : null;
                  return (
                    <div key={p.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{p.name}</p>
                          {p.isFeatured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                          {!p.isActive && (
                            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                              <EyeOff className="h-3 w-3" /> Hidden
                            </span>
                          )}
                          {p.capacityLph && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">{p.capacityLph} LPH</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{p.shortDescription}</p>
                        <p className="text-sm mt-1">
                          {p.sellingPrice ? (
                            <>
                              <span className="font-semibold text-gray-900">{fmt(p.sellingPrice)}</span>
                              {p.mrpPrice && discount ? (
                                <span className="ml-2 text-xs text-gray-400 line-through">{fmt(p.mrpPrice)}</span>
                              ) : null}
                              {discount ? <span className="ml-2 text-xs text-green-700 font-medium">{discount}% OFF</span> : null}
                            </>
                          ) : (
                            <span className="text-gray-400">No price set</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => openEdit(p)}
                          className="flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-3">
              {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <input
                  list="website-categories"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Household RO/UV/Softener, Commercial RO Plants"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                <datalist id="website-categories">
                  <option value="Household RO/UV/Softener" />
                  <option value="Commercial RO Plants" />
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Short description</label>
                <input value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full description</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">MRP (₹)</label>
                  <input type="number" min={0} value={form.mrpPrice} onChange={(e) => setForm((f) => ({ ...f, mrpPrice: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Selling price (₹)</label>
                  <input type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Capacity — LPH (commercial plants only)</label>
                <input type="number" min={1} value={form.capacityLph} onChange={(e) => setForm((f) => ({ ...f, capacityLph: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Image paths (comma-separated)</label>
                <input
                  value={form.images}
                  onChange={(e) => setForm((f) => ({ ...f, images: e.target.value }))}
                  placeholder="/images/WhatsApp Image ....jpeg"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Paths under the website's own /images folder, or full URLs.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Spec sheet PDF URL</label>
                <input value={form.specSheetUrl} onChange={(e) => setForm((f) => ({ ...f, specSheetUrl: e.target.value }))} placeholder="/images/500 LPH CLASSIC.pdf" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sort order</label>
                <input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                  Visible on website
                </label>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
