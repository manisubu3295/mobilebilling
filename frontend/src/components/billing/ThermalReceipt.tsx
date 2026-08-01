'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface Invoice {
  invoiceNumber: string;
  createdAt: string;
  store: { name: string; address?: string; phone?: string; gstNumber?: string };
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    customFields?: Record<string, any>;
  } | null;
  items: Array<{
    sku: {
      product: { name: string; partNumber?: string; hsnCode?: string };
      variantName: string;
      unit: string;
    };
    quantity: number;
    unitPrice: string;
    taxRate: string;
    taxAmount: string;
    lineTotal: string;
    serialUnits?: Array<{ serialNumber?: string; batchNumber?: string }>;
  }>;
  payments: Array<{ mode: string; amount: string; reference?: string }>;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  qrPayload?: string;
  createdBy?: { name: string };
}

const fmt = (v: string | number) =>
  '₹' + parseFloat(String(v)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  BANK_TRANSFER: 'Bank Transfer',
  EMI: 'EMI',
};

export function ThermalReceipt({ invoice }: { invoice: Invoice }) {
  const balance = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount);
  const date = new Date(invoice.createdAt);
  const hasDiscount = parseFloat(invoice.discountAmount) > 0;

  return (
    <>
      {/* ── On-screen receipt preview ───────────────────────────── */}
      <div className="receipt-card font-sans">

        {/* Header — red brand band */}
        <div className="receipt-brand-band">
          <div className="receipt-store-name">{invoice.store.name}</div>
        </div>

        {/* Store details */}
        <div className="receipt-store-details">
          {invoice.store.address && <div>{invoice.store.address}</div>}
          <div className="receipt-store-meta">
            {invoice.store.phone && <span>📞 {invoice.store.phone}</span>}
            {invoice.store.gstNumber && <span>GSTIN: {invoice.store.gstNumber}</span>}
          </div>
        </div>

        {/* Invoice meta row */}
        <div className="receipt-meta-box">
          <div className="receipt-meta-left">
            <div className="receipt-label">TAX INVOICE</div>
            <div className="receipt-inv-number">{invoice.invoiceNumber}</div>
          </div>
          <div className="receipt-meta-right">
            <div className="receipt-date">{date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div className="receipt-time">{date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
          </div>
        </div>

        {/* Billed To */}
        {invoice.customer && (
          <div className="receipt-billed-to">
            <div className="receipt-section-title">BILLED TO</div>
            <div className="receipt-customer-name">{invoice.customer.name || 'Walk-in Customer'}</div>
            {invoice.customer.phone && <div className="receipt-customer-detail">{invoice.customer.phone}</div>}
            {invoice.customer.email && <div className="receipt-customer-detail">{invoice.customer.email}</div>}
            {(invoice.customer.customFields?.vehicle_no || invoice.customer.customFields?.re_model) && (
              <div className="receipt-vehicle-row">
                {invoice.customer.customFields?.vehicle_no && <span className="receipt-vehicle-badge">{invoice.customer.customFields.vehicle_no}</span>}
                {invoice.customer.customFields?.re_model && <span className="receipt-model-badge">{invoice.customer.customFields.re_model}</span>}
              </div>
            )}
          </div>
        )}

        {/* Items table */}
        <div className="receipt-items-header">
          <span className="receipt-col-item">Item</span>
          <span className="receipt-col-qty">Qty</span>
          <span className="receipt-col-rate">Rate</span>
          <span className="receipt-col-gst">GST</span>
          <span className="receipt-col-total">Total</span>
        </div>

        <div className="receipt-items-body">
          {invoice.items.map((item, i) => {
            const serial = item.serialUnits?.[0];
            const baseAmt = parseFloat(item.unitPrice) * item.quantity;
            return (
              <div key={i} className={`receipt-item-row ${i % 2 === 1 ? 'receipt-item-alt' : ''}`}>
                <div className="receipt-col-item">
                  <div className="receipt-item-name">{item.sku.product.name}</div>
                  <div className="receipt-item-variant">{item.sku.variantName}</div>
                  {item.sku.product.partNumber && (
                    <div className="receipt-item-part">Part# {item.sku.product.partNumber}</div>
                  )}
                  {serial?.serialNumber && <div className="receipt-item-serial">S/N: {serial.serialNumber}</div>}
                  {serial?.batchNumber && <div className="receipt-item-serial">Batch: {serial.batchNumber}</div>}
                  {item.sku.product.hsnCode && <div className="receipt-item-hsn">HSN: {item.sku.product.hsnCode}</div>}
                </div>
                <div className="receipt-col-qty">{item.quantity}<br /><span className="receipt-unit">{item.sku.unit}</span></div>
                <div className="receipt-col-rate">{fmt(item.unitPrice)}</div>
                <div className="receipt-col-gst">{item.taxRate}%<br /><span className="receipt-tax-amt">{fmt(item.taxAmount)}</span></div>
                <div className="receipt-col-total receipt-item-total">{fmt(item.lineTotal)}</div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="receipt-totals-section">
          <div className="receipt-total-row">
            <span>Subtotal</span><span>{fmt(invoice.subtotal)}</span>
          </div>
          {hasDiscount && (
            <div className="receipt-total-row receipt-discount-row">
              <span>Discount</span><span>− {fmt(invoice.discountAmount)}</span>
            </div>
          )}
          <div className="receipt-total-row">
            <span>GST (incl.)</span><span>{fmt(invoice.taxAmount)}</span>
          </div>
          <div className="receipt-grand-total-row">
            <span>GRAND TOTAL</span><span>{fmt(invoice.totalAmount)}</span>
          </div>
        </div>

        {/* Payment breakdown */}
        <div className="receipt-payment-section">
          <div className="receipt-section-title">PAYMENT</div>
          {invoice.payments.map((p, i) => (
            <div key={i} className="receipt-payment-row">
              <span>{PAYMENT_LABELS[p.mode] || p.mode}{p.reference ? ` · ${p.reference}` : ''}</span>
              <span>{fmt(p.amount)}</span>
            </div>
          ))}
          {balance > 0.005 && (
            <div className="receipt-payment-row receipt-balance-due">
              <span>Balance Due</span><span>{fmt(balance)}</span>
            </div>
          )}
          {balance < -0.005 && (
            <div className="receipt-payment-row receipt-change">
              <span>Change</span><span>{fmt(Math.abs(balance))}</span>
            </div>
          )}
        </div>

        {/* QR Code */}
        {invoice.qrPayload && (
          <div className="receipt-qr-section">
            <QRCodeSVG value={invoice.qrPayload} size={110} level="H" includeMargin />
            <div className="receipt-qr-label">Scan to Pay via UPI</div>
          </div>
        )}

        {/* Footer */}
        <div className="receipt-footer">
          <div className="receipt-footer-line">✦ Thank you for your business ✦</div>
          <div className="receipt-footer-note">Parts sold are non-returnable.</div>
          <div className="receipt-footer-note">Warranty as per manufacturer terms.</div>
          {invoice.createdBy && (
            <div className="receipt-served-by">Served by: <strong>{invoice.createdBy.name}</strong></div>
          )}
        </div>
      </div>

      {/* ── Print-specific styles injected here ────────────────── */}
      <style>{`
        /* ── On-screen preview ─────────────────── */
        .receipt-card {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          box-shadow: 0 4px 24px rgba(0,0,0,0.10);
          font-size: 13px;
          color: #111;
          max-width: 420px;
          margin: 0 auto;
        }
        .receipt-brand-band {
          background: #7f1d1d;
          color: #fff;
          text-align: center;
          padding: 16px 12px 12px;
        }
        .receipt-store-name {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .receipt-store-sub {
          font-size: 11px;
          opacity: 0.85;
          margin-top: 2px;
          letter-spacing: 0.3px;
        }
        .receipt-store-details {
          text-align: center;
          padding: 8px 14px;
          font-size: 11px;
          color: #555;
          border-bottom: 1px dashed #ccc;
          line-height: 1.6;
        }
        .receipt-store-meta {
          display: flex;
          justify-content: center;
          gap: 14px;
          margin-top: 3px;
          flex-wrap: wrap;
        }
        .receipt-meta-box {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 10px 14px;
          background: #fafafa;
          border-bottom: 1px solid #eee;
        }
        .receipt-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #888;
          text-transform: uppercase;
        }
        .receipt-inv-number {
          font-size: 14px;
          font-weight: 800;
          color: #7f1d1d;
          font-family: monospace;
          margin-top: 2px;
        }
        .receipt-meta-right {
          text-align: right;
        }
        .receipt-date {
          font-weight: 700;
          font-size: 12px;
        }
        .receipt-time {
          font-size: 11px;
          color: #666;
        }
        .receipt-billed-to {
          padding: 10px 14px;
          border-bottom: 1px solid #eee;
          background: #fff9f9;
        }
        .receipt-section-title {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #888;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .receipt-customer-name {
          font-weight: 700;
          font-size: 13px;
        }
        .receipt-customer-detail {
          font-size: 11px;
          color: #555;
        }
        .receipt-vehicle-row {
          margin-top: 4px;
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .receipt-vehicle-badge {
          background: #7f1d1d;
          color: #fff;
          padding: 1px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          font-family: monospace;
          letter-spacing: 1px;
        }
        .receipt-model-badge {
          background: #f3f4f6;
          color: #374151;
          padding: 1px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }
        /* Items */
        .receipt-items-header {
          display: flex;
          align-items: center;
          padding: 6px 14px;
          background: #1f2937;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          gap: 6px;
        }
        .receipt-items-body {
          border-bottom: 2px solid #111;
        }
        .receipt-item-row {
          display: flex;
          padding: 8px 14px;
          gap: 6px;
          align-items: flex-start;
          border-bottom: 1px solid #f0f0f0;
        }
        .receipt-item-alt {
          background: #fafafa;
        }
        .receipt-col-item  { flex: 1 1 auto; min-width: 0; }
        .receipt-col-qty   { flex: 0 0 36px; text-align: center; font-size: 11px; }
        .receipt-col-rate  { flex: 0 0 60px; text-align: right; font-size: 11px; }
        .receipt-col-gst   { flex: 0 0 48px; text-align: right; font-size: 11px; }
        .receipt-col-total { flex: 0 0 64px; text-align: right; font-size: 11px; }
        .receipt-item-name    { font-weight: 700; font-size: 12px; line-height: 1.3; }
        .receipt-item-variant { font-size: 10px; color: #666; }
        .receipt-item-part    { font-size: 10px; color: #7f1d1d; font-family: monospace; }
        .receipt-item-serial  { font-size: 9px; color: #555; font-family: monospace; }
        .receipt-item-hsn     { font-size: 9px; color: #888; }
        .receipt-unit         { font-size: 9px; color: #888; }
        .receipt-tax-amt      { font-size: 9px; color: #888; }
        .receipt-item-total   { font-weight: 700; font-size: 12px !important; }
        /* Totals */
        .receipt-totals-section {
          padding: 8px 14px;
          border-bottom: 1px dashed #ccc;
        }
        .receipt-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          padding: 2px 0;
          color: #444;
        }
        .receipt-discount-row { color: #16a34a; }
        .receipt-grand-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          font-weight: 800;
          padding: 8px 0 2px;
          margin-top: 4px;
          border-top: 2px solid #111;
          color: #7f1d1d;
        }
        /* Payments */
        .receipt-payment-section {
          padding: 8px 14px;
          border-bottom: 1px dashed #ccc;
          background: #f9fafb;
        }
        .receipt-payment-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          padding: 2px 0;
        }
        .receipt-balance-due { color: #dc2626; font-weight: 700; }
        .receipt-change      { color: #16a34a; font-weight: 700; }
        /* QR */
        .receipt-qr-section {
          text-align: center;
          padding: 14px 0 6px;
          border-bottom: 1px dashed #ccc;
        }
        .receipt-qr-label {
          font-size: 10px;
          color: #666;
          margin-top: 4px;
        }
        /* Footer */
        .receipt-footer {
          text-align: center;
          padding: 12px 14px 16px;
          font-size: 11px;
          color: #555;
          line-height: 1.7;
        }
        .receipt-footer-line {
          font-weight: 700;
          color: #7f1d1d;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .receipt-footer-note { color: #777; font-size: 10px; }
        .receipt-served-by   { margin-top: 6px; font-size: 10px; color: #555; }

        /* ── Print overrides (80mm thermal) ───── */
        @media print {
          .receipt-card {
            box-shadow: none;
            border: none;
            border-radius: 0;
            max-width: 72mm;
            font-size: 9pt;
          }
          .receipt-brand-band {
            padding: 4mm 2mm 3mm;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt-store-name { font-size: 13pt; }
          .receipt-store-sub  { font-size: 7pt; }
          .receipt-store-details { font-size: 7pt; padding: 2mm 3mm; }
          .receipt-meta-box   { padding: 2mm 3mm; }
          .receipt-inv-number { font-size: 10pt; }
          .receipt-billed-to  { padding: 2mm 3mm; background: #fff !important; }
          .receipt-items-header {
            padding: 1.5mm 3mm;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt-item-row   { padding: 2mm 3mm; }
          .receipt-item-alt   { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .receipt-item-name  { font-size: 9pt; }
          .receipt-item-variant, .receipt-item-part, .receipt-item-serial, .receipt-item-hsn { font-size: 7pt; }
          .receipt-col-rate   { flex: 0 0 52px; }
          .receipt-col-total  { flex: 0 0 52px; }
          .receipt-totals-section { padding: 2mm 3mm; }
          .receipt-grand-total-row { font-size: 13pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .receipt-payment-section { padding: 2mm 3mm; background: #fff !important; }
          .receipt-qr-section { padding: 3mm 0; }
          .receipt-footer     { padding: 3mm 3mm 4mm; font-size: 7.5pt; }
          .receipt-footer-line { font-size: 8pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .receipt-vehicle-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
