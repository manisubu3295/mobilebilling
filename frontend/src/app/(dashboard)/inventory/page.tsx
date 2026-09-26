'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, AlertTriangle, Package, Search, ChevronDown, ChevronRight, Tag, QrCode, Printer, ArrowUpDown, Pencil, Power } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import { openPrintPreview } from '@/store/print.store';
import api from '@/lib/api';
import { ExportImportModal } from '@/components/inventory/ExportImportModal';
import { useAuthStore } from '@/store/auth.store';
import { unitAllowsDecimal } from '@/lib/units';

interface SKU {
  id: string;
  variantName: string;
  unit: string;
  isSerialized: boolean;
  stockQty: number;
  sellingPrice: string;
  costPrice: string;
  taxRate: string;
  lowStockThreshold: number;
  barcode: string | null;
  _count: { serialInventory: number };
}

interface Product {
  id: string;
  name: string;
  brand: string | null;
  partNumber: string | null;
  customFields: Record<string, any> | null;
  hsnCode: string | null;
  requiresService: boolean;
  type: 'PHYSICAL' | 'SERVICE';
  isActive: boolean;
  category: { name: string };
  skus: SKU[];
}

interface LowStockAlert {
  skuId: string;
  variantName: string;
  productName: string;
  partNumber: string | null;
  isSerialized: boolean;
  unit: string;
  currentStock: number;
  threshold: number;
}

interface SelectedSku {
  id: string;
  isSerialized: boolean;
  variantName: string;
  unit: string;
}

