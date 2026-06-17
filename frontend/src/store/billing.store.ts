import { create } from 'zustand';

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

  addItem: (item: CartItem) => void;
  removeItem: (skuId: string) => void;
  updateQuantity: (skuId: string, qty: number) => void;
  addPayment: (payment: PaymentEntry) => void;
  removePayment: (index: number) => void;
  setCustomer: (id: string | null) => void;
  setDiscount: (type: 'PERCENT' | 'FLAT' | null, value: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;

  // Computed
  subtotal: () => number;
  taxTotal: () => number;
  discountAmount: () => number;
  total: () => number;
  paidAmount: () => number;
  balance: () => number;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  items: [],
  payments: [],
  customerId: null,
  discountType: null,
  discountValue: 0,
  notes: '',

  addItem: (item) =>
    set((s) => {
      // Serialized parts: each unit is a separate line (different serialId)
      if (item.isSerialized) {
        const sameSku = s.items.find((i) => i.skuId === item.skuId && i.isSerialized);
        if (sameSku && item.serialIds.length > 0) {
          // Merge serial IDs onto the same line, increment qty
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

      // Bulk parts: merge by skuId, accumulate quantity
      const existing = s.items.find((i) => i.skuId === item.skuId && !i.isSerialized);
      if (existing) {
        return {
          items: s.items.map((i) =>
            i.skuId === item.skuId && !i.isSerialized
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          ),
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
        : s.items.map((i) => (i.skuId === skuId ? { ...i, quantity: qty } : i)),
    })),

  addPayment: (payment) => set((s) => ({ payments: [...s.payments, payment] })),
  removePayment: (index) =>
    set((s) => ({ payments: s.payments.filter((_, i) => i !== index) })),

  setCustomer: (id) => set({ customerId: id }),
  setDiscount: (type, value) => set({ discountType: type, discountValue: value }),
  setNotes: (notes) => set({ notes }),
  clearCart: () =>
    set({ items: [], payments: [], customerId: null, discountType: null, discountValue: 0, notes: '' }),

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
}));
