// Talks to the Mobilebilling backend's public, unauthenticated storefront API
// (see backend/src/website/website-public.controller.ts) — resolved server-side
// there via the siteKey already baked into this base URL, not a login/JWT.
const BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000/api/v1/public/site/h2o-water-care';

export interface WebsiteProduct {
  id: string;
  category: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  mrpPrice: string | null;
  sellingPrice: string | null;
  capacityLph: number | null;
  images: string[];
  specSheetUrl: string | null;
  isFeatured: boolean;
}

export async function fetchProducts(): Promise<WebsiteProduct[]> {
  const res = await fetch(`${BASE}/products`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export interface LeadInput {
  customerName: string;
  phone: string;
  email?: string;
  address?: string;
  message?: string;
  items: { productId: string; name: string; qty: number }[];
  source: 'WHATSAPP' | 'FORM';
}

export async function submitLead(input: LeadInput): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}
