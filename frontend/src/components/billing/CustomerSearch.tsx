'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import api from '@/lib/api';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  customFields?: Record<string, any>;
}

interface CustomerSearchProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CustomerSearch({ selectedId, onSelect }: CustomerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });

  const selectedRef = useRef<Customer | null>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Keep the selected-customer chip in sync with the store's customerId —
  // covers page reload / persisted cart where this component remounts
  // with no local `selected` state even though a customer was already chosen.
  useEffect(() => {
    if (!selectedId) {
      if (selectedRef.current) setSelected(null);
      return;
    }
    if (selectedRef.current?.id === selectedId) return;

    let cancelled = false;
    api.get(`/customers/${selectedId}`)
      .then(({ data }) => { if (!cancelled) setSelected(data); })
      .catch(() => { if (!cancelled) onSelect(null); }); // stale/invalid id — drop it
    return () => { cancelled = true; };
  }, [selectedId, onSelect]);

  const searchIdRef = useRef(0);

  const handleSearch = useCallback(async (val: string) => {
    const requestId = ++searchIdRef.current;
    setLoading(true);
    try {
      const { data } = await api.get('/customers', { params: { search: val } });
      if (requestId === searchIdRef.current) setResults(data || []);
    } catch {
      if (requestId === searchIdRef.current) setResults([]);
    } finally {
      if (requestId === searchIdRef.current) setLoading(false);
    }
  }, []);

  // Debounce so we don't fire a request per keystroke — avoids hammering the
  // API (and tripping its rate limit) and out-of-order responses clobbering
  // the results for whatever was most recently typed.
  useEffect(() => {
    if (query.trim().length < 3) {
      searchIdRef.current++; // invalidate any in-flight request
      setResults([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => handleSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const handleSelect = (customer: Customer) => {
    setSelected(customer);
    onSelect(customer.id);
    setQuery('');
    setResults([]);
  };

  const handleClear = () => {
    setSelected(null);
    onSelect(null);
  };

  const handleCreate = async () => {
    if (!newCustomer.name || !newCustomer.phone) return;
    try {
      // Email is optional — send undefined rather than '' when left blank so
      // the backend's format validation doesn't run against an empty string.
      const { data } = await api.post('/customers', {
        ...newCustomer,
        email: newCustomer.email.trim() || undefined,
      });
      handleSelect(data);
      setShowCreate(false);
      setNewCustomer({ name: '', phone: '', email: '' });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create customer');
    }
  };

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-red-900">{selected.name}</p>
          <p className="text-xs text-red-600">
            {selected.phone}
            {selected.customFields?.vehicle_no && ` · ${selected.customFields.vehicle_no}`}
            {selected.customFields?.re_model && ` · ${selected.customFields.re_model}`}
          </p>
        </div>
        <button onClick={handleClear} className="text-red-400 hover:text-red-700">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer by name or phone..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1 text-gray-600"
        >
          <UserPlus className="h-4 w-4" /> New
        </button>
      </div>

      {query.trim().length >= 3 && (loading || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-auto">
          {loading && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">Searching…</p>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between text-sm"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-gray-500">{c.phone}</span>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="font-semibold text-lg">New Customer</h3>
            <input
              placeholder="Full Name *"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <input
              placeholder="Phone Number *"
              value={newCustomer.phone}
              onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <input
              placeholder="Email (optional)"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800"
              >
                Create & Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
