import { openPrintPreview } from '@/store/print.store';
import { buildA4InvoiceHtml } from './print-a4';

export interface PrintInvoice {
  invoiceNumber: string;
  createdAt: string;
  // Printed bill number + type (absent on invoices created before bill series existed).
  billNo?: string | null;
  billType?: 'SALES' | 'SERVICE';
  serviceCategory?: string | null;
  technician?: { name: string } | null;
  tdsRaw?: string | null;
  tdsTreated?: string | null;
  store: { name: string; address?: string | null; phone?: string | null; gstNumber?: string | null; logoUrl?: string | null };
  customer?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    landmark?: string | null;
    gstin?: string | null;
    cardNo?: string | null;
    customFields?: Record<string, any> | null;
  } | null;
  items: Array<{
    description?: string | null;
    sku: {
      product: { name: string; partNumber?: string | null; hsnCode?: string | null };
      variantName: string;
      unit: string;
    };
    quantity: number;
    unitPrice: string;
    taxRate: string;
    taxAmount: string;
    lineTotal: string;
    serialUnits?: Array<{ serialNumber?: string | null; batchNumber?: string | null }>;
  }>;
  payments: Array<{ mode: string; amount: string; reference?: string | null }>;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  qrPayload?: string | null;
  createdBy?: { name: string } | null;
  gstApplied?: boolean; // undefined (older invoices) is treated as true
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card', BANK_TRANSFER: 'Bank Transfer', EMI: 'EMI',
};

