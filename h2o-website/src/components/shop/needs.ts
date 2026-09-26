import type { WebsiteProduct } from '@/lib/site-api';

// Shopping by "how much water do you need" — the choice customers actually
// make. Each need is a capacity band in litres per hour (LPH); `level` is how
// full the tile's water line is drawn.
export interface Need { key: string; label: string; range: string; min: number; max: number; level: number }

export const NEEDS: Need[] = [
  { key: 'home', label: 'Home kitchen', range: 'Up to 25 litres an hour', min: 0, max: 25, level: 28 },
  { key: 'shop', label: 'Shop or clinic', range: '26 to 150 litres an hour', min: 26, max: 150, level: 36 },
  { key: 'hotel', label: 'Hotel or school', range: '151 to 500 litres an hour', min: 151, max: 500, level: 44 },
  { key: 'factory', label: 'Factory or water plant', range: 'Over 500 litres an hour', min: 501, max: Infinity, level: 52 },
];

export const fitsNeed = (p: WebsiteProduct, need: Need) =>
  p.capacityLph != null && p.capacityLph >= need.min && p.capacityLph <= need.max;
