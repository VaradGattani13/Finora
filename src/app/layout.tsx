import type { Metadata, Viewport } from 'next';
import './globals.css';
import ThemeProvider, { THEME_BOOTSTRAP } from '@/components/ThemeProvider';
import ServiceWorker from '@/components/ServiceWorker';
import CurrencyProvider from '@/components/CurrencyProvider';
import SiteFooter from '@/components/SiteFooter';
import { CURRENCY_BOOTSTRAP } from '@/lib/currency';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s — ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: { title: BRAND.name, description: BRAND.description, type: 'website' },
};

export const viewport: Viewport = {
  // viewportFit lets the standalone PWA paint under the notch, and the two
  // theme colours keep the phone chrome matched to whichever theme is active.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The bootstrap script mutates data-theme before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <script dangerouslySetInnerHTML={{ __html: CURRENCY_BOOTSTRAP }} />
      </head>
      <body>
        <ThemeProvider>
          <CurrencyProvider>{children}</CurrencyProvider>
        </ThemeProvider>
        <SiteFooter />
        <ServiceWorker />
      </body>
    </html>
  );
}
