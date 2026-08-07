// Units where the quantity may be fractional (sold by weight/volume/length) vs.
// units that are always counted in whole numbers. Keep this in sync with
// backend/src/common/units.ts — the six options come from the fixed UNITS list
// in frontend/src/app/(dashboard)/inventory/page.tsx.
const DECIMAL_UNITS = new Set(['KG', 'LITER', 'METER']);

export function unitAllowsDecimal(unit: string): boolean {
  return DECIMAL_UNITS.has((unit || '').toUpperCase());
}
