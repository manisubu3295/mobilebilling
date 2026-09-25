'use client';

import React, { useRef, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { usePrintStore } from '@/store/print.store';

interface NativePrintPlugin {
  print: (opts: { html: string; name: string }) => Promise<void>;
}

// Present only inside the Android app shell (mobile-app/), where
// window.print() is a no-op in the WebView — MainActivity registers a
// NativePrint plugin that hands the HTML to Android's PrintManager instead.
function getNativePrint(): NativePrintPlugin | null {
  const cap = (window as any).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return (cap.Plugins?.NativePrint as NativePrintPlugin) || null;
}

export function PrintPreviewHost() {
  const { variants, active, setActive, title, close } = usePrintStore();
  const html = variants[active]?.html ?? null;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);

  if (!html) return null;

  const handlePrint = async () => {
    setError(null);
    const native = getNativePrint();
    if (native) {
      try {
        await native.print({ html: html!, name: title });
      } catch {
        setError('Printing failed. Please update the app and try again.');
      }
      return;
    }
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      setError('Printing needs the latest version of the app. Please update it.');
      return;
    }
    frameRef.current?.contentWindow?.focus();
    frameRef.current?.contentWindow?.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gray-100 no-print">
      <div className="flex items-center gap-2 border-b bg-white px-3 py-2 shadow-sm">
        <button
          onClick={() => { setError(null); close(); }}
          className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <X className="h-4 w-4" /> Close
        </button>
        <div className="flex-1 truncate text-center text-sm font-semibold text-gray-800">{title}</div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1 rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>
      {variants.length > 1 && (
        <div className="flex justify-center gap-1 border-b bg-white px-3 py-2">
          {variants.map((v, i) => (
            <button
              key={v.label}
              onClick={() => setActive(i)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                i === active ? 'bg-red-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      {error && <div className="bg-red-50 px-3 py-2 text-center text-sm text-red-700">{error}</div>}
      <iframe
        ref={frameRef}
        title={title}
        srcDoc={html}
        className="w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