function fmt(v: string | number): string {
  return '&#8377;' + parseFloat(String(v)).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function esc(s?: string | null): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface PartyStore { name: string; address?: string | null; phone?: string | null; gstNumber?: string | null }
interface PartyCustomer { name?: string | null; phone?: string | null; email?: string | null; address?: string | null; gstin?: string | null; cardNo?: string | null }

// Store name + address always print at the top in dark text — the name used
// to be white on a coloured band, which vanishes when the printer skips
// background colours. The customer block follows underneath.
function storeHeaderHtml(store: PartyStore): string {
  return `
  <div class="store-head">
    <div class="store-name">${esc(store.name)}</div>
    ${store.address ? `<div class="store-line">${esc(store.address).replace(/\n/g, '<br>')}</div>` : ''}
    ${store.phone ? `<div class="store-line">Ph: ${esc(store.phone)}</div>` : ''}
    ${store.gstNumber ? `<div class="store-line">GSTIN: ${esc(store.gstNumber)}</div>` : ''}
  </div>`;
}

function customerHtml(customer: PartyCustomer | null | undefined, title: string): string {
  if (!customer) return '';
  return `
  <div class="parties"><div class="party">
    <div class="section-title">${title}</div>
    <div class="party-name">${esc(customer.name || 'Walk-in Customer')}${customer.cardNo ? ` <span class="card-chip">#${esc(customer.cardNo)}</span>` : ''}</div>
    ${customer.address ? `<div>${esc(customer.address)}</div>` : ''}
    ${customer.phone ? `<div>Ph: ${esc(customer.phone)}</div>` : ''}
    ${customer.email ? `<div>${esc(customer.email)}</div>` : ''}
    ${customer.gstin ? `<div>GSTIN: ${esc(customer.gstin)}</div>` : ''}
  </div></div>`;
}

const RECEIPT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #111;
    background: #fff;
    width: 80mm;
    margin: 0 auto;
    padding: 0;
  }
  .store-head { text-align: center; padding: 8px 10px 6px; border-bottom: 2px solid #111; }
  .store-name { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #111; }
  .store-line { font-size: 9px; color: #222; line-height: 1.4; }
  .card-chip { font-size: 9px; font-weight: 700; color: #1d4ed8; }
  .store-sub  { font-size: 8px; opacity: 0.85; margin-top: 2px; }
  .store-details {
    text-align: center;
    padding: 5px 10px;
    font-size: 9px;
    color: #444;
    border-bottom: 1px dashed #999;
  }
  .meta-box {
    display: flex;
    justify-content: space-between;
    padding: 6px 10px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .meta-label { font-size: 7px; font-weight: 700; letter-spacing: 1px; color: #888; text-transform: uppercase; }
  .meta-inv   { font-size: 11px; font-weight: 800; color: #7f1d1d; font-family: monospace; margin-top: 1px; }
  .meta-right { text-align: right; }
  .meta-date  { font-weight: 700; font-size: 10px; }
  .meta-time  { font-size: 9px; color: #666; }
  .parties { display: flex; gap: 6px; padding: 6px 10px; border-bottom: 1px solid #ddd; }
  .party { flex: 1 1 50%; min-width: 0; font-size: 9px; color: #444; line-height: 1.4; word-wrap: break-word; }
  .party-name { font-weight: 700; font-size: 10.5px; color: #111; }
  .party + .party { border-left: 1px dashed #bbb; padding-left: 6px; }
  .billed-to  { padding: 6px 10px; border-bottom: 1px solid #eee; background: #fffafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-title { font-size: 7px; font-weight: 700; letter-spacing: 1px; color: #888; text-transform: uppercase; margin-bottom: 3px; }
  .customer-name   { font-weight: 700; font-size: 11px; }
  .customer-detail { font-size: 9px; color: #555; }
  .vehicle-row     { margin-top: 3px; display: flex; gap: 4px; flex-wrap: wrap; }
  .vehicle-badge {
    background: #7f1d1d; color: #fff;
    padding: 1px 6px; border-radius: 3px;
    font-size: 8px; font-weight: 700; font-family: monospace;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .model-badge { background: #eee; color: #333; padding: 1px 6px; border-radius: 3px; font-size: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .items-header {
    display: flex;
    padding: 4px 10px;
    background: #1f2937;
    color: #fff;
    font-size: 7.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .items-body { border-bottom: 2px solid #111; }
  .item-row {
    display: flex;
    padding: 5px 10px;
    gap: 4px;
    border-bottom: 1px solid #eee;
    align-items: flex-start;
  }
  .item-row.alt { background: #f8f8f8; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .col-item  { flex: 1 1 auto; min-width: 0; }
  .col-qty   { flex: 0 0 28px; text-align: center; font-size: 9px; }
  .col-rate  { flex: 0 0 46px; text-align: right; font-size: 9px; }
  .col-gst   { flex: 0 0 38px; text-align: right; font-size: 9px; }
  .col-total { flex: 0 0 46px; text-align: right; font-size: 9px; font-weight: 700; }
  .item-name    { font-weight: 700; font-size: 10px; line-height: 1.3; }
  .item-variant { font-size: 8px; color: #555; }
  .item-part    { font-size: 8px; color: #7f1d1d; font-family: monospace; }
  .item-serial  { font-size: 7.5px; color: #555; font-family: monospace; }
  .item-hsn     { font-size: 7.5px; color: #888; }
  .small-label  { font-size: 7.5px; color: #888; }
  .totals { padding: 5px 10px; border-bottom: 1px dashed #bbb; }
  .total-row {
    display: flex; justify-content: space-between;
    font-size: 10px; padding: 1.5px 0; color: #444;
  }
  .discount-row { color: #16a34a; }
  .grand-total {
    display: flex; justify-content: space-between;
    font-size: 14px; font-weight: 800; color: #7f1d1d;
    padding: 5px 0 2px; margin-top: 3px;
    border-top: 2px solid #111;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .payments { padding: 5px 10px; border-bottom: 1px dashed #bbb; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pay-row  { display: flex; justify-content: space-between; font-size: 9px; padding: 1.5px 0; }
  .balance-due { color: #dc2626; font-weight: 700; }
  .change      { color: #16a34a; font-weight: 700; }
  .footer {
    text-align: center; padding: 8px 10px 10px;
    font-size: 9px; color: #555; line-height: 1.7;
  }
  .footer-line { font-weight: 700; color: #7f1d1d; font-size: 10px; margin-bottom: 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .footer-note { color: #777; font-size: 8px; }
  .served-by   { margin-top: 4px; font-size: 8px; }
  hr.dash { border: none; border-top: 1px dashed #bbb; margin: 0; }
  @page { margin: 0; size: 80mm auto; }
  @media print { body { width: 72mm; } }
`;

function buildHtml(invoice: PrintInvoice): string {
  const date = new Date(invoice.createdAt);
  const balance = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount);
  const hasDiscount = parseFloat(invoice.discountAmount) > 0;
  const gstApplied = invoice.gstApplied !== false;

  const cf = invoice.customer?.customFields;
  const vehicleHtml = (cf?.vehicle_no || cf?.re_model) ? `
    <div class="billed-to">
      <div class="vehicle-row">
        ${cf.vehicle_no ? `<span class="vehicle-badge">${esc(cf.vehicle_no)}</span>` : ''}
        ${cf.re_model ? `<span class="model-badge">${esc(cf.re_model)}</span>` : ''}
      </div>
    </div>` : '';

  const itemsHtml = invoice.items.map((item, i) => {
    const serial = item.serialUnits?.[0];
    return `
      <div class="item-row ${i % 2 === 1 ? 'alt' : ''}">
        <div class="col-item">
          <div class="item-name">${esc(item.description || item.sku.product.name)}</div>
          ${item.description ? '' : `<div class="item-variant">${esc(item.sku.variantName)}</div>`}
          ${!item.description && item.sku.product.partNumber ? `<div class="item-part">Part# ${esc(item.sku.product.partNumber)}</div>` : ''}
          ${serial?.serialNumber ? `<div class="item-serial">S/N: ${esc(serial.serialNumber)}</div>` : ''}
          ${serial?.batchNumber ? `<div class="item-serial">Batch: ${esc(serial.batchNumber)}</div>` : ''}
          ${item.sku.product.hsnCode ? `<div class="item-hsn">HSN: ${esc(item.sku.product.hsnCode)}</div>` : ''}
        </div>
        <div class="col-qty">${item.quantity}<br><span class="small-label">${esc(item.sku.unit)}</span></div>
        <div class="col-rate">${fmt(item.unitPrice)}</div>
        ${gstApplied ? `<div class="col-gst">${item.taxRate}%<br><span class="small-label">${fmt(item.taxAmount)}</span></div>` : ''}
        <div class="col-total">${fmt(item.lineTotal)}</div>
      </div>`;
  }).join('');

  const paymentsHtml = invoice.payments.map((p) => `
    <div class="pay-row">
      <span>${esc(PAYMENT_LABELS[p.mode] || p.mode)}${p.reference ? ` &middot; ${esc(p.reference)}` : ''}</span>
      <span>${fmt(p.amount)}</span>
    </div>`).join('');

  const balanceHtml = balance > 0.005
    ? `<div class="pay-row balance-due"><span>Balance Due</span><span>${fmt(balance)}</span></div>`
    : balance < -0.005
    ? `<div class="pay-row change"><span>Change</span><span>${fmt(Math.abs(balance))}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt ${esc(invoice.invoiceNumber)}</title>
  <style>${RECEIPT_CSS}</style>
</head>
<body>
  ${storeHeaderHtml(invoice.store)}

  ${customerHtml(invoice.customer, 'Billed To')}

  <div class="meta-box">
    <div>
      <div class="meta-label">${invoice.billType === 'SERVICE' ? 'Service Bill' : gstApplied ? 'Tax Invoice' : 'Bill'}</div>
      <div class="meta-inv">${invoice.billNo ? `No. ${esc(invoice.billNo)}` : esc(invoice.invoiceNumber)}</div>
    </div>
    <div class="meta-right">
      <div class="meta-date">${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      <div class="meta-time">${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
    </div>
  </div>

  ${vehicleHtml}

  <div class="items-header">
    <span class="col-item">Item</span>
    <span class="col-qty">Qty</span>
    <span class="col-rate">Rate</span>
    ${gstApplied ? '<span class="col-gst">GST</span>' : ''}
    <span class="col-total">Total</span>
  </div>
  <div class="items-body">${itemsHtml}</div>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${fmt(invoice.subtotal)}</span></div>
    ${hasDiscount ? `<div class="total-row discount-row"><span>Discount</span><span>&minus; ${fmt(invoice.discountAmount)}</span></div>` : ''}
    <div class="total-row"><span>GST</span><span>${gstApplied ? fmt(invoice.taxAmount) : 'Not applicable'}</span></div>
    <div class="grand-total"><span>GRAND TOTAL</span><span>${fmt(invoice.totalAmount)}</span></div>
  </div>

  <div class="payments">
    <div class="section-title">Payment</div>
    ${paymentsHtml}
    ${balanceHtml}
  </div>

  <div class="footer">
    <div class="footer-line">&#10022; Thank you for your business &#10022;</div>
    <div class="footer-note">Parts sold are non-returnable.</div>
    <div class="footer-note">Warranty as per manufacturer terms.</div>
    ${invoice.createdBy ? `<div class="served-by">Served by: <strong>${esc(invoice.createdBy.name)}</strong></div>` : ''}
  </div>

</body>
</html>`;
}

// GST tax invoices and service bills open on the A4 layout (the formats the
// client files / hands over); plain counter bills open on the thermal slip.
export function printReceipt(invoice: PrintInvoice): void {
  const a4 = { label: 'A4 Bill', html: buildA4InvoiceHtml(invoice) };
  const slip = { label: '80mm Receipt', html: buildHtml(invoice) };
  const gst = invoice.gstApplied !== false && parseFloat(invoice.taxAmount) > 0;
  const a4First = invoice.billType === 'SERVICE' || gst;
  const kind = invoice.billType === 'SERVICE' ? 'Service Bill' : gst ? 'Tax Invoice' : 'Bill';
  openPrintPreview(a4First ? [a4, slip] : [slip, a4], `${kind} ${invoice.billNo || invoice.invoiceNumber}`);
}

export interface PrintQuotation {
  quotationNumber: string;
  status: 'OPEN' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  validUntil?: string | null;
  notes?: string | null;
  store: { name: string; address?: string | null; phone?: string | null; gstNumber?: string | null };
  customer?: { name?: string | null; phone?: string | null; email?: string | null; address?: string | null; gstin?: string | null } | null;
  items: Array<{
    sku: {
      product: { name: string; partNumber?: string | null; hsnCode?: string | null };
      variantName: string;
      unit: string;
    };
    quantity: string | number;
    unitPrice: string;
    taxRate: string;
    taxAmount: string;
    lineTotal: string;
  }>;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  gstApplied?: boolean;
  createdBy?: { name: string } | null;
}

function buildQuotationHtml(quotation: PrintQuotation): string {
  const date = new Date(quotation.createdAt);
  const hasDiscount = parseFloat(quotation.discountAmount) > 0;
  const gstApplied = quotation.gstApplied !== false;

  const itemsHtml = quotation.items.map((item, i) => `
      <div class="item-row ${i % 2 === 1 ? 'alt' : ''}">
        <div class="col-item">
          <div class="item-name">${esc(item.sku.product.name)}</div>
          <div class="item-variant">${esc(item.sku.variantName)}</div>
          ${item.sku.product.partNumber ? `<div class="item-part">Part# ${esc(item.sku.product.partNumber)}</div>` : ''}
          ${item.sku.product.hsnCode ? `<div class="item-hsn">HSN: ${esc(item.sku.product.hsnCode)}</div>` : ''}
        </div>
        <div class="col-qty">${item.quantity}<br><span class="small-label">${esc(item.sku.unit)}</span></div>
        <div class="col-rate">${fmt(item.unitPrice)}</div>
        ${gstApplied ? `<div class="col-gst">${item.taxRate}%<br><span class="small-label">${fmt(item.taxAmount)}</span></div>` : ''}
        <div class="col-total">${fmt(item.lineTotal)}</div>
      </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Quotation ${esc(quotation.quotationNumber)}</title>
  <style>${RECEIPT_CSS}</style>
</head>
<body>
  ${storeHeaderHtml(quotation.store)}

  ${customerHtml(quotation.customer, 'Quoted To')}

  <div class="meta-box">
    <div>
      <div class="meta-label">Quotation</div>
      <div class="meta-inv">${esc(quotation.quotationNumber)}</div>
    </div>
    <div class="meta-right">
      <div class="meta-date">${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      ${quotation.validUntil ? `<div class="meta-time">Valid till ${new Date(quotation.validUntil).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>` : ''}
    </div>
  </div>

  <div class="items-header">
    <span class="col-item">Item</span>
    <span class="col-qty">Qty</span>
    <span class="col-rate">Rate</span>
    ${gstApplied ? '<span class="col-gst">GST</span>' : ''}
    <span class="col-total">Total</span>
  </div>
  <div class="items-body">${itemsHtml}</div>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${fmt(quotation.subtotal)}</span></div>
    ${hasDiscount ? `<div class="total-row discount-row"><span>Discount</span><span>&minus; ${fmt(quotation.discountAmount)}</span></div>` : ''}
    <div class="total-row"><span>GST</span><span>${gstApplied ? fmt(quotation.taxAmount) : 'Not applicable'}</span></div>
    <div class="grand-total"><span>ESTIMATED TOTAL</span><span>${fmt(quotation.totalAmount)}</span></div>
  </div>

  ${quotation.notes ? `<div class="payments"><div class="section-title">Notes</div><div class="customer-detail">${esc(quotation.notes)}</div></div>` : ''}

  <div class="footer">
    <div class="footer-line">This is a quotation, not a tax invoice</div>
    <div class="footer-note">Prices are estimates and subject to change until converted to an invoice.</div>
    ${quotation.createdBy ? `<div class="served-by">Prepared by: <strong>${esc(quotation.createdBy.name)}</strong></div>` : ''}
  </div>

</body>
</html>`;
}

export function printQuotation(quotation: PrintQuotation): void {
  openPrintPreview(buildQuotationHtml(quotation), `Quotation ${quotation.quotationNumber}`);
}
