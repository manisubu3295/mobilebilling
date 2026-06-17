'use client';

import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface PaymentQrProps {
  invoiceId: string;
  totalAmount: string | number;
}

export function PaymentQr({ invoiceId, totalAmount }: PaymentQrProps) {
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  // Use static QR if available and dynamic fails
  const staticQr = user?.store?.staticQrUrl;

  useEffect(() => {
    api
      .get(`/qr/invoice/${invoiceId}`)
      .then(({ data }) => setQrPayload(data.payload))
      .catch(() => setQrPayload(null))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const activePayload = qrPayload || staticQr;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 bg-gray-50 rounded-xl border">
        <p className="text-sm text-gray-500">Loading QR...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border p-4 flex flex-col items-center gap-3">
      <h3 className="font-semibold text-gray-900">Scan to Pay</h3>
      {activePayload ? (
        <>
          <div className="p-3 bg-white border-2 border-gray-100 rounded-xl">
            {qrPayload ? (
              <QRCodeSVG
                value={activePayload}
                size={180}
                level="H"
                includeMargin={false}
              />
            ) : (
              // Static QR from admin upload
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activePayload} alt="Payment QR" className="w-44 h-44 object-contain" />
            )}
          </div>
          <p className="text-2xl font-bold text-red-700">₹{parseFloat(String(totalAmount)).toFixed(2)}</p>
          {!qrPayload && staticQr && (
            <p className="text-xs text-amber-600 text-center">
              Using static QR (dynamic UPI not configured)
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500 text-center">
          No QR configured. Ask admin to set up UPI or static QR.
        </p>
      )}
    </div>
  );
}
