'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  category: string;
  sellingPrice: number | null;
  image: string | null;
  qty: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  add: (item: Omit<CartItem, 'qty'>) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      add: (item) => {
        const existing = get().items.find((i) => i.productId === item.productId);
        if (existing) {
          set({
            items: get().items.map((i) => (i.productId === item.productId ? { ...i, qty: i.qty + 1 } : i)),
          });
        } else {
          set({ items: [...get().items, { ...item, qty: 1 }] });
        }
        set({ isOpen: true });
      },

      remove: (productId) => set({ items: get().items.filter((i) => i.productId !== productId) }),

      setQty: (productId, qty) => {
        if (qty <= 0) return get().remove(productId);
        set({ items: get().items.map((i) => (i.productId === productId ? { ...i, qty } : i)) });
      },

      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    { name: 'h2o-cart', partialize: (s) => ({ items: s.items }) },
  ),
);
