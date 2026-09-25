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

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; padding: 8mm; font-size: 10.5pt; }
  @page { size: A5; margin: 6mm; }
  @media print { body { padding: 0; } }
  .card { max-width: 148mm; margin: 0 auto; }
  .blue { color: #1d4ed8; }
  .top { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
  .shop h1 { font-size: 18pt; color: #1e3a8a; }
  .shop div { font-size: 8.5pt; line-height: 1.3; }
  .logo img { max-height: 22mm; max-width: 30mm; object-fit: contain; }
  .rec { border: 1.5px solid #1d4ed8; min-width: 42mm; text-align: center; }
  .rec .t { background: #1d4ed8; color: #fff; font-weight: 800; padding: 3px 6px; font-size: 12pt; }
  .rec .l { color: #1d4ed8; font-size: 9pt; padding-top: 2px; }
  .rec .v { font-size: 15pt; font-weight: 800; color: #b91c1c; padding: 2px 0 4px; min-height: 22px; }
  .band { background: #1d4ed8; color: #fff; font-weight: 700; padding: 2px 6px; margin-top: 6px; font-size: 9.5pt; display: inline-block; min-width: 60%; }
  .grid2 { display: flex; gap: 10px; }
  .grid2 > div { flex: 1; }
  .f { display: flex; gap: 4px; margin-top: 5px; align-items: flex-end; }
  .f span.k { white-space: nowrap; font-size: 9.5pt; }
  .f span.v { flex: 1; border-bottom: 1px dotted #555; min-height: 15px; color: #b91c1c; font-weight: 600; padding-left: 3px; }
  .test { border: 1.5px solid #1d4ed8; padding: 4px 6px; }
  .periods { display: flex; gap: 8px; margin-top: 8px; }
  .period { flex: 1; display: flex; border: 1.5px solid #1d4ed8; }
  .period .h { background: #1d4ed8; color: #fff; font-weight: 800; display: flex; align-items: center; padding: 0 6px; font-size: 10pt; }
  .period .rows { flex: 1; }
  .period .rows div { display: flex; border-bottom: 1px solid #1d4ed8; padding: 2px 4px; font-size: 9.5pt; }
  .period .rows div:last-child { border-bottom: none; }
  .period .rows b { width: 44px; font-weight: 600; }
  .period .rows span { color: #b91c1c; font-weight: 600; }
  .terms { margin-top: 8px; font-size: 8.5pt; line-height: 1.45; white-space: pre-line; }
  .terms .h { font-weight: 700; font-size: 9.5pt; }
  .sign { display: flex; justify-content: space-between; margin-top: 18px; font-size: 9.5pt; }
  .foot { margin-top: 8px; border-top: 1.5px solid #1d4ed8; padding-top: 4px; text-align: center; font-size: 9pt; }
  .care { background: #1d4ed8; color: #fff; font-weight: 800; text-align: center; padding: 4px; margin-top: 4px; font-size: 11pt; }
`;

export function buildWarrantyCardHtml(c: WarrantyCardData): string {
  const f = (k: string, v?: string | null) => `<div class="f"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`;
  const warrantyTo = warrantyEndDate(c.startDate, c.warrantyPeriodMonths);
  const terms = c.store.warrantyCardTerms?.trim();

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Warranty Card ${esc(c.customer.cardNo)}</title>
<style>${CSS}</style>
</head><body><div class="card">
  <div class="top">
    <div class="shop">
      <h1>${esc(c.store.name)}</h1>
      ${c.store.address ? `<div>${esc(c.store.address).replace(/\n/g, '<br>')}</div>` : ''}
    </div>
    ${c.store.logoUrl ? `<div class="logo"><img src="${esc(c.store.logoUrl)}" alt="" /></div>` : ''}
    <div class="rec">
      <div class="t">Service Record</div>
      <div class="l">Customer ID</div>
      <div class="v">${esc(c.customer.cardNo)}</div>
    </div>
  </div>

  <div class="band">CUSTOMER DETAILS</div>
  <div class="grid2">
    <div>
      ${f('Name', c.customer.name)}
      ${f('Address', c.customer.address)}
      ${f('City', c.customer.city)}
      ${f('Land Mark', c.customer.landmark)}
      ${f('Contact No.', c.customer.phone)}
    </div>
    <div style="flex:0 0 42%">
      ${f('Date:', d(c.cardDate || c.startDate))}
      <div class="test" style="margin-top:5px">
        ${f('TDS', c.tds)}
        ${f('Hardness', c.hardness)}
        ${f('Iron', c.iron)}
        ${f('Other impurities', c.otherImpurities)}
      </div>
    </div>
  </div>

  <div class="band">PRODUCT DETAILS</div>
  <div class="grid2">
    <div>
      ${f('Brand', c.brand || c.product.brand)}
      ${f('Pump', c.pump)}
      ${f('Vessel', c.vessel)}
      ${f('Sold by', c.soldBy || c.store.name)}
    </div>
    <div>
      ${f('Model', c.model || c.product.name)}
      <div class="grid2">
        <div>${f('Membrane', c.membrane)}</div>
        <div>${f('Power', c.power)}</div>
      </div>
      <div class="grid2">
        <div>${f('Valve', c.valve)}</div>
        <div>${f('Media', c.media)}</div>
      </div>
      ${f('Installed by', c.installedBy)}
    </div>
  </div>

  <div class="periods">
    <div class="period"><div class="h">WARRANTY</div><div class="rows">
      <div><b>From</b><span>${d(c.startDate)}</span></div>
      <div><b>To</b><span>${d(warrantyTo)}</span></div>
    </div></div>
    <div class="period"><div class="h">AMC</div><div class="rows">
      <div><b>From</b><span>${d(c.amcFrom)}</span></div>
      <div><b>To</b><span>${d(c.amcTo)}</span></div>
    </div></div>
  </div>

  ${terms ? `<div class="terms"><div class="h">வாடிக்கையாளர் கவனத்திற்கு:</div>${esc(terms)}</div>` : ''}

  <div class="sign">
    <span>வாடிக்கையாளர் கையொப்பம்</span>
    <span>For ${esc(c.store.name)}</span>
  </div>

  ${c.store.address ? `<div class="foot">&#9733; ${esc(c.store.address.split('\n').join(', ').replace(/,\s*,/g, ','))}</div>` : ''}
  ${c.store.phone ? `<div class="care">CUSTOMER CARE : ${esc(c.store.phone)}</div>` : ''}
</div></body></html>`;
}
