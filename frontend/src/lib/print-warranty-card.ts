// Printable warranty card / service record — same layout as the client's
// paper card (see h2o-requirement/warrenty card.jpeg): customer + water test,
// product details, warranty & AMC periods, terms, signatures.

export interface WarrantyCardData {
  startDate: string;
  warrantyPeriodMonths?: number | null;
  cardDate?: string | null;
  tds?: string | null;
  hardness?: string | null;
  iron?: string | null;
  otherImpurities?: string | null;
  brand?: string | null;
  model?: string | null;
  pump?: string | null;
  membrane?: string | null;
  power?: string | null;
  vessel?: string | null;
  valve?: string | null;
  media?: string | null;
  soldBy?: string | null;
  installedBy?: string | null;
  amcFrom?: string | null;
  amcTo?: string | null;
  product: { name: string; brand?: string | null };
  customer: {
    name: string; phone: string; address?: string | null; city?: string | null;
    landmark?: string | null; cardNo?: string | null;
  };
  store: {
    name: string; address?: string | null; phone?: string | null; logoUrl?: string | null;
    warrantyCardTerms?: string | null;
  };
}

function esc(s?: string | null): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function d(v?: string | null): string {
  return v ? new Date(v).toLocaleDateString('en-GB') : '';
}

export function warrantyEndDate(startDate: string, months?: number | null): string | null {
  if (!months) return null;
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + months);
  end.setDate(end.getDate() - 1);
  return end.toISOString();
}

