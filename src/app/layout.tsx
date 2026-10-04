import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { PwaBridge } from "@/components/pwa/PwaBridge";
import { I18nProvider } from "@/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "OpenDomus", template: "%s · OpenDomus" },
  description: "Sistema operativo para tu casa",
  applicationName: "OpenDomus",
  // iOS: se abre como app (sin barra de Safari) al agregarla a la pantalla de inicio.
  appleWebApp: { capable: true, title: "OpenDomus", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AntdRegistry>
          <I18nProvider>
            <ThemeProvider>
              <AppShell>{children}</AppShell>
              <PwaBridge />
            </ThemeProvider>
          </I18nProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
