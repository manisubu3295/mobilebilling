import { create } from 'zustand';

// Holds the document currently shown in the in-app print preview. Printing
// used to open a popup window, which inside the Android (Capacitor) app
// replaced the app's only WebView and left the user stuck on the printout —
// so every printable document now renders in an overlay on the same page.
// A document can come in several layouts (A4 bill / 80mm thermal slip); the
// preview shows a switch between them.
export interface PrintVariant {
  label: string;
  html: string;
}

interface PrintState {
  variants: PrintVariant[];
  active: number;
  title: string;
  open: (variants: PrintVariant[], title: string) => void;
  setActive: (i: number) => void;
  close: () => void;
}

export const usePrintStore = create<PrintState>((set) => ({
  variants: [],
  active: 0,
  title: '',
  open: (variants, title) => set({ variants, active: 0, title }),
  setActive: (active) => set({ active }),
  close: () => set({ variants: [], active: 0, title: '' }),
}));

export function openPrintPreview(html: string | PrintVariant[], title: string): void {
  const variants = typeof html === 'string' ? [{ label: 'Print', html }] : html;
  usePrintStore.getState().open(variants, title);
}