// Print-safe: colour from text and borders; the logo comes from Settings.
const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Roboto, Arial, Helvetica, sans-serif; color: #1f2937; background: #fff; padding: 8mm; font-size: 10pt; }
  @page { size: A5; margin: 7mm; }
  @media print { body { padding: 0; } }
  .card { max-width: 136mm; margin: 0 auto; border: 1.5px solid #1d4ed8; border-radius: 10px; overflow: hidden; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-bottom: 3px solid #1d4ed8; }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .brand img { max-height: 18mm; max-width: 26mm; object-fit: contain; }
  .shop-name { font-size: 15pt; font-weight: 800; color: #1e3a8a; line-height: 1.1; }
  .shop-line { font-size: 8pt; color: #4b5563; line-height: 1.4; }
  .badge { text-align: center; border: 1.5px solid #1d4ed8; border-radius: 8px; padding: 4px 10px; flex-shrink: 0; }
  .badge .t { font-size: 7.5pt; font-weight: 800; letter-spacing: 1.2px; color: #1d4ed8; text-transform: uppercase; }
  .badge .l { font-size: 7pt; color: #6b7280; }
  .badge .v { font-size: 18pt; font-weight: 800; color: #b91c1c; line-height: 1.1; min-height: 20px; }
  .body { padding: 10px 12px; }
  .sec { margin-bottom: 9px; }
  .sec-title { font-size: 7.5pt; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #1d4ed8; border-bottom: 1px solid #dbeafe; padding-bottom: 2px; margin-bottom: 5px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3px 14px; }
  .grid.three { grid-template-columns: repeat(3, 1fr); }
  .f { display: flex; flex-direction: column; min-width: 0; }
  .f .k { font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
  .f .v { font-size: 9.5pt; font-weight: 600; color: #111827; border-bottom: 1px dotted #cbd5e1; min-height: 15px; padding-bottom: 1px; word-break: break-word; }
  .f.wide { grid-column: 1 / -1; }
  .periods { display: flex; gap: 8px; }
  .period { flex: 1; border: 1px solid #bfdbfe; border-radius: 8px; padding: 6px 8px; }
  .period .h { font-size: 7.5pt; font-weight: 800; letter-spacing: 1px; color: #1d4ed8; }
  .period .d { font-size: 9.5pt; font-weight: 600; color: #111827; }
  .terms { font-size: 8pt; line-height: 1.5; color: #374151; white-space: pre-line; background: #f8fafc; border-radius: 6px; padding: 6px 8px; }
  .terms .h { font-weight: 700; color: #111827; margin-bottom: 2px; }
  .sign { display: flex; justify-content: space-between; margin-top: 16px; }
  .sign div { width: 45%; border-top: 1px solid #9ca3af; padding-top: 3px; font-size: 8pt; color: #4b5563; text-align: center; }
  .care { border-top: 1.5px solid #1d4ed8; text-align: center; padding: 6px; font-size: 9.5pt; font-weight: 800; color: #1d4ed8; letter-spacing: 0.3px; }
`;

export function buildWarrantyCardHtml(c: WarrantyCardData): string {
  const f = (k: string, v?: string | null, cls = '') =>
    `<div class="f ${cls}"><span class="k">${k}</span><span class="v">${esc(v) || '&nbsp;'}</span></div>`;
  const warrantyTo = warrantyEndDate(c.startDate, c.warrantyPeriodMonths);
  const terms = c.store.warrantyCardTerms?.trim();
  const address = [c.customer.address, c.customer.city].filter(Boolean).join(', ');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Warranty Card ${esc(c.customer.cardNo)}</title>
<style>${CSS}</style>
</head><body><div class="card">
  <div class="head">
    <div class="brand">
      ${c.store.logoUrl ? `<img src="${esc(c.store.logoUrl)}" alt="" />` : ''}
      <div>
        <div class="shop-name">${esc(c.store.name)}</div>
        ${c.store.address ? `<div class="shop-line">${esc(c.store.address).replace(/\n/g, '<br>')}</div>` : ''}
      </div>
    </div>
    <div class="badge">
      <div class="t">Service Record</div>
      <div class="l">Customer ID</div>
      <div class="v">${esc(c.customer.cardNo)}</div>
    </div>
  </div>

  <div class="body">
    <div class="sec">
      <div class="sec-title">Customer</div>
      <div class="grid">
        ${f('Name', c.customer.name)}
        ${f('Date', d(c.cardDate || c.startDate))}
        ${f('Address', address, 'wide')}
        ${f('Land mark', c.customer.landmark)}
        ${f('Contact no.', c.customer.phone)}
      </div>
    </div>

    <div class="sec">
      <div class="sec-title">Water test</div>
      <div class="grid three">
        ${f('TDS', c.tds)}
        ${f('Hardness', c.hardness)}
        ${f('Iron', c.iron)}
        ${f('Other impurities', c.otherImpurities, 'wide')}
      </div>
    </div>

    <div class="sec">
      <div class="sec-title">Product</div>
      <div class="grid three">
        ${f('Brand', c.brand || c.product.brand)}
        ${f('Model', c.model || c.product.name)}
        ${f('Pump', c.pump)}
        ${f('Membrane', c.membrane)}
        ${f('Power', c.power)}
        ${f('Vessel', c.vessel)}
        ${f('Valve', c.valve)}
        ${f('Media', c.media)}
        ${f('Sold by', c.soldBy || c.store.name)}
        ${f('Installed by', c.installedBy)}
      </div>
    </div>

    <div class="sec periods">
      <div class="period"><div class="h">WARRANTY</div><div class="d">${d(c.startDate)} &rarr; ${d(warrantyTo) || '—'}</div></div>
      <div class="period"><div class="h">AMC</div><div class="d">${c.amcFrom ? `${d(c.amcFrom)} &rarr; ${d(c.amcTo) || '—'}` : '&nbsp;'}</div></div>
    </div>

    ${terms ? `<div class="terms"><div class="h">வாடிக்கையாளர் கவனத்திற்கு</div>${esc(terms)}</div>` : ''}

    <div class="sign">
      <div>வாடிக்கையாளர் கையொப்பம் / Customer</div>
      <div>For ${esc(c.store.name)}</div>
    </div>
  </div>
  ${c.store.phone ? `<div class="care">CUSTOMER CARE : ${esc(c.store.phone)}</div>` : ''}
</div></body></html>`;
}
