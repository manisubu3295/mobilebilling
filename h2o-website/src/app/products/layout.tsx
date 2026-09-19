import type { Metadata } from 'next';

// products/page.tsx is a client component (cart/category interactivity), so
// it can't export its own `metadata` — Next.js only reads that export from
// server components. A layout for the same route segment can, and its
// metadata merges with the root layout's (title template, metadataBase,
// etc.), so this only needs to say what's different about this page.
export const metadata: Metadata = {
  title: 'Shop — RO Plants, Water Purifiers & Filters',
  description:
    'Buy RO water purifiers, commercial RO plants (100–1000 LPH), water softeners and iron removal filters from H2O Water Care, Kumbakonam. Real installed prices, spec sheets, WhatsApp or call for a firm quote.',
  keywords: [
    'buy RO water purifier Kumbakonam',
    'RO plant price Kumbakonam',
    'commercial RO plant for sale',
    '100 LPH RO plant price',
    '500 LPH RO plant price',
    '1000 LPH RO plant price',
    'water softener price Kumbakonam',
    'iron removal filter price',
    'RO purifier online Kumbakonam',
  ],
  alternates: {
    canonical: 'https://h2owaterpurifier.com/products',
  },
  openGraph: {
    title: 'Shop — RO Plants, Water Purifiers & Filters | H2O Water Care',
    description:
      'RO water purifiers, commercial RO plants (100–1000 LPH), water softeners and iron removal filters — real installed prices, spec sheets, WhatsApp or call for a quote.',
    url: 'https://h2owaterpurifier.com/products',
  },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
