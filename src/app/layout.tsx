import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Noto_Sans_KR,
  Nanum_Myeongjo,
} from "next/font/google";
import "./globals.css";
import { SidePanelProvider } from "@/contexts/SidePanelContext";
import { LocaleProvider } from "@/i18n";
import UpdateNotice from "@/components/common/UpdateNotice";
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

const nanumMyeongjo = Nanum_Myeongjo({
  variable: "--font-nanum-myeongjo",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jungwhan Park",
  description: "Works and writings by Jungwhan Park",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/apple-icon.png",
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
        className={`${cormorant.variable} ${notoSansKr.variable} ${nanumMyeongjo.variable} antialiased`}
      >
        <LocaleProvider>
          <SidePanelProvider>
            <div className="flex flex-col min-h-screen">
              <div className="flex-grow">{children}</div>
              <Footer />
              <UpdateNotice />
            </div>
          </SidePanelProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
