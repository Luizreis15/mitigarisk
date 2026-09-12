import type { Metadata } from 'next';

import { PrototypeProviders } from '@/components/prototype/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'MITIGA — protótipo de gestão de riscos',
  description:
    'Protótipo navegável das visões Login, Empresa, Super admin e Operador.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <PrototypeProviders>{children}</PrototypeProviders>
      </body>
    </html>
  );
}
