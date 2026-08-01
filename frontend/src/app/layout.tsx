import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aadhirai Billing — Billing & Inventory',
  description: 'Billing and inventory management for any retail business',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
