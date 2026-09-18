import type { Metadata } from 'next';
import { Sora, Public_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-public-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://h2owaterpurifier.com/'),
  title: 'H2O Water Care',
  description:
    'H2O is a Kumbakonam water filter supplier — sales, installation, AMC and repair service for all types of water filters and purifiers (RO, UV, UF and softeners). Free on-site water test, doorstep installation, genuine filters. Call +91 87548 16289.',
  keywords: [
    'water filter supplier Kumbakonam',
    'water filter sales and service Kumbakonam',
    'water purifier Kumbakonam',
    'RO service Kumbakonam',
    'water purifier repair Kumbakonam',
    'AMC water purifier Tamil Nadu',
    'RO purifier installation Kumbakonam',
    'UV UF water filter Kumbakonam',
    'Kambattu Viswanathar Street water purifier',
  ],
  alternates: {
    canonical: 'https://h2owaterpurifier.com/',
  },
  openGraph: {
    type: 'website',
    title: 'H2O Water Care — Kumbakonam',
    description:
      'Water filter supplier in Kumbakonam — sales, installation and AMC service for all types of water filters and purifiers: RO, UV, UF and softeners.',
    locale: 'en_IN',
    url: 'https://h2owaterpurifier.com/',
    siteName: 'H2O Water Care',
  },
  twitter: {
    card: 'summary',
    title: 'H2O Water Care — Kumbakonam',
    description: 'Water filter supplier in Kumbakonam — sales and service for all types of water filters and purifiers.',
  },
  other: {
    'geo.region': 'IN-TN',
    'geo.placename': 'Kumbakonam',
    'geo.position': '10.9601;79.3788',
    ICBM: '10.9601, 79.3788',
  },
};

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'H2O Water Care',
  url: 'https://h2owaterpurifier.com/',
  description:
    'Water filter supplier offering sales, installation, AMC and repair service for all types of water filters and purifiers — RO, UV, UF and softener systems — for homes in Kumbakonam, Tamil Nadu.',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Near Arignar Anna School, Kambattu Viswanathar Street, Kumbakonam',
    addressLocality: 'Kumbakonam',
    addressRegion: 'Tamil Nadu',
    postalCode: '612001',
    addressCountry: 'IN',
  },
  geo: { '@type': 'GeoCoordinates', latitude: 10.9601, longitude: 79.3788 },
  telephone: '+91-87548-16289',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '5.0',
    reviewCount: '100',
  },
  areaServed: [
    { '@type': 'City', name: 'Kumbakonam' },
    { '@type': 'City', name: 'Thanjavur' },
    { '@type': 'City', name: 'Papanasam' },
    { '@type': 'City', name: 'Thiruvidaimarudur' },
    { '@type': 'City', name: 'Swamimalai' },
    { '@type': 'City', name: 'Darasuram' },
  ],
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    opens: '08:00',
    closes: '20:00',
  },
  makesOffer: [
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Water filter sales, all types' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'RO water purifier installation' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'UV/UF water purifier installation' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Water purifier AMC and repair service' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Water softener installation' } },
  ],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Do you service every brand of water filter, or only what you sell?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Every brand. We install and sell RO, UV, UF and softener systems, but our service and AMC plans cover any water filter already in your home, whichever company fitted it.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is the water test really free?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Yes. We test your tap or borewell water's TDS and hardness on-site at no cost, before recommending any system — so you know what your water actually needs first.",
      },
    },
    {
      '@type': 'Question',
      name: 'How often does an RO filter or membrane need changing?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Sediment and carbon filters typically need changing every 6–12 months, and the RO membrane less often, depending on your water quality and usage. An AMC plan schedules this automatically so you don't have to track it.",
      },
    },
    {
      '@type': 'Question',
      name: "What's covered under your AMC (annual maintenance) plan?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Scheduled filter and cartridge changes, a performance check-up, and priority call-out if something needs attention in between visits. Ask us for a plan sized to your specific system when we visit.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which areas do you cover besides Kumbakonam town?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'We regularly serve Thanjavur, Papanasam, Thiruvidaimarudur, Swamimalai and Darasuram, alongside Kumbakonam itself. Call us to check your specific area.',
      },
    },
    {
      '@type': 'Question',
      name: 'How soon can you install a new water purifier?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Most installations in Kumbakonam are scheduled within a few days of your first call, after the free site visit and water test confirm the right system for your home.',
      },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${publicSans.variable} ${plexMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
