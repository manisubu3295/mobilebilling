'use client';

import React, { useRef, useState } from 'react';
import {
  Download, Upload, FileText, FileSpreadsheet,
  File, X, CheckCircle, AlertTriangle, Loader2,
} from 'lucide-react';
import Papa from 'papaparse';
import api from '@/lib/api';
import {
  exportCsv, exportExcel, exportPdf, downloadTemplate,
  ExportRow, CSV_HEADERS,
} from '@/lib/inventory-export';

interface Props {
  products: any[];
  storeName: string;
  onClose: () => void;
  onImportDone: () => void;
}

type Tab = 'export' | 'import';

interface ParsedRow {
  productName: string;
  brand: string;
  partNumber: string;
  compatibleModels: string;
  categoryName: string;
  hsnCode: string;
  variantName: string;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number;
  lowStockThreshold: number;
  openingStock: number;
}

interface ImportResult {
  created: number;
  errors: { row: number; reason: string }[];
}

function buildExportRows(products: any[]): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const p of products) {
    for (const sku of p.skus || []) {
      const stock = sku.isSerialized ? (sku._count?.serialInventory ?? 0) : (sku.stockQty ?? 0);
      rows.push({
        productName: p.name,
        brand: p.brand || '',
        partNumber: p.partNumber || '',
        compatibleModels: p.customFields?.compatible_models || '',
        category: p.category?.name || '',
        hsnCode: p.hsnCode || '',
        variantName: sku.variantName || '',
        unit: sku.unit || 'PCS',
        sellingPrice: parseFloat(sku.sellingPrice) || 0,
        costPrice: parseFloat(sku.costPrice) || 0,
        taxRate: parseFloat(sku.taxRate) || 18,
        lowStockThreshold: sku.lowStockThreshold || 5,
        currentStock: stock,
        isSerialized: sku.isSerialized || false,
        barcode: sku.barcode || '',
      });
    }
  }
  return rows;
}