interface QrLabelData {
  qrValue: string;
  productName: string;
  partNumber: string | null;
  variantName: string;
  price: string;
  unit: string;
  skuId: string;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingSku, setEditingSku] = useState<{ sku: SKU; productName: string } | null>(null);
  const [showAddStock, setShowAddStock] = useState<SelectedSku | null>(null);
  const [showQrLabel, setShowQrLabel] = useState<QrLabelData | null>(null);
  const [showExportImport, setShowExportImport] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'alerts'>('products');
  const { user } = useAuthStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, alertRes] = await Promise.all([
        api.get('/inventory/products', { params: { search: search || undefined, includeInactive: true } }),
        api.get('/inventory/low-stock'),
      ]);
      setProducts(prodRes.data);
      setAlerts(alertRes.data);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const effectiveStock = (sku: SKU) =>
    sku.isSerialized ? sku._count.serialInventory : sku.stockQty;

  const handleToggleActive = async (id: string) => {
    await api.patch(`/inventory/products/${id}/toggle`);
    load();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {products.length} products · {alerts.length} low-stock alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Export / Import"
            onClick={() => setShowExportImport(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <ArrowUpDown className="h-4 w-4" />
            <span className="hidden sm:inline">Export / Import</span>
          </button>
          <button aria-label="Add Product"
            onClick={() => setShowAddProduct(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800"
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add Product</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-4 sm:px-6 flex gap-4">
        {(['products', 'alerts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t ? 'border-red-700 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {t === 'products' ? 'Products & Stock' : (
              <span className="flex items-center gap-1.5">
                Low Stock Alerts
                {alerts.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-bold">
                    {alerts.length}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {activeTab === 'products' ? (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, SKU, or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-40 text-gray-400">Loading…</div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                <Package className="h-10 w-10 opacity-40" />
                <p>No products found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((product) => {
                  const isService = product.type === 'SERVICE';
                  const totalStock = product.skus.reduce((s, sku) => s + effectiveStock(sku), 0);
                  const isExpanded = expanded.has(product.id);

                  return (
                    <div key={product.id} className={`bg-white rounded-xl border overflow-hidden ${!product.isActive ? 'opacity-60' : ''}`}>
                      <div className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50">
                        <button
                          onClick={() => toggleExpand(product.id)}
                          className="flex-1 min-w-0 flex items-center gap-3 text-left"
                        >
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-900">{product.name}</p>
                              {isService && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">Service</span>
                              )}
                              {!product.isActive && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-600">Inactive</span>
                              )}
                              {product.partNumber && (
                                <span className="flex items-center gap-0.5 text-xs text-gray-400 font-mono">
                                  <Tag className="h-3 w-3" /> {product.partNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {product.category.name} · {product.skus.length} variant(s)
                              {product.customFields?.notes && ` · ${product.customFields.notes}`}
                            </p>
                          </div>
                        </button>
                        <div className="text-right shrink-0">
                          {isService ? (
                            <p className="text-xs text-gray-400 italic">no stock</p>
                          ) : (
                            <>
                              <p className="font-bold text-gray-900">{totalStock}</p>
                              <p className="text-xs text-gray-500">in stock</p>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg shrink-0"
                          title="Edit product"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(product.id)}
                          className={`p-1.5 rounded-lg shrink-0 ${product.isActive ? 'text-gray-400 hover:text-red-700 hover:bg-red-50' : 'text-gray-400 hover:text-green-700 hover:bg-green-50'}`}
                          title={product.isActive ? 'Deactivate product' : 'Activate product'}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="border-t bg-gray-50 divide-y">
                          {product.skus.map((sku) => {
                            const stock = effectiveStock(sku);
                            const isLow = stock <= sku.lowStockThreshold;
                            return (
                              <div key={sku.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-gray-900">{sku.variantName}</p>
                                  <p className="text-xs text-gray-500">
                                    Sell: ₹{parseFloat(sku.sellingPrice).toLocaleString('en-IN')}/{sku.unit}
                                    {' · '}Cost: ₹{parseFloat(sku.costPrice).toLocaleString('en-IN')}
                                    {' · '}GST: {sku.taxRate}%
                                    {' · '}{isService ? 'Service — no stock' : sku.isSerialized ? 'Serial-tracked' : `Bulk (${sku.unit})`}
                                    {sku.barcode && ` · Barcode: ${sku.barcode}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                                  {!isService && (
                                    <div className="text-right">
                                      <p className={`font-bold text-sm ${isLow ? 'text-red-600' : 'text-green-700'}`}>
                                        {stock} {sku.unit}
                                      </p>
                                      <p className="text-xs text-gray-400">min: {sku.lowStockThreshold}</p>
                                    </div>
                                  )}
                                  {!isService && isLow && <AlertTriangle className="h-4 w-4 text-red-500" />}
                                  <button
                                    onClick={() => setEditingSku({ sku, productName: product.name })}
                                    className="p-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 hover:text-red-700 hover:border-red-300"
                                    title="Edit variant"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  {!isService && (
                                    <button
                                      onClick={() => setShowAddStock({
                                        id: sku.id,
                                        isSerialized: sku.isSerialized,
                                        variantName: sku.variantName,
                                        unit: sku.unit,
                                      })}
                                      className="px-2.5 py-1 border border-red-300 text-red-700 text-xs rounded-lg hover:bg-red-50 font-medium"
                                    >
                                      + Stock
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      const qrValue = sku.barcode || product.partNumber || `SKU-${sku.id.slice(-8).toUpperCase()}`;
                                      setShowQrLabel({
                                        qrValue,
                                        productName: product.name,
                                        partNumber: product.partNumber,
                                        variantName: sku.variantName,
                                        price: sku.sellingPrice,
                                        unit: sku.unit,
                                        skuId: sku.id,
                                      });
                                    }}
                                    className="p-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 hover:text-red-700 hover:border-red-300"
                                    title="View / Print QR Label"
                                  >
                                    <QrCode className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-green-600 gap-2">
                <Package className="h-10 w-10 opacity-60" />
                <p className="font-medium">All stock levels are healthy</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {alerts.map((a) => (
                  <div key={a.skuId} className="bg-white border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{a.productName}</p>
                      {a.partNumber && (
                        <p className="text-xs text-gray-400 font-mono">{a.partNumber}</p>
                      )}
                      <p className="text-xs text-gray-500">{a.variantName}</p>
                      <p className="text-sm mt-1">
                        <span className="font-bold text-red-600">{a.currentStock} {a.unit}</span>
                        <span className="text-gray-400"> / {a.threshold} threshold</span>
                      </p>
                      <button
                        onClick={() => {
                          setShowAddStock({ id: a.skuId, isSerialized: a.isSerialized, variantName: a.variantName, unit: a.unit });
                          setActiveTab('products');
                        }}
                        className="mt-2 text-xs text-red-600 hover:underline font-medium"
                      >
                        Add stock →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddProduct && <AddProductModal onClose={() => setShowAddProduct(false)} onSave={load} />}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={() => { setEditingProduct(null); load(); }}
          onRefresh={load}
        />
      )}
      {editingSku && (
        <EditSkuModal
          sku={editingSku.sku}
          productName={editingSku.productName}
          onClose={() => setEditingSku(null)}
          onSave={() => { setEditingSku(null); load(); }}
        />
      )}
      {showAddStock && (
        <AddStockModal sku={showAddStock} onClose={() => setShowAddStock(null)} onSave={load} />
      )}
      {showQrLabel && (
        <QrLabelModal data={showQrLabel} storeName={user?.store?.name || 'My Store'} onClose={() => setShowQrLabel(null)} />
      )}
      {showExportImport && (
        <ExportImportModal
          products={products}
          storeName={user?.store?.name || 'My Store'}
          onClose={() => setShowExportImport(false)}
          onImportDone={() => { setShowExportImport(false); load(); }}
        />
      )}
    </div>
  );
}

const UNITS = ['PCS', 'SET', 'PAIR', 'LITER', 'METER', 'KG'];

/* ── Add Product Modal ──────────────────────────────────────────────── */
function AddProductModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { account } = useAuthStore();
  const [form, setForm] = useState({
    name: '', brand: '', partNumber: '', notes: '',
    categoryId: '', hsnCode: '', description: '',
    skuName: 'Standard', unit: 'PCS', isSerialized: false,
    costPrice: '', sellingPrice: '', taxRate: '18', threshold: '5', barcode: '',
    initialStock: '0', requiresService: false,
    type: 'PHYSICAL' as 'PHYSICAL' | 'SERVICE',
  });
  const isServiceType = form.type === 'SERVICE';
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const loadCategories = useCallback(() => {
    api.get('/inventory/categories').then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    setError('');
    try {
      const { data } = await api.post('/inventory/categories', { name: newCategoryName.trim() });
      setNewCategoryName('');
      setShowNewCategory(false);
      loadCategories();
      setForm((p) => ({ ...p, categoryId: data.id }));
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not create category');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!form.name || !form.categoryId || !form.sellingPrice || !form.costPrice) {
      setError('Please fill all required fields (*).'); return;
    }
    const initialStock = parseFloat(form.initialStock) || 0;
    if (!isServiceType && !form.isSerialized && !unitAllowsDecimal(form.unit) && !Number.isInteger(initialStock)) {
      setError(`"${form.unit}" is stocked in whole numbers — opening stock must be a whole number.`);
      return;
    }
    setSaving(true);
    try {
      await api.post('/inventory/products', {
        name: form.name,
        brand: form.brand || undefined,
        partNumber: form.partNumber || undefined,
        customFields: form.notes ? { notes: form.notes } : undefined,
        categoryId: form.categoryId,
        hsnCode: form.hsnCode || undefined,
        description: form.description || undefined,
        requiresService: isServiceType ? false : form.requiresService,
        type: form.type,
        skus: [{
          variantName: form.skuName || 'Standard',
          unit: form.unit,
          isSerialized: isServiceType ? false : form.isSerialized,
          stockQty: isServiceType || form.isSerialized ? 0 : initialStock,
          costPrice: +form.costPrice,
          sellingPrice: +form.sellingPrice,
          taxRate: +form.taxRate,
          lowStockThreshold: +form.threshold,
          barcode: form.barcode || undefined,
        }],
      });
      onSave(); onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const f = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Add Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3 max-h-[75vh] overflow-auto">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Product Info</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as 'PHYSICAL' | 'SERVICE' }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="PHYSICAL">Physical Product (tracked stock)</option>
                <option value="SERVICE">Service or Fee (labor, visit charge, installation… no stock)</option>
              </select>
            </div>
            <Field label="Product Name *" value={form.name} onChange={f('name')} />
            <Field label="Brand" value={form.brand} onChange={f('brand')} />
            <Field label="SKU / Item Code" value={form.partNumber} onChange={f('partNumber')} placeholder="e.g. SKU-1234" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              {!showNewCategory ? (
                <select
                  value={form.categoryId}
                  onChange={(e) => {
                    if (e.target.value === '__new__') { setShowNewCategory(true); return; }
                    setForm((p) => ({ ...p, categoryId: e.target.value }));
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new__">+ Add new category…</option>
                </select>
              ) : (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                    placeholder="New category name"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={savingCategory}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }}
                    className="px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>
            <Field label="HSN Code" value={form.hsnCode} onChange={f('hsnCode')} />
            <div className="col-span-2">
              <Field label="Notes" value={form.notes} onChange={f('notes')} placeholder="Optional — e.g. size, color, specifications" />
            </div>
            {account?.serviceModuleEnabled && !isServiceType && (
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresService}
                    onChange={(e) => setForm((p) => ({ ...p, requiresService: e.target.checked }))}
                    className="h-4 w-4 accent-red-700"
                  />
                  Requires service tracking
                </label>
              </div>
            )}
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Variant / SKU</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Variant Name" value={form.skuName} onChange={f('skuName')} placeholder="e.g. Standard, Large, Red" />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
              <select value={form.unit} onChange={f('unit')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <Field label="Cost Price ₹ *" type="number" value={form.costPrice} onChange={f('costPrice')} />
            <Field label="Selling Price ₹ *" type="number" value={form.sellingPrice} onChange={f('sellingPrice')} />
            <Field label="GST Rate %" type="number" value={form.taxRate} onChange={f('taxRate')} />
            {!isServiceType && <Field label="Low Stock Alert" type="number" value={form.threshold} onChange={f('threshold')} />}
            <Field label="Barcode" value={form.barcode} onChange={f('barcode')} />
            {!isServiceType && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stock Tracking</label>
                <select
                  value={form.isSerialized ? 'serial' : 'bulk'}
                  onChange={(e) => setForm((p) => ({ ...p, isSerialized: e.target.value === 'serial' }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="bulk">Bulk Qty (most items)</option>
                  <option value="serial">Serial-tracked (high-value)</option>
                </select>
              </div>
            )}
            {!isServiceType && !form.isSerialized && (
              <Field label="Opening Stock" type="number" value={form.initialStock} onChange={f('initialStock')} placeholder="0" />
            )}
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Edit Product Modal ─────────────────────────────────────────────── */
function EditProductModal({ product, onClose, onSave, onRefresh }: { product: Product; onClose: () => void; onSave: () => void; onRefresh?: () => void }) {
  const { account } = useAuthStore();
  const [form, setForm] = useState({
    name: product.name,
    brand: product.brand || '',
    partNumber: product.partNumber || '',
    categoryId: '',
    hsnCode: product.hsnCode || '',
    notes: product.customFields?.notes || '',
    requiresService: product.requiresService ?? false,
    type: product.type,
  });
  const isServiceType = form.type === 'SERVICE';
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [skus, setSkus] = useState<SKU[]>(product.skus);
  const [editingSku, setEditingSku] = useState<SKU | null>(null);

  useEffect(() => {
    api.get('/inventory/categories').then(({ data }) => {
      setCategories(data);
      const current = data.find((c: any) => c.name === product.category.name);
      if (current) setForm((p) => ({ ...p, categoryId: current.id }));
    }).catch(() => {});
  }, [product.category.name]);

  const handleSave = async () => {
    setError('');
    if (!form.name || !form.categoryId) { setError('Name and category are required.'); return; }
    setSaving(true);
    try {
      await api.put(`/inventory/products/${product.id}`, {
        name: form.name,
        brand: form.brand || undefined,
        partNumber: form.partNumber || undefined,
        categoryId: form.categoryId,
        hsnCode: form.hsnCode || undefined,
        customFields: form.notes ? { notes: form.notes } : {},
        requiresService: isServiceType ? false : form.requiresService,
        type: form.type,
      });
      onSave();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  const f = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">Edit Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as 'PHYSICAL' | 'SERVICE' }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="PHYSICAL">Physical Product (tracked stock)</option>
                <option value="SERVICE">Service or Fee (labor, visit charge, installation… no stock)</option>
              </select>
            </div>
            <Field label="Product Name *" value={form.name} onChange={f('name')} />
            <Field label="Brand" value={form.brand} onChange={f('brand')} />
            <Field label="SKU / Item Code" value={form.partNumber} onChange={f('partNumber')} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select value={form.categoryId} onChange={f('categoryId')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                <option value="">Select…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Field label="HSN Code" value={form.hsnCode} onChange={f('hsnCode')} />
            <div className="col-span-2">
              <Field label="Notes" value={form.notes} onChange={f('notes')} placeholder="Optional — e.g. size, color, specifications" />
            </div>
            {account?.serviceModuleEnabled && !isServiceType && (
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresService}
                    onChange={(e) => setForm((p) => ({ ...p, requiresService: e.target.checked }))}
                    className="h-4 w-4 accent-red-700"
                  />
                  Requires service tracking
                </label>
              </div>
            )}
          </div>

          {skus.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Variants</p>
              <div className="border rounded-lg divide-y">
                {skus.map((sku) => (
                  <div key={sku.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{sku.variantName}</p>
                      <p className="text-xs text-gray-500">
                        ₹{parseFloat(sku.sellingPrice).toLocaleString('en-IN')}/{sku.unit} · GST {sku.taxRate}%
                        {!isServiceType && ` · ${sku.isSerialized ? sku._count.serialInventory : sku.stockQty} in stock`}
                        {sku.barcode && ` · ${sku.barcode}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditingSku(sku)}
                      className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-lg shrink-0"
                      title="Edit variant"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
      {editingSku && (
        <EditSkuModal
          sku={editingSku}
          productName={product.name}
          onClose={() => setEditingSku(null)}
          onSave={async () => {
            setEditingSku(null);
            const { data } = await api.get(`/inventory/products/${product.id}`);
            setSkus(data.skus);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}

/* ── Edit SKU / Variant Modal ──────────────────────────────────────────── */
function EditSkuModal({ sku, productName, onClose, onSave }: { sku: SKU; productName: string; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    variantName: sku.variantName,
    unit: sku.unit,
    costPrice: sku.costPrice,
    sellingPrice: sku.sellingPrice,
    taxRate: sku.taxRate,
    threshold: String(sku.lowStockThreshold),
    barcode: sku.barcode || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!form.variantName || !form.sellingPrice || !form.costPrice) {
      setError('Variant name, cost and selling price are required.'); return;
    }
    setSaving(true);
    try {
      await api.put(`/inventory/skus/${sku.id}`, {
        variantName: form.variantName,
        unit: form.unit,
        costPrice: +form.costPrice,
        sellingPrice: +form.sellingPrice,
        taxRate: +form.taxRate,
        lowStockThreshold: +form.threshold,
        barcode: form.barcode || undefined,
      });
      onSave();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to update variant');
    } finally {
      setSaving(false);
    }
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold">Edit Variant</h2>
            <p className="text-sm text-gray-500">{productName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Variant Name" value={form.variantName} onChange={f('variantName')} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
              <select value={form.unit} onChange={f('unit')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <Field label="Cost Price ₹" type="number" value={form.costPrice} onChange={f('costPrice')} />
            <Field label="Selling Price ₹" type="number" value={form.sellingPrice} onChange={f('sellingPrice')} />
            <Field label="GST Rate %" type="number" value={form.taxRate} onChange={f('taxRate')} />
            <Field label="Low Stock Alert" type="number" value={form.threshold} onChange={f('threshold')} />
            <Field label="Barcode" value={form.barcode} onChange={f('barcode')} />
          </div>
          {sku.isSerialized && (
            <p className="text-xs text-gray-400">Stock quantity isn't edited here — use Add Stock / serial units for that.</p>
          )}
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Add Stock Modal ──────────────────────────────────────────────────── */
function AddStockModal({
  sku, onClose, onSave,
}: {
  sku: { id: string; isSerialized: boolean; variantName: string; unit: string };
  onClose: () => void;
  onSave: () => void;
}) {
  const [bulkQty, setBulkQty] = useState('');
  const [rows, setRows] = useState([{ serialNumber: '', batchNumber: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addRow = () => setRows((r) => [...r, { serialNumber: '', batchNumber: '' }]);
  const updateRow = (i: number, k: string, v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (!sku.isSerialized) {
        const qty = parseFloat(bulkQty);
        if (!qty || qty <= 0) { setError('Enter a valid quantity.'); setSaving(false); return; }
        if (!unitAllowsDecimal(sku.unit) && !Number.isInteger(qty)) {
          setError(`"${sku.unit}" is stocked in whole numbers — enter a whole quantity.`);
          setSaving(false);
          return;
        }
        const { data } = await api.post('/inventory/serial-units', { skuId: sku.id, bulkQty: qty });
        alert(`✓ Added ${data.added} ${sku.unit} to stock`);
      } else {
        const units = rows.filter((r) => r.serialNumber || r.batchNumber);
        if (units.length === 0) { setError('Enter at least one serial number.'); setSaving(false); return; }
        const { data } = await api.post('/inventory/serial-units', { skuId: sku.id, units });
        alert(`✓ ${data.added} unit(s) added`);
      }
      onSave(); onClose();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to add stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-bold">Add Stock</h2>
            <p className="text-sm text-gray-500">{sku.variantName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-3 max-h-[60vh] overflow-auto">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

          {!sku.isSerialized ? (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Bulk stock — enter quantity to add ({sku.unit})
              </p>
              <Field
                label={`Quantity to add (${sku.unit})`}
                type="number"
                value={bulkQty}
                onChange={(e) => setBulkQty(e.target.value)}
                placeholder="e.g. 20"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Serial-tracked — enter one row per physical unit
              </p>
              {rows.map((row, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                  <Field
                    label="Serial Number"
                    value={row.serialNumber}
                    onChange={(e) => updateRow(i, 'serialNumber', e.target.value)}
                    placeholder="SN-123456"
                  />
                  <Field
                    label="Batch / Lot No."
                    value={row.batchNumber}
                    onChange={(e) => updateRow(i, 'batchNumber', e.target.value)}
                    placeholder="BATCH-2024-01"
                  />
                </div>
              ))}
              <button onClick={addRow} className="text-sm text-red-700 hover:underline font-medium">
                + Add another unit
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add to Inventory'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
      />
    </div>
  );
}

/* ── QR Label Modal ──────────────────────────────────────────────────── */
function QrLabelModal({ data, storeName, onClose }: { data: QrLabelData; storeName: string; onClose: () => void }) {
  const [copies, setCopies] = useState(1);

  const handlePrint = async () => {
    // QR is rendered to an image up front (no CDN script) and the sheet opens
    // in the in-app print preview — a popup window here used to take over the
    // Android app's WebView with no way back.
    const qrImg = await QRCode.toDataURL(data.qrValue, { width: 180, margin: 0, errorCorrectionLevel: 'H' });
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const label = `
      <div style="
        width:60mm; border:1px solid #ccc; border-radius:6px;
        padding:4mm; font-family:Arial,sans-serif; text-align:center;
        page-break-inside:avoid; display:inline-block; margin:2mm;
        box-sizing:border-box; vertical-align:top;
      ">
        <div style="font-size:7pt;font-weight:700;color:#7f1d1d;letter-spacing:0.5px;text-transform:uppercase;">
          ${esc(storeName)}
        </div>
        <div style="font-size:9pt;font-weight:800;margin:1mm 0;line-height:1.2;">${esc(data.productName)}</div>
        <div style="font-size:7.5pt;color:#444;margin-bottom:1mm;">${esc(data.variantName)}</div>
        ${data.partNumber ? `<div style="font-size:7pt;font-family:monospace;color:#7f1d1d;">Code: ${esc(data.partNumber)}</div>` : ''}
        <img src="${qrImg}" alt="" style="display:block;margin:2mm auto;width:24mm;height:24mm;" />
        <div style="font-size:7pt;font-family:monospace;color:#333;margin:1mm 0;">${esc(data.qrValue)}</div>
        <div style="font-size:10pt;font-weight:800;color:#111;">&#8377;${parseFloat(data.price).toLocaleString('en-IN')} / ${esc(data.unit)}</div>
      </div>`;

    openPrintPreview(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>QR Labels</title>
      <style>
        body { margin: 4mm; background: #fff; }
        @media print { @page { margin: 4mm; } }
      </style>
    </head><body>${label.repeat(copies)}</body></html>`, `QR Label — ${data.productName}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-2 p-5 border-b">
          <QrCode className="h-5 w-5 text-red-700" />
          <h2 className="text-lg font-bold">QR Label</h2>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        {/* Label preview */}
        <div className="p-5 flex flex-col items-center gap-3">
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 w-full flex flex-col items-center gap-2 bg-gray-50">
            <p className="text-xs font-bold text-red-700 tracking-widest uppercase">{storeName}</p>
            <p className="font-bold text-gray-900 text-center text-sm leading-tight">{data.productName}</p>
            <p className="text-xs text-gray-500">{data.variantName}</p>
            {data.partNumber && (
              <p className="text-xs font-mono text-red-700">Code: {data.partNumber}</p>
            )}
            <div className="p-1 bg-white border rounded-lg">
              <QRCodeSVG value={data.qrValue} size={100} level="H" includeMargin={false} />
            </div>
            <p className="text-xs font-mono text-gray-500 break-all text-center">{data.qrValue}</p>
            <p className="text-base font-bold text-gray-900">
              ₹{parseFloat(data.price).toLocaleString('en-IN')} / {data.unit}
            </p>
          </div>

          {/* QR value info */}
          <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            <span className="font-semibold">QR encodes: </span>
            {data.qrValue}
            {!data.qrValue.startsWith('SKU-')
              ? ' (existing barcode / item code)'
              : ' (auto-generated — scan this in checkout to find the item)'}
          </div>

          {/* Copies */}
          <div className="w-full flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Copies to print</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setCopies(Math.max(1, copies - 1))} className="w-7 h-7 rounded-full border flex items-center justify-center text-gray-600 hover:bg-gray-100">−</button>
              <span className="w-8 text-center font-semibold">{copies}</span>
              <button onClick={() => setCopies(Math.min(20, copies + 1))} className="w-7 h-7 rounded-full border flex items-center justify-center text-gray-600 hover:bg-gray-100">+</button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 flex items-center justify-center gap-2"
          >
            <Printer className="h-4 w-4" /> Print {copies > 1 ? `${copies} Labels` : 'Label'}
          </button>
        </div>
      </div>
    </div>
  );
}
