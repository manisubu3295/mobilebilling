'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Upload, Download, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import api from '@/lib/api';
import { CustomerSearch } from '@/components/billing/CustomerSearch';
import { localDateString } from '@/lib/local-date';
import { FrequencyPicker } from './ServiceAdminModals';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

type Tab = 'single' | 'bulk';

export function AmcOnboardModal({ onClose, onSaved }: Props) {
  const [tab, setTab] = useState<Tab>('single');

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        <div className="flex items-center gap-3 p-5 border-b">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Register AMC / Existing Customer</h2>
            <p className="text-xs text-gray-500 mt-0.5">For a customer whose purifier wasn't sold through this system</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex border-b">
          {(['single', 'bulk'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-red-700 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t === 'single' ? 'Add One' : 'Bulk Import (CSV)'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'single' ? <SingleEntry onClose={onClose} onSaved={onSaved} /> : <BulkImport onSaved={onSaved} />}
        </div>
      </div>
    </div>
  );
}

function SingleEntry({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string; brand: string | null }[]>([]);
  const [productId, setProductId] = useState('');
  const [startDate, setStartDate] = useState(localDateString());
  const [warrantyMonths, setWarrantyMonths] = useState('12');
  const [frequency, setFrequency] = useState('QUARTERLY');
  const [freqMonths, setFreqMonths] = useState('3');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [registeredCount, setRegisteredCount] = useState(0);

  useEffect(() => {
    api.get('/inventory/products').then(({ data }) => {
      setProducts(
        data.filter((p: any) => p.requiresService).map((p: any) => ({ id: p.id, name: p.name, brand: p.brand })),
      );
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setError('');
    if (!customerId) { setError('Select or create a customer.'); return; }
    if (!productId) { setError('Select a product.'); return; }
    setSaving(true);
    try {
      await api.post('/warranty', {
        customerId,
        productId,
        startDate,
        warrantyPeriodMonths: +warrantyMonths,
        serviceFrequency: frequency,
        ...(frequency === 'CUSTOM' ? { frequencyMonths: +freqMonths } : {}),
      });
      setRegisteredCount((n) => n + 1);
      setJustSaved(true);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to register AMC');
    } finally {
      setSaving(false);
    }
  };

  // A customer with multiple purifiers needs one AMC per product — stay open
  // with the same customer selected instead of forcing a re-search each time.
  const handleAddAnother = () => {
    setProductId('');
    setStartDate(localDateString());
    setWarrantyMonths('12');
    setFrequency('QUARTERLY');
    setJustSaved(false);
  };

  if (justSaved) {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <span className="text-green-700 text-2xl">✓</span>
        </div>
        <div>
          <p className="font-semibold text-gray-900">AMC registered</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {registeredCount > 1 ? `${registeredCount} AMCs registered for this customer so far.` : 'The first service visit has been scheduled automatically.'}
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={handleAddAnother} className="flex-1 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium">
            + Add Another Product
          </button>
          <button onClick={onSaved} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
      {registeredCount > 0 && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {registeredCount} product{registeredCount > 1 ? 's' : ''} already registered for this customer in this session.
        </p>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Customer</label>
        <CustomerSearch selectedId={customerId} onSelect={setCustomerId} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Product</label>
        {products.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">
            No products have "Requires service tracking" enabled yet — turn that on for a product from Inventory first.
          </p>
        ) : (
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.brand ? ` (${p.brand})` : ''}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Purchase / Install Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">AMC Period (months)</label>
          <input type="number" min={1} value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Service Frequency</label>
          <FrequencyPicker value={frequency} months={freqMonths} onChange={(v, mo) => { setFrequency(v); setFreqMonths(mo); }} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Register AMC'}
        </button>
      </div>
    </div>
  );
}

interface ParsedRow {
  customerName: string;
  phone: string;
  email: string;
  address: string;
  productName: string;
  startDate: string;
  warrantyPeriodMonths: number;
  serviceFrequency: string;
}

interface ImportResult {
  created: number;
  errors: { row: number; reason: string }[];
}

function downloadAmcTemplate() {
  const note = `# IMPORT TEMPLATE — Do NOT change column headers. Remove this comment row before importing.`;
  const freqNote = `# Valid Service Frequency: MONTHLY | QUARTERLY | HALF_YEARLY | YEARLY`;
  const productNote = `# Product Name must match a product in Inventory with "Requires service tracking" enabled`;
  const headers = ['Customer Name', 'Phone', 'Email', 'Address', 'Product Name', 'Purchase Date (YYYY-MM-DD)', 'AMC Period (Months)', 'Service Frequency'];
  const example = ['Ramesh Kumar', '9876543210', '', 'Near Bus Stand, Kumbakonam', 'AquaPure RO Purifier', '2024-01-15', '12', 'QUARTERLY'];
  const csv = [note, freqNote, productNote, headers.join(','), example.join(',')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'amc-customers-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function BulkImport({ onSaved }: { onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setParsedRows([]);
    setParseErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      comments: '#',
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const errs: string[] = [];
        const rows: ParsedRow[] = [];

        res.data.forEach((raw: any, i: number) => {
          const rowNum = i + 2;
          const name = raw['Customer Name']?.trim();
          const phone = raw['Phone']?.trim();
          const productName = raw['Product Name']?.trim();

          if (!name) { errs.push(`Row ${rowNum}: "Customer Name" is required`); return; }
          if (!phone) { errs.push(`Row ${rowNum}: "Phone" is required`); return; }
          if (!productName) { errs.push(`Row ${rowNum}: "Product Name" is required`); return; }

          rows.push({
            customerName: name,
            phone,
            email: raw['Email']?.trim() || '',
            address: raw['Address']?.trim() || '',
            productName,
            startDate: raw['Purchase Date (YYYY-MM-DD)']?.trim() || '',
            warrantyPeriodMonths: parseInt(raw['AMC Period (Months)']) || 12,
            serviceFrequency: raw['Service Frequency']?.trim().toUpperCase() || 'QUARTERLY',
          });
        });

        setParseErrors(errs);
        setParsedRows(rows);
      },
      error: (err) => setParseErrors([`Parse error: ${err.message}`]),
    });
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    try {
      const { data } = await api.post('/warranty/import', { rows: parsedRows });
      setResult(data);
      if (data.created > 0) onSaved();
    } catch (e: any) {
      setParseErrors([e.response?.data?.message || 'Import failed']);
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setParsedRows([]); setParseErrors([]); setFileName(''); setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div>
          <p className="text-sm font-semibold text-amber-800">Step 1 — Download the template</p>
          <p className="text-xs text-amber-700 mt-0.5">Product Name must match a product in Inventory with service tracking on.</p>
        </div>
        <button
          onClick={downloadAmcTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 shrink-0"
        >
          <Download className="h-3.5 w-3.5" /> Template
        </button>
      </div>

      {!result && (
        <>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Step 2 — Upload your filled CSV</p>
            {!fileName ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-500 hover:border-red-400 hover:text-red-600 transition-colors"
              >
                <Upload className="h-8 w-8 opacity-60" />
                <p className="text-sm font-medium">Click to upload CSV file</p>
                <p className="text-xs text-gray-400">.csv only · rows with # are treated as comments</p>
              </button>
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{fileName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{parsedRows.length} valid rows · {parseErrors.length} errors</p>
                </div>
                <button onClick={resetImport} className="text-gray-400 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>

          {parseErrors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1 max-h-32 overflow-auto">
              {parseErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-700 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {e}
                </p>
              ))}
            </div>
          )}

          {parsedRows.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Step 3 — Preview &amp; confirm ({parsedRows.length} rows)</p>
              <div className="border rounded-lg overflow-auto max-h-52">
                <table className="w-full text-xs">
                  <thead className="bg-gray-800 text-white sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Phone</th>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Frequency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                        <td className="px-3 py-1.5 text-gray-400">{i + 2}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-900">{r.customerName}</td>
                        <td className="px-3 py-1.5 text-gray-600">{r.phone}</td>
                        <td className="px-3 py-1.5 text-gray-600">{r.productName}</td>
                        <td className="px-3 py-1.5 text-gray-500">{r.serviceFrequency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleImport}
                disabled={importing}
                className="mt-3 w-full py-2.5 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                  : <><Upload className="h-4 w-4" /> Import {parsedRows.length} Customers</>}
              </button>
            </div>
          )}
        </>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
            <div>
              <p className="font-bold text-green-800 text-base">{result.created} customers registered for AMC</p>
              {result.errors.length > 0 && (
                <p className="text-sm text-amber-700 mt-0.5">{result.errors.length} rows had errors (see below)</p>
              )}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1 max-h-36 overflow-auto">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700">Row {e.row}: {e.reason}</p>
              ))}
            </div>
          )}

          <button onClick={resetImport} className="w-full py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
