import type { Metadata } from 'next';

import { PrototypeProviders } from '@/components/prototype/providers';
import { messages } from '@/lib/i18n/messages';
import { defaultPresentation } from '@/lib/i18n/presentation';
// Self-hosted fonts (no third-party font CDN: GDPR).
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource-variable/bricolage-grotesque/index.css';
import './globals.css';

export const metadata: Metadata = {
  title: messages.meta.title,
  description: messages.meta.description,
  icons: {
    icon: '/mitiga-symbol.png',
    apple: '/mitiga-symbol.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={defaultPresentation.locale}>
      <body>
        <PrototypeProviders>{children}</PrototypeProviders>
      </body>
    </html>
  );
}
