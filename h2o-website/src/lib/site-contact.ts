// One place for the shop's contact details used across the site's React pages.
export const WHATSAPP_NUMBER = '918754816289';
export const PHONE_HREF = 'tel:+918754816289';
export const PHONE_DISPLAY = '+91 87548 16289';
export const ADDRESS = 'No. 38/1077, Bakkiyanathan Street, Thanjavur Main Road, Kumbakonam, Tamil Nadu 612001';
export const GSTIN = '33GVQPS8564A1Z2';
export const SITE_URL = 'https://h2owaterpurifier.com';

export const waLink = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