export function ExportImportModal({ products, storeName, onClose, onImportDone }: Props) {
  const [tab, setTab] = useState<Tab>('export');
  const [exporting, setExporting] = useState<string | null>(null);

  // Import state
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const exportRows = buildExportRows(products);

  /* ── Export handlers ─── */
  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setExporting(format);
    try {
      if (format === 'csv') exportCsv(exportRows);
      else if (format === 'excel') await exportExcel(exportRows);
      else await exportPdf(exportRows, storeName);
    } finally {
      setExporting(null);
    }
  };

  /* ── Import: parse CSV ─── */
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
          const name = raw['Product Name']?.trim();
          const variant = raw['Variant Name']?.trim();
          const price = parseFloat(raw['Selling Price']);

          if (!name) { errs.push(`Row ${rowNum}: "Product Name" is required`); return; }
          if (!variant) { errs.push(`Row ${rowNum}: "Variant Name" is required`); return; }
          if (isNaN(price) || price <= 0) { errs.push(`Row ${rowNum}: "Selling Price" must be a positive number`); return; }

          rows.push({
            productName: name,
            brand: raw['Brand']?.trim() || '',
            partNumber: raw['Part Number']?.trim() || '',
            compatibleModels: raw['Compatible Models']?.trim() || '',
            categoryName: raw['Category']?.trim() || 'Other',
            hsnCode: raw['HSN Code']?.trim() || '',
            variantName: variant,
            unit: raw['Unit']?.trim().toUpperCase() || 'PCS',
            sellingPrice: price,
            costPrice: parseFloat(raw['Cost Price']) || 0,
            taxRate: parseFloat(raw['Tax Rate (%)']) || 18,
            lowStockThreshold: parseInt(raw['Low Stock Threshold']) || 5,
            openingStock: parseInt(raw['Opening Stock']) || 0,
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
      const { data } = await api.post('/inventory/products/import', { rows: parsedRows });
      setResult(data);
      if (data.created > 0) onImportDone();
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Inventory Export / Import</h2>
            <p className="text-xs text-gray-500 mt-0.5">{exportRows.length} SKUs available to export</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(['export', 'import'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t ? 'border-red-700 text-red-700' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t === 'export' ? '⬇ Export' : '⬆ Import'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── EXPORT TAB ─────────────────────────────────────── */}
          {tab === 'export' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Exports all <strong>{exportRows.length}</strong> SKUs currently loaded (respects active search filter).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* CSV */}
                <button onClick={() => handleExport('csv')} disabled={!!exporting}
                  className="flex flex-col items-center gap-3 p-5 border-2 border-dashed border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50 group">
                  <FileText className="h-9 w-9 text-green-600 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">CSV</p>
                    <p className="text-xs text-gray-500 mt-0.5">Comma-separated, opens in any spreadsheet</p>
                  </div>
                  {exporting === 'csv'
                    ? <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                    : <span className="text-xs text-red-700 font-medium opacity-0 group-hover:opacity-100">Download →</span>}
                </button>

                {/* Excel */}
                <button onClick={() => handleExport('excel')} disabled={!!exporting}
                  className="flex flex-col items-center gap-3 p-5 border-2 border-dashed border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50 group">
                  <FileSpreadsheet className="h-9 w-9 text-emerald-700 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">Excel</p>
                    <p className="text-xs text-gray-500 mt-0.5">.xlsx with reference sheet for valid values</p>
                  </div>
                  {exporting === 'excel'
                    ? <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                    : <span className="text-xs text-red-700 font-medium opacity-0 group-hover:opacity-100">Download →</span>}
                </button>

                {/* PDF */}
                <button onClick={() => handleExport('pdf')} disabled={!!exporting}
                  className="flex flex-col items-center gap-3 p-5 border-2 border-dashed border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50 group">
                  <File className="h-9 w-9 text-red-600 group-hover:scale-110 transition-transform" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">PDF</p>
                    <p className="text-xs text-gray-500 mt-0.5">Formatted A4 landscape report for printing</p>
                  </div>
                  {exporting === 'pdf'
                    ? <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                    : <span className="text-xs text-red-700 font-medium opacity-0 group-hover:opacity-100">Download →</span>}
                </button>
              </div>

              <div className="pt-2 border-t text-center">
                <p className="text-xs text-gray-400 mb-2">Need to import new parts? Use the Import tab.</p>
              </div>
            </div>
          )}

          {/* ── IMPORT TAB ─────────────────────────────────────── */}
          {tab === 'import' && (
            <div className="space-y-4">
              {/* Template download */}
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-amber-800">Step 1 — Download the template</p>
                  <p className="text-xs text-amber-700 mt-0.5">Fill in your parts data using the exact column headers.</p>
                </div>
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 shrink-0">
                  <Download className="h-3.5 w-3.5" /> Template
                </button>
              </div>

              {/* File upload */}
              {!result && (
                <>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Step 2 — Upload your filled CSV</p>
                    {!fileName ? (
                      <button type="button" onClick={() => fileRef.current?.click()}
                        className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-500 hover:border-red-400 hover:text-red-600 transition-colors">
                        <Upload className="h-8 w-8 opacity-60" />
                        <p className="text-sm font-medium">Click to upload CSV file</p>
                        <p className="text-xs text-gray-400">.csv only · rows with # are treated as comments</p>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{fileName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {parsedRows.length} valid rows · {parseErrors.length} errors
                          </p>
                        </div>
                        <button onClick={resetImport} className="text-gray-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                  </div>

                  {/* Parse errors */}
                  {parseErrors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1 max-h-32 overflow-auto">
                      {parseErrors.map((e, i) => (
                        <p key={i} className="text-xs text-red-700 flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> {e}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Preview table */}
                  {parsedRows.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Step 3 — Preview &amp; confirm ({parsedRows.length} rows)
                      </p>
                      <div className="border rounded-lg overflow-auto max-h-52">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-800 text-white sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left">#</th>
                              <th className="px-3 py-2 text-left">Product</th>
                              <th className="px-3 py-2 text-left">Variant</th>
                              <th className="px-3 py-2 text-left">Category</th>
                              <th className="px-3 py-2 text-right">Price</th>
                              <th className="px-3 py-2 text-right">Stock</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {parsedRows.map((r, i) => (
                              <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                                <td className="px-3 py-1.5 text-gray-400">{i + 2}</td>
                                <td className="px-3 py-1.5 font-medium text-gray-900">
                                  {r.productName}
                                  {r.partNumber && <span className="ml-1 text-red-600 font-mono">[{r.partNumber}]</span>}
                                </td>
                                <td className="px-3 py-1.5 text-gray-600">{r.variantName}</td>
                                <td className="px-3 py-1.5 text-gray-500">{r.categoryName}</td>
                                <td className="px-3 py-1.5 text-right font-semibold">₹{r.sellingPrice.toLocaleString('en-IN')}</td>
                                <td className="px-3 py-1.5 text-right text-green-700">{r.openingStock}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <button onClick={handleImport} disabled={importing}
                        className="mt-3 w-full py-2.5 bg-red-700 text-white rounded-lg text-sm font-semibold hover:bg-red-800 disabled:opacity-50 flex items-center justify-center gap-2">
                        {importing
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                          : <><Upload className="h-4 w-4" /> Import {parsedRows.length} Parts</>}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Import result */}
              {result && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
                    <div>
                      <p className="font-bold text-green-800 text-base">{result.created} parts imported successfully</p>
                      {result.errors.length > 0 && (
                        <p className="text-sm text-amber-700 mt-0.5">{result.errors.length} rows had errors (see below)</p>
                      )}
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1 max-h-36 overflow-auto">
                      {result.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-700">
                          Row {e.row}: {e.reason}
                        </p>
                      ))}
                    </div>
                  )}

                  <button onClick={resetImport}
                    className="w-full py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    Import Another File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
