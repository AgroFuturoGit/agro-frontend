import type { Metadata, Viewport } from "next";
import { Geist_Mono, Roboto } from "next/font/google";
import "./globals.css";

import { LoadingOverlay } from "@/components/loading-overlay";

// Fonte da interface (Figma ProduPlan). Vira --font-sans/--font-heading no
// globals.css; Geist Mono continua só para --font-mono (CPF/CNPJ).
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // As páginas já definem o título completo ("Seção · ProduPlan"); sem template
  // para não duplicar o sufixo.
  title: "ProduPlan",
  description:
    "ProduPlan: planejamento e acompanhamento da produção agrícola familiar.",
};

export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${roboto.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <LoadingOverlay />
      </body>
    </html>
  );
}
