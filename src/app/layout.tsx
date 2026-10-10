import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { PwaBridge } from "@/components/pwa/PwaBridge";
import { BRAND } from "@/config/brand";
import { CloudSync } from "@/features/cloud/components/CloudSync";
import { I18nProvider } from "@/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Tipografía con serif para los títulos del skin "Cálido": se autoaloja en el build, sin pedir nada a la red.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: "Sistema operativo para tu casa",
  applicationName: BRAND.name,
  icons: { apple: { url: "/icons/apple-180.png", sizes: "180x180", type: "image/png" } },
  // iOS: se abre como app (sin barra de Safari) al agregarla a la pantalla de inicio.
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}>
      <body>
        <AntdRegistry>
          <I18nProvider>
            <ThemeProvider>
              <AppShell>{children}</AppShell>
              <PwaBridge />
              <CloudSync />
            </ThemeProvider>
          </I18nProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
