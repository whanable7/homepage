import { cookies } from "next/headers";
import { getAppearance } from "@/lib/appearance-store";
import { appearanceStyle } from "@/lib/appearance";
import { AppearanceProvider } from "@/contexts/AppearanceContext";
import type { Metadata } from "next";
import "./fonts.css";
import "./appearance-fonts.css";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cookieJar, appearance] = await Promise.all([
    cookies(),
    getAppearance(),
  ]);
  const initialLocale = cookieJar.get("locale")?.value === "ko" ? "ko" : "en";
  return (
    <html lang={initialLocale}>
      <body
        className="antialiased"
        style={appearanceStyle(appearance.data.published)}
      >
        <AppearanceProvider value={appearance.data.published}>
          <LocaleProvider initialLocale={initialLocale}>
            <SidePanelProvider>
              <div className="flex flex-col min-h-screen">
                <div className="flex-grow">{children}</div>
                <Footer />
                <UpdateNotice />
              </div>
            </SidePanelProvider>
          </LocaleProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
