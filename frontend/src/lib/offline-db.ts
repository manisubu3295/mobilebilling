'use client';

import { openDB, DBSchema } from 'idb';

interface BillingDB extends DBSchema {
  draft_invoices: {
    key: string;
    value: {
      id: string;
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

export async function saveDraftInvoice(id: string, data: any) {
  const db = await getDb();
  await db.put('draft_invoices', { id, data, createdAt: Date.now(), synced: false });
}

export async function getDraftInvoices() {
  const db = await getDb();
  return db.getAll('draft_invoices');
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
