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

const A4_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; background: #fff; padding: 10mm; }
  @page { size: A4; margin: 10mm; }
  @media print { body { padding: 0; } }
  .sheet { border: 2px solid #111; max-width: 190mm; margin: 0 auto; }
  .row { display: flex; }
  .cell { padding: 4px 8px; }
  .b-b { border-bottom: 1.5px solid #111; }
  .b-r { border-right: 1.5px solid #111; }
  .head-left { flex: 1 1 62%; }
  .head-right { flex: 1 1 38%; display: flex; align-items: center; justify-content: center; padding: 6px; }
  .head-right img { max-width: 100%; max-height: 32mm; object-fit: contain; }
  .doc-title { text-align: center; font-weight: 800; color: #1d4ed8; font-size: 13pt; letter-spacing: 1px; }
  .shop-name { text-align: center; font-weight: 800; color: #b91c1c; font-size: 22pt; }
  .shop-addr { text-align: center; color: #b91c1c; font-size: 11pt; line-height: 1.35; }
  .shop-meta { text-align: center; color: #1d4ed8; font-weight: 700; font-size: 11pt; line-height: 1.35; }
  .lbl { color: #b91c1c; font-weight: 700; white-space: nowrap; }
  .party { flex: 1 1 62%; }
  .party-grid { display: grid; grid-template-columns: max-content 1fr; column-gap: 8px; row-gap: 3px; }
  .meta { flex: 1 1 38%; }
  .meta .party-grid { grid-template-columns: max-content 1fr; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { color: #b91c1c; font-size: 10.5pt; padding: 5px 6px; border-bottom: 1.5px solid #111; border-right: 1.5px solid #111; }
  table.items td { padding: 5px 6px; border-right: 1.5px solid #111; vertical-align: top; font-size: 10.5pt; }
  table.items th:last-child, table.items td:last-child { border-right: none; }
  table.items tr.filler td { height: 100%; }
  .num { text-align: right; white-space: nowrap; }
  .ctr { text-align: center; }
  .desc-main { font-weight: 700; }
  .desc-sub { font-size: 9pt; color: #555; }
  .totals td { border-top: 1.5px solid #111; font-weight: 700; }
  .grand td { font-size: 12pt; }
  .grand .lbl-cell { color: #b91c1c; }
  .words { font-style: italic; font-size: 10pt; }
  .checks { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 10.5pt; }
  .box { display: inline-block; width: 11px; height: 11px; border: 1.3px solid #111; margin-right: 4px; vertical-align: -1px; text-align: center; line-height: 9px; font-size: 10px; font-weight: 800; }
  .sign { display: flex; justify-content: space-between; padding: 8px 10px 0; min-height: 26mm; }
  .sign div { color: #b91c1c; font-weight: 700; align-self: flex-end; }
  .terms { font-size: 9.5pt; color: #333; }
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
  const cols = gst ? 6 : 5;

  const igst = isInterState(invoice.store.gstNumber, invoice.customer?.gstin);
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
  const taxable = lines.reduce((s, l) => s + l.amount, 0);
  const discount = parseFloat(invoice.discountAmount || '0');
  const total = parseFloat(invoice.totalAmount);
  const paid = parseFloat(invoice.paidAmount || '0');
  const balance = total - paid;

  const itemRows = lines.map((l, i) => `
    <tr>
      <td class="ctr">${i + 1}</td>
      <td><div class="desc-main">${esc(l.description)}</div>${l.sub ? `<div class="desc-sub">${esc(l.sub)}</div>` : ''}</td>
      ${gst ? `<td class="ctr">${esc(l.hsn)}</td>` : ''}
      <td class="ctr">${esc(l.qty)}</td>
      <td class="num">${money(l.rate)}</td>
      <td class="num">${money(l.amount)}</td>
    </tr>`).join('');

  const span = cols - 1;
  const totalRow = (label: string, value: string, cls = '') =>
    `<tr class="totals ${cls}"><td colspan="${span}" class="num lbl-cell">${label}</td><td class="num">${value}</td></tr>`;

  const taxRows = Array.from(byRate.entries()).sort((a, b) => a[0] - b[0]).map(([rate, e]) => {
    if (igst) return totalRow(`IGST @ ${rate}%`, money(e.tax));
    const half = e.tax / 2;
    const r = (rate / 2).toString();
    return totalRow(`CGST @ ${r}%`, money(half)) + totalRow(`SGST @ ${r}%`, money(half));
  }).join('');

  const customer = invoice.customer;
  const customerAddress = [customer?.address, customer?.city].filter(Boolean).join(', ');

  const serviceBlock = isService ? `
    <div class="row b-b">
      <div class="cell b-r" style="flex:1 1 62%">
        <div class="checks">
          ${SERVICE_CATEGORY_LABELS.map(([key, label]) =>
            `<span><span class="box">${invoice.serviceCategory === key ? '&#10003;' : ''}</span>${label}</span>`).join('')}
        </div>
      </div>
      <div class="cell" style="flex:1 1 38%">
        <div class="party-grid">
          <span class="lbl">TDS RW :</span><span>${esc(invoice.tdsRaw) || '&nbsp;'}</span>
          <span class="lbl">TDS TW :</span><span>${esc(invoice.tdsTreated) || '&nbsp;'}</span>
        </div>
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} ${esc(billNo)}</title>
  <style>${A4_CSS}</style>
</head>
<body>
<div class="sheet">
  <div class="row b-b">
    <div class="head-left b-r">
      <div class="cell b-b doc-title">${title}</div>
      <div class="cell b-b shop-name">${esc(invoice.store.name)}</div>
      <div class="cell">
        ${invoice.store.address ? `<div class="shop-addr">${esc(invoice.store.address).replace(/\n/g, '<br>')}</div>` : ''}
        ${invoice.store.phone ? `<div class="shop-meta">Cell: ${esc(invoice.store.phone)}</div>` : ''}
        ${invoice.store.gstNumber ? `<div class="shop-meta">GSTIN: ${esc(invoice.store.gstNumber)}</div>` : ''}
      </div>
    </div>
    <div class="head-right">
      ${invoice.store.logoUrl ? `<img src="${esc(invoice.store.logoUrl)}" alt="" />` : ''}
    </div>
  </div>

  <div class="row b-b">
    <div class="party cell b-r">
      <div class="party-grid">
        <span class="lbl">NAME :</span><span>${esc(customer?.name || 'Walk-in Customer')}</span>
        <span class="lbl">ADDRESS :</span><span>${esc(customerAddress) || '&nbsp;'}</span>
        ${customer?.landmark ? `<span class="lbl">LANDMARK :</span><span>${esc(customer.landmark)}</span>` : ''}
        <span class="lbl">MOBILE :</span><span>${esc(customer?.phone) || '&nbsp;'}</span>
      </div>
    </div>
    <div class="meta cell">
      <div class="party-grid">
        ${gst ? `<span class="lbl">GSTIN :</span><span>${esc(customer?.gstin) || '&nbsp;'}</span>` : ''}
        <span class="lbl">B.NO :</span><span><strong>${esc(billNo)}</strong></span>
        <span class="lbl">DATE :</span><span><strong>${date.toLocaleDateString('en-GB')}</strong></span>
        ${customer?.cardNo ? `<span class="lbl">CARD NO :</span><span>${esc(customer.cardNo)}</span>` : ''}
        ${isService && invoice.technician?.name ? `<span class="lbl">TECH :</span><span>${esc(invoice.technician.name)}</span>` : ''}
      </div>
    </div>
  </div>

  ${serviceBlock}

  <table class="items">
    <thead>
      <tr>
        <th style="width:9%">S.NO</th>
        <th>${isService ? 'SPARE / SERVICE DESCRIPTION' : 'DESCRIPTION'}</th>
        ${gst ? '<th style="width:11%">HSN CODE</th>' : ''}
        <th style="width:9%">QTY</th>
        <th style="width:13%">RATE</th>
        <th style="width:15%">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr><td style="height:${Math.max(20, 110 - lines.length * 9)}mm"></td><td></td>${gst ? '<td></td>' : ''}<td></td><td></td><td></td></tr>
      ${discount > 0
        ? totalRow('SUB TOTAL', money(taxable)) + totalRow('DISCOUNT', '&minus; ' + money(discount))
          + (gst ? totalRow('TAXABLE VALUE', money(taxable - discount)) : '')
        : totalRow(gst ? 'TAXABLE VALUE' : 'SUB TOTAL', money(taxable))}
      ${taxRows}
      ${totalRow('TOTAL', money(total), 'grand')}
      ${paid > 0 && Math.abs(balance) > 0.005 ? totalRow('PAID', money(paid)) + totalRow(balance > 0 ? 'BALANCE DUE' : 'CHANGE', money(Math.abs(balance))) : ''}
    </tbody>
  </table>

  <div class="cell b-b" style="border-top:1.5px solid #111"><span class="words">${amountInWords(total)}</span></div>
  ${!isService && !gst ? '' : `<div class="cell b-b terms">${isService ? 'Customer Signature confirms the service was completed to satisfaction.' : 'Certified that the particulars given above are true and correct.'}</div>`}
  <div class="sign">
    <div>For ${esc(invoice.store.name)}</div>
    <div>Customer Signature</div>
  </div>
</div>
</body>
</html>`;
}
