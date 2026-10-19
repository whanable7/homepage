import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import { SidePanelProvider } from "@/contexts/SidePanelContext";
import { LocaleProvider } from "@/i18n";
import UpdateNotice from "@/components/common/UpdateNotice";
import Footer from "@/components/common/Footer";

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
      <body className="antialiased">
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
