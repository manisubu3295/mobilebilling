import type { Metadata } from 'next';
import { fetchProduct } from '@/lib/site-api';

// The detail page itself is a client component (gallery, cart), so its
// title / description / canonical URL come from this server layout.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await fetchProduct(params.id);
  if (!product) return { title: 'Product not found' };
  const description =
    product.shortDescription ||
    product.description?.slice(0, 160) ||
    `${product.name} from H2O Water Care, Kumbakonam — call or WhatsApp for a quote.`;
  const url = `https://h2owaterpurifier.com/products/${product.id}`;
  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${product.name} | H2O Water Care`,
      description,
      url,
      ...(product.images?.[0]?.startsWith('http') ? { images: [product.images[0]] } : {}),
    },
  };
}

export default function ProductDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
