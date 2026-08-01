// Inventory export utilities — CSV, Excel, PDF

export interface ExportRow {
  productName: string;
  brand: string;
  partNumber: string;
  compatibleModels: string;
  category: string;
  hsnCode: string;
  variantName: string;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  taxRate: number;
  lowStockThreshold: number;
  currentStock: number;
  isSerialized: boolean;
  barcode: string;
}

export const CSV_HEADERS = [
  'Product Name',
  'Brand',
  'Part Number',
  'Compatible Models',
  'Category',
  'HSN Code',
  'Variant Name',
  'Unit',
  'Selling Price',
  'Cost Price',
  'Tax Rate (%)',
  'Low Stock Threshold',
  'Opening Stock',
];

export const TEMPLATE_ROW = [
  'Air Filter',
  '',
  'SKU-1001',
  '',
  'Filters & Fluids',
  '84021900',
  'Standard',
  'PCS',
  '250',
  '150',
  '18',
  '5',
  '10',
];

function escapeCsv(val: string | number): string {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function buildCsvString(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
}

function triggerDownload(content: string | Blob, filename: string, mime = 'text/plain') {
  const url = typeof content === 'string'
    ? URL.createObjectURL(new Blob([content], { type: mime }))
    : URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── CSV ─────────────────────────────────────────────────────────────── */
export function exportCsv(rows: ExportRow[]) {
  const data = rows.map((r) => [
    r.productName, r.brand, r.partNumber, r.compatibleModels,
    r.category, r.hsnCode, r.variantName, r.unit,
    r.sellingPrice, r.costPrice, r.taxRate,
    r.lowStockThreshold, r.currentStock,
  ]);
  const csv = buildCsvString(CSV_HEADERS, data);
  triggerDownload(csv, `inventory-${date()}.csv`, 'text/csv');
}

/* ── Template ────────────────────────────────────────────────────────── */
export function downloadTemplate() {
  const note = `# IMPORT TEMPLATE — Do NOT change column headers. Remove this comment row before importing.`;
  const unitNote = `# Valid Units: PCS | SET | PAIR | LITER | METER | KG`;
  const csv = [note, unitNote, CSV_HEADERS.join(','), TEMPLATE_ROW.join(',')].join('\n');
  triggerDownload(csv, 'inventory-import-template.csv', 'text/csv');
}

/* ── Excel ───────────────────────────────────────────────────────────── */
export async function exportExcel(rows: ExportRow[]) {
  const { utils, writeFile } = await import('xlsx');

  const wsData = [
    CSV_HEADERS,
    ...rows.map((r) => [
      r.productName, r.brand, r.partNumber, r.compatibleModels,
      r.category, r.hsnCode, r.variantName, r.unit,
      r.sellingPrice, r.costPrice, r.taxRate,
      r.lowStockThreshold, r.currentStock,
    ]),
  ];

  const ws = utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 24 },
    { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 8 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 },
  ];

  // Style header row (xlsx-js-style not installed so just make a note sheet)
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Inventory');

  // Add a "Valid Values" reference sheet
  const refData = [
    ['Unit Values'],
    ...['PCS', 'SET', 'PAIR', 'LITER', 'METER', 'KG'].map((u) => [u]),
  ];
  const wsRef = utils.aoa_to_sheet(refData);
  utils.book_append_sheet(wb, wsRef, 'Reference');

  writeFile(wb, `inventory-${date()}.xlsx`);
}

/* ── PDF ─────────────────────────────────────────────────────────────── */
export async function exportPdf(rows: ExportRow[], storeName: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(127, 29, 29);
  doc.rect(0, 0, 297, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(storeName || 'Inventory Report', 14, 8);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Inventory Report', 14, 14);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 200, 14);

  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: 22,
    head: [['#', 'Product', 'Part No.', 'Compatible', 'Category', 'Variant', 'Unit', 'Sell ₹', 'Cost ₹', 'GST%', 'Stock']],
    body: rows.map((r, i) => [
      i + 1,
      r.productName,
      r.partNumber || '—',
      r.compatibleModels || '—',
      r.category,
      r.variantName,
      r.unit,
      r.sellingPrice.toLocaleString('en-IN'),
      r.costPrice.toLocaleString('en-IN'),
      `${r.taxRate}%`,
      r.currentStock,
    ]),
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    bodyStyles: { fontSize: 7.5 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 24 },
      3: { cellWidth: 32 },
      4: { cellWidth: 24 },
      5: { cellWidth: 20 },
      6: { cellWidth: 10, halign: 'center' },
      7: { cellWidth: 18, halign: 'right' },
      8: { cellWidth: 18, halign: 'right' },
      9: { cellWidth: 10, halign: 'center' },
      10: { cellWidth: 14, halign: 'center' },
    },
    margin: { left: 10, right: 10 },
    didDrawPage: (data: any) => {
      // Footer on every page
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} · ${storeName || 'Inventory Report'}`,
        10,
        (doc as any).internal.pageSize.height - 5,
      );
    },
  });

  // Summary row
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(`Total SKUs: ${rows.length}  ·  Total Stock Units: ${rows.reduce((s, r) => s + r.currentStock, 0)}`, 10, finalY);

  doc.save(`inventory-${date()}.pdf`);
}

function date() {
  return new Date().toISOString().slice(0, 10);
}
