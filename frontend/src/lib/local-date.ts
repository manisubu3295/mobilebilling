// YYYY-MM-DD in the browser's own timezone. `toISOString().slice(0, 10)` gives
// the UTC date, which in India is still "yesterday" until 5:30 AM — so date
// filters defaulted to the wrong day and hid that morning's bills.
export function localDateString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
