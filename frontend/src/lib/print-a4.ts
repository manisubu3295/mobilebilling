import type { PrintInvoice } from './print-receipt';

// A4 bill layouts modelled on the client's own paper/Excel formats:
//  - GST tax invoice  → "GST BILL AYYAMPETTAI GH.pdf" (HSN column, CGST/SGST split)
//  - service bill     → the technician's bill book (service-type tick boxes, TDS)
//  - plain bill       → same grid without any GST columns

function esc(s?: string | null): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function money(v: number | string): string {
  return parseFloat(String(v)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number): string {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`;
}

function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? belowHundred(r) : ''].filter(Boolean).join(' ');
}

// Indian grouping: crore / lakh / thousand.
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  const words = parts.length ? parts.join(' ') : 'Zero';
  return `Rupees ${words}${paise ? ` and ${belowHundred(paise)} Paise` : ''} Only`;
}

const SERVICE_CATEGORY_LABELS: Array<[string, string]> = [
  ['WARRANTY', 'Warranty'],
  ['OUT_OF_WARRANTY', 'Out of Warranty'],
  ['OTHER_SERVICE', 'Other Service'],
  ['IRF', 'IRF'],
  ['AMC', 'AMC'],
];

// Print-safe design: colour comes from text and borders (printers often skip
// background colours), light tints only as extras.
const A4_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Roboto, Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #1f2937; background: #fff; padding: 12mm; }
  @page { size: A4; margin: 12mm; }
  @media print { body { padding: 0; } }
  .page { max-width: 186mm; margin: 0 auto; }
  .accent { color: #b91c1c; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 10px; border-bottom: 3px solid #b91c1c; }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .brand img { max-height: 24mm; max-width: 34mm; object-fit: contain; }
  .shop-name { font-size: 20pt; font-weight: 800; color: #111827; letter-spacing: 0.3px; line-height: 1.1; }
  .shop-line { font-size: 9pt; color: #4b5563; line-height: 1.45; }
  .shop-gst { font-size: 9pt; font-weight: 700; color: #111827; margin-top: 2px; }
  .doc { text-align: right; flex-shrink: 0; }
  .doc-title { display: inline-block; border: 2px solid #b91c1c; color: #b91c1c; font-weight: 800; letter-spacing: 1.5px; font-size: 11pt; padding: 4px 12px; border-radius: 6px; }
  .doc-meta { margin-top: 8px; font-size: 9.5pt; line-height: 1.6; }
  .doc-meta b { color: #111827; }
  .cards { display: flex; gap: 10px; margin: 12px 0; }
  .card { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 9px 11px; }
  .label { font-size: 7.5pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #9ca3af; margin-bottom: 3px; }
  .cust-name { font-size: 11.5pt; font-weight: 700; color: #111827; }
  .card-line { font-size: 9.5pt; color: #374151; line-height: 1.45; }
  .kv { display: grid; grid-template-columns: max-content 1fr; column-gap: 10px; row-gap: 2px; font-size: 9.5pt; }
  .kv span:nth-child(odd) { color: #6b7280; }
  .kv span:nth-child(even) { font-weight: 600; color: #111827; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: -2px 0 12px; }
  .chip { border: 1px solid #d1d5db; border-radius: 999px; padding: 2px 10px; font-size: 8.5pt; color: #6b7280; }
  .chip.on { border-color: #b91c1c; color: #b91c1c; font-weight: 700; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { font-size: 8pt; letter-spacing: 0.6px; text-transform: uppercase; color: #6b7280; text-align: left; padding: 7px 8px; border-bottom: 2px solid #111827; }
  table.items td { padding: 8px; border-bottom: 1px solid #eef0f3; vertical-align: top; font-size: 10pt; }
  table.items tr:nth-child(even) td { background: #fafafa; }
  .num { text-align: right; white-space: nowrap; }
  .ctr { text-align: center; }
  .desc-main { font-weight: 600; color: #111827; }
  .desc-sub { font-size: 8.5pt; color: #6b7280; }
  .bottom { display: flex; gap: 16px; margin-top: 12px; align-items: flex-start; }
  .words { flex: 1; font-size: 9pt; color: #374151; }
  .words .label { margin-bottom: 2px; }
  .totals { width: 44%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; }
  .trow { display: flex; justify-content: space-between; font-size: 10pt; padding: 3px 0; color: #374151; }
  .trow.grand { border-top: 2px solid #111827; margin-top: 4px; padding-top: 7px; font-size: 13pt; font-weight: 800; color: #b91c1c; }
  .trow.due { color: #b91c1c; font-weight: 700; }
  .sign { display: flex; justify-content: space-between; margin-top: 26mm; }
  .sign div { width: 42%; border-top: 1px solid #9ca3af; padding-top: 5px; font-size: 9pt; color: #4b5563; text-align: center; }
  .foot { margin-top: 10px; text-align: center; font-size: 8.5pt; color: #9ca3af; }
`;

interface Line {
  description: string;
  sub: string;
  hsn: string;
  qty: string;
  rate: number;
  amount: number; // before tax
  taxRate: number;
  tax: number;
}

function linesOf(invoice: PrintInvoice): Line[] {
  return invoice.items.map((item) => {
    const qty = Number(item.quantity);
    const rate = parseFloat(item.unitPrice);
    const custom = item.description?.trim();
    const product = item.sku.product;
    return {
      description: custom || product.name,
      sub: custom
        ? ''
        : [item.sku.variantName && item.sku.variantName !== 'Standard' ? item.sku.variantName : '',
           product.partNumber ? `Code: ${product.partNumber}` : '',
           item.serialUnits?.[0]?.serialNumber ? `S/N: ${item.serialUnits[0].serialNumber}` : '']
          .filter(Boolean).join(' · '),
      hsn: product.hsnCode || '',
      qty: `${qty}${item.sku.unit && item.sku.unit !== 'PCS' ? ' ' + item.sku.unit : ''}`,
      rate,
      amount: rate * qty,
      taxRate: parseFloat(item.taxRate),
      tax: parseFloat(item.taxAmount),
    };
  });
}

// Inter-state supply (customer GSTIN from another state) is charged IGST;
// otherwise GST splits evenly into CGST + SGST. The state is the first two
// digits of a GSTIN.
export function isInterState(storeGstin?: string | null, customerGstin?: string | null): boolean {
  const a = storeGstin?.trim().slice(0, 2);
  const b = customerGstin?.trim().slice(0, 2);
  return !!a && !!b && /^\d\d$/.test(a) && /^\d\d$/.test(b) && a !== b;
}

export function buildA4InvoiceHtml(invoice: PrintInvoice): string {
  const isService = invoice.billType === 'SERVICE';
  const gst = invoice.gstApplied !== false && parseFloat(invoice.taxAmount) > 0;
  const lines = linesOf(invoice);
  const date = new Date(invoice.createdAt);
  const title = isService ? 'SERVICE BILL' : gst ? 'TAX INVOICE' : 'BILL';
  const billNo = invoice.billNo || invoice.invoiceNumber;
  const store = invoice.store;
  const customer = invoice.customer;

  const igst = isInterState(store.gstNumber, customer?.gstin);
  // Tax lines per GST rate: IGST in full, or CGST/SGST half each.
  const byRate = new Map<number, { taxable: number; tax: number }>();
  if (gst) {
    for (const l of lines) {
      if (!l.tax) continue;
      const e = byRate.get(l.taxRate) ?? { taxable: 0, tax: 0 };
      e.taxable += l.amount;
      e.tax += l.tax;
      byRate.set(l.taxRate, e);
    }
  }
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discount = parseFloat(invoice.discountAmount || '0');
  const total = parseFloat(invoice.totalAmount);
  const paid = parseFloat(invoice.paidAmount || '0');
  const balance = total - paid;

  const trow = (label: string, value: string, cls = '') => `<div class="trow ${cls}"><span>${label}</span><span>${value}</span></div>`;
  const taxRows = Array.from(byRate.entries()).sort((a, b) => a[0] - b[0]).map(([rate, e]) => {
    if (igst) return trow(`IGST @ ${rate}%`, money(e.tax));
    const half = e.tax / 2;
    return trow(`CGST @ ${rate / 2}%`, money(half)) + trow(`SGST @ ${rate / 2}%`, money(half));
  }).join('');

  const itemRows = lines.map((l, i) => `
    <tr>
      <td class="ctr">${i + 1}</td>
      <td><div class="desc-main">${esc(l.description)}</div>${l.sub ? `<div class="desc-sub">${esc(l.sub)}</div>` : ''}</td>
      ${gst ? `<td class="ctr">${esc(l.hsn)}</td>` : ''}
      <td class="ctr">${esc(l.qty)}</td>
      <td class="num">${money(l.rate)}</td>
      <td class="num">${money(l.amount)}</td>
    </tr>`).join('');

  const customerAddress = [customer?.address, customer?.city].filter(Boolean).join(', ');
  const details: Array<[string, string]> = [];
  if (customer?.cardNo) details.push(['Card No', customer.cardNo]);
  if (isService && invoice.technician?.name) details.push(['Technician', invoice.technician.name]);
  if (isService && invoice.tdsRaw) details.push(['TDS raw water', invoice.tdsRaw]);
  if (isService && invoice.tdsTreated) details.push(['TDS treated', invoice.tdsTreated]);
  if (gst && customer?.gstin) details.push(['Customer GSTIN', customer.gstin]);
  if (igst) details.push(['Supply', 'Inter-state (IGST)']);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} ${esc(billNo)}</title>
  <style>${A4_CSS}</style>
</head>
<body>
<div class="page">
  <div class="head">
    <div class="brand">
      ${store.logoUrl ? `<img src="${esc(store.logoUrl)}" alt="" />` : ''}
      <div>
        <div class="shop-name">${esc(store.name)}</div>
        ${store.address ? `<div class="shop-line">${esc(store.address).replace(/\n/g, '<br>')}</div>` : ''}
        ${store.phone ? `<div class="shop-line">Ph: ${esc(store.phone)}</div>` : ''}
        ${store.gstNumber ? `<div class="shop-gst">GSTIN: ${esc(store.gstNumber)}</div>` : ''}
      </div>
    </div>
    <div class="doc">
      <div class="doc-title">${title}</div>
      <div class="doc-meta">
        <div>${isService ? 'Bill' : 'Invoice'} No: <b>${esc(billNo)}</b></div>
        <div>Date: <b>${date.toLocaleDateString('en-GB')}</b></div>
      </div>
    </div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="label">Bill to</div>
      <div class="cust-name">${esc(customer?.name || 'Walk-in Customer')}</div>
      ${customerAddress ? `<div class="card-line">${esc(customerAddress)}</div>` : ''}
      ${customer?.landmark ? `<div class="card-line">Landmark: ${esc(customer.landmark)}</div>` : ''}
      ${customer?.phone ? `<div class="card-line">Ph: ${esc(customer.phone)}</div>` : ''}
    </div>
    ${details.length ? `
    <div class="card">
      <div class="label">Details</div>
      <div class="kv">${details.map(([k, v]) => `<span>${k}</span><span>${esc(v)}</span>`).join('')}</div>
    </div>` : ''}
  </div>

  ${isService ? `<div class="chips">${SERVICE_CATEGORY_LABELS.map(([key, label]) =>
    `<span class="chip ${invoice.serviceCategory === key ? 'on' : ''}">${invoice.serviceCategory === key ? '&#10003; ' : ''}${label}</span>`).join('')}</div>` : ''}

  <table class="items">
    <thead>
      <tr>
        <th class="ctr" style="width:7%">#</th>
        <th>${isService ? 'Spares / work done' : 'Description'}</th>
        ${gst ? '<th class="ctr" style="width:11%">HSN</th>' : ''}
        <th class="ctr" style="width:9%">Qty</th>
        <th class="num" style="width:14%">Rate</th>
        <th class="num" style="width:16%">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="bottom">
    <div class="words">
      <div class="label">Amount in words</div>
      <div>${amountInWords(total)}</div>
    </div>
    <div class="totals">
      ${trow('Sub total', money(subtotal))}
      ${discount > 0 ? trow('Discount', '&minus; ' + money(discount)) : ''}
      ${gst && discount > 0 ? trow('Taxable value', money(subtotal - discount)) : ''}
      ${taxRows}
      ${trow('Total', '&#8377; ' + money(total), 'grand')}
      ${paid > 0 && Math.abs(balance) > 0.005 ? trow('Paid', money(paid)) : ''}
      ${balance > 0.005 ? trow('Balance due', money(balance), 'due') : ''}
    </div>
  </div>

  <div class="sign">
    <div>Customer signature</div>
    <div>For ${esc(store.name)}</div>
  </div>
  <div class="foot">${isService ? 'Service carried out as per the details above.' : gst ? 'Certified that the particulars given above are true and correct.' : ''} Thank you for your business!</div>
</div>
</body>
</html>`;
}
