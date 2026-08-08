'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';

interface BarcodeScannerModalProps {
  onDetected: (text: string) => void;
  onClose: () => void;
}

// Opens the rear camera and decodes a barcode/QR from the live feed via
// @zxing/browser — dynamically imported so its decoder tables don't add to
// every checkout page load, only to the users who actually tap the camera
// button. Closes itself on the first successful decode; the caller re-runs
// the exact same search path a hardware scanner gun or the Enter key already
// uses, so selection/add-to-cart behavior doesn't fork into a second code path.
export function BarcodeScannerModal({ onDetected, onClose }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let controls: IScannerControls | undefined;
    let detected = false; // guards against the callback firing again before controls.stop() takes effect

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const result = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current!,
          (result) => {
            if (cancelled || detected || !result) return;
            detected = true;
            controls?.stop();
            onDetected(result.getText());
          },
        );
        if (cancelled) {
          result.stop();
          return;
        }
        controls = result;
      } catch (err: any) {
        if (cancelled) return;
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access in your browser settings and try again.'
            : err?.name === 'NotFoundError'
              ? 'No camera found on this device.'
              : 'Could not start the camera. Try entering the code manually.',
        );
      }
    })();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <p className="font-medium text-sm">Scan barcode or QR</p>
        <button onClick={onClose} className="p-2 -mr-2 text-gray-300 hover:text-white">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />

        {!error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-40 border-2 border-red-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/90">
            <div className="text-center text-white space-y-3 max-w-xs">
              <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
              <p className="text-sm">{error}</p>
              <button onClick={onClose} className="px-4 py-2 bg-red-700 rounded-lg text-sm font-medium hover:bg-red-800">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
