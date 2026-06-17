import { Injectable } from '@nestjs/common';

@Injectable()
export class QrService {
  /**
   * Generates a UPI deep-link payload for dynamic QR.
   * Format: upi://pay?pa=<VPA>&pn=<NAME>&am=<AMOUNT>&tr=<TXN_ID>&tn=<NOTE>&cu=INR
   */
  generateUpiPayload(params: {
    vpa: string;
    merchantName: string;
    amount: string;
    transactionId: string;
    note?: string;
  }): string {
    const url = new URL('upi://pay');
    url.searchParams.set('pa', params.vpa);
    url.searchParams.set('pn', params.merchantName);
    url.searchParams.set('am', params.amount);
    url.searchParams.set('tr', params.transactionId);
    url.searchParams.set('tn', params.note || 'Invoice Payment');
    url.searchParams.set('cu', 'INR');
    return url.toString();
  }

  /**
   * Returns UPI payload for a given invoice. The QR image is rendered on the
   * frontend using the `qrcode` npm package (no server-side image generation needed).
   */
  getInvoiceQrPayload(invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: string;
    store: { gstNumber?: string | null; name: string };
  }, vpa: string): string {
    return this.generateUpiPayload({
      vpa,
      merchantName: invoice.store.name,
      amount: invoice.totalAmount,
      transactionId: invoice.invoiceNumber,
      note: `Payment for ${invoice.invoiceNumber}`,
    });
  }
}
