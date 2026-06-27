import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/i18n/I18nProvider";

export const metadata: Metadata = {
  title: "doc_scheduler — fair resident rosters",
  description: "Fair duty & room rosters for residents. Bilingual TR/EN, Excel export.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
