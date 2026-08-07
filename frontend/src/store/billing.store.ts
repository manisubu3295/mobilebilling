import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { unitAllowsDecimal } from '@/lib/units';

export interface CartItem {
  skuId: string;
  productName: string;
  variantName: string;
  partNumber?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  isSerialized: boolean;
  serialIds: string[];        // empty for bulk parts
  serialNumber?: string;      // display only — for serialized parts
  hsnCode?: string;
  stockQty?: number;          // available stock at time of scan (bulk items only) — caps in-cart quantity edits
}

export interface PaymentEntry {
  mode: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'BANK_TRANSFER' | 'EMI';
  amount: number;
  reference?: string;
}

interface BillingState {
  items: CartItem[];
  payments: PaymentEntry[];
  customerId: string | null;
  discountType: 'PERCENT' | 'FLAT' | null;
  discountValue: number;
  notes: string;
  storeId: string | null;    // which store this persisted cart belongs to — see resetForStore

  addItem: (item: CartItem) => void;
  removeItem: (skuId: string) => void;
  updateQuantity: (skuId: string, qty: number) => void;
  addPayment: (payment: PaymentEntry) => void;
  removePayment: (index: number) => void;
  setCustomer: (id: string | null) => void;
  setDiscount: (type: 'PERCENT' | 'FLAT' | null, value: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
  resetForStore: (storeId: string) => void;

  // Computed
  subtotal: () => number;
  taxTotal: () => number;
  discountAmount: () => number;
  total: () => number;
  paidAmount: () => number;
  balance: () => number;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      items: [],
      payments: [],
      customerId: null,
      discountType: null,
      discountValue: 0,
      notes: '',
      storeId: null,

      addItem: (item) =>
        set((s) => {
          if (item.isSerialized) {
            const sameSku = s.items.find((i) => i.skuId === item.skuId && i.isSerialized);
            if (sameSku && item.serialIds.length > 0) {
              return {
                items: s.items.map((i) =>
                  i.skuId === item.skuId && i.isSerialized
                    ? { ...i, quantity: i.quantity + 1, serialIds: [...i.serialIds, ...item.serialIds] }
                    : i,
                ),
              };
            }
            return { items: [...s.items, item] };
          }

          const existing = s.items.find((i) => i.skuId === item.skuId && !i.isSerialized);
          if (existing) {
            // Re-scanning a SKU already in the cart — cap the merged total at
            // available stock (use the freshest stockQty from this scan, since
            // it reflects current inventory more accurately than the stale value).
            // `cap` stays undefined (not Infinity) when neither side knows a
            // stock figure — Infinity would serialize to `null` via the
            // persisted store and permanently disable that item's + button.
            const cap = item.stockQty ?? existing.stockQty;
            return {
              items: s.items.map((i) => {
                if (i.skuId !== item.skuId || i.isSerialized) return i;
                let merged = cap !== undefined ? Math.min(i.quantity + item.quantity, cap) : i.quantity + item.quantity;
                if (!unitAllowsDecimal(i.unit)) merged = Math.round(merged);
                return { ...i, quantity: merged, stockQty: cap };
              }),
            };
          }
          return { items: [...s.items, item] };
        }),

      removeItem: (skuId) =>
        set((s) => ({ items: s.items.filter((i) => i.skuId !== skuId) })),

      updateQuantity: (skuId, qty) =>
        set((s) => ({
          items: qty <= 0
            ? s.items.filter((i) => i.skuId !== skuId)
            : s.items.map((i) => {
                if (i.skuId !== skuId) return i;
                // Cap at available stock — validated immediately on every
                // quantity change, independent of cart/payment state, so the
                // cart can never sit above stock ahead of the final checkout call.
                const cap = i.isSerialized ? i.serialIds.length : i.stockQty ?? Infinity;
                let next = Math.min(qty, cap);
                // Only KG/LITER/METER-style units may be fractional — everything
                // else (PCS, SET, PAIR, and serialized items) stays a whole number
                // regardless of what the caller passed in.
                if (i.isSerialized || !unitAllowsDecimal(i.unit)) next = Math.round(next);
                return { ...i, quantity: next };
              }),
        })),

      addPayment: (payment) => set((s) => ({ payments: [...s.payments, payment] })),
      removePayment: (index) =>
        set((s) => ({ payments: s.payments.filter((_, i) => i !== index) })),

      setCustomer: (id) => set({ customerId: id }),
      setDiscount: (type, value) => set({ discountType: type, discountValue: value }),
      setNotes: (notes) => set({ notes }),
      clearCart: () =>
        set({ items: [], payments: [], customerId: null, discountType: null, discountValue: 0, notes: '' }),

      // Persisted cart is keyed by a single fixed localStorage entry, so on a
      // shared browser it survives a logout/login as a different store's
      // account unless we reconcile it against who's actually signed in now.
      // Called from the dashboard layout on every mount/session change.
      resetForStore: (storeId) =>
        set((s) =>
          s.storeId === storeId
            ? {} // same tenant continuing their session (e.g. page refresh) — keep the cart
            : { storeId, items: [], payments: [], customerId: null, discountType: null, discountValue: 0, notes: '' },
        ),

      subtotal: () => get().items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
      taxTotal: () =>
        get().items.reduce((s, i) => s + (i.unitPrice * i.quantity * i.taxRate) / 100, 0),
      discountAmount: () => {
        const { discountType, discountValue, subtotal } = get();
        if (discountType === 'PERCENT') return (subtotal() * discountValue) / 100;
        if (discountType === 'FLAT') return discountValue;
        return 0;
      },
      total: () => get().subtotal() + get().taxTotal() - get().discountAmount(),
      paidAmount: () => get().payments.reduce((s, p) => s + p.amount, 0),
      balance: () => get().total() - get().paidAmount(),
    }),
    {
      name: 'billing-cart',
      partialize: (s) => ({
        items: s.items,
        payments: s.payments,
        customerId: s.customerId,
        discountType: s.discountType,
        discountValue: s.discountValue,
        notes: s.notes,
        storeId: s.storeId,
      }),
    },
  ),
);
