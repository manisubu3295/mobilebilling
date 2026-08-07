'use client';

import { openDB, DBSchema } from 'idb';

interface BillingDB extends DBSchema {
  draft_invoices: {
    key: string;
    value: {
      id: string;
      storeId: string;   // owning store — IndexedDB is shared across all logins on this browser
      data: any;
      createdAt: number;
      synced: boolean;
    };
  };
}

const DB_NAME = 'mobilebilling';
const DB_VERSION = 1;

export async function getDb() {
  return openDB<BillingDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('draft_invoices')) {
        db.createObjectStore('draft_invoices', { keyPath: 'id' });
      }
    },
  });
}

export async function saveDraftInvoice(id: string, data: any, storeId: string) {
  const db = await getDb();
  await db.put('draft_invoices', { id, storeId, data, createdAt: Date.now(), synced: false });
}

// storeId is required so one store's login can never see another store's
// offline drafts — IndexedDB is scoped to the browser origin, not per login.
export async function getDraftInvoices(storeId: string) {
  const db = await getDb();
  const all = await db.getAll('draft_invoices');
  return all.filter((d) => d.storeId === storeId);
}

export async function deleteDraftInvoice(id: string) {
  const db = await getDb();
  await db.delete('draft_invoices', id);
}

export async function markDraftSynced(id: string) {
  const db = await getDb();
  const draft = await db.get('draft_invoices', id);
  if (draft) await db.put('draft_invoices', { ...draft, synced: true });
}
