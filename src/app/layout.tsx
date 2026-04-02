import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import "./globals.css";
import { SidePanelProvider } from "@/contexts/SidePanelContext";
import { LocaleProvider } from "@/i18n";
import Footer from "@/components/common/Footer";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const notoSerifKr = Noto_Serif_KR({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jungwhan | Artist Portfolio",
  description: "Artwork portfolio of Jungwhan",
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${cormorant.variable} ${notoSansKr.variable} ${notoSerifKr.variable} antialiased`}
      >
        <LocaleProvider>
          <SidePanelProvider>
            <div className="flex flex-col min-h-screen">
              <div className="flex-grow">
                {children}
              </div>
              <Footer />
            </div>
          </SidePanelProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
