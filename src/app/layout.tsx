import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Producción H61 — Dashboard de Producción por Hora",
  description: "Dashboard interactivo de producción industrial H61 con visualización por hora, turno, circuito y operario. Datos en tiempo real con filtros avanzados.",
  keywords: ["producción", "H61", "dashboard", "manufactura", "industria", "Next.js", "Google Sheets"],
  authors: [{ name: "H61 Production Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Producción H61 — Dashboard",
    description: "Dashboard interactivo de producción industrial con datos por hora, turno, circuito y operario",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Producción H61 — Dashboard",
    description: "Dashboard interactivo de producción industrial con visualización por hora",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
