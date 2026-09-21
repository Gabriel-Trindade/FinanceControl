import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// Sem weight: no Next 16.3.5 a IBM Plex Sans é fonte variável (eixos wght 100–700
// e wdth), então vem um arquivo só e qualquer peso fica disponível.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinanceControl",
  description: "Controle do cartão compartilhado",
};

// viewportFit "cover": deixa o conteúdo ocupar até a borda da tela (atrás do notch/barra de gestos).
// Sem isso, env(safe-area-inset-bottom) (usado em src/components/navegacao.tsx) sempre vale 0.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${plexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
