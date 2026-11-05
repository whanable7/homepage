import { cookies } from "next/headers";
import { getPublicAppearance } from "@/lib/public-content";
import { defaultAppearance } from "@/lib/appearance";
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
import VisitorTracker from "@/components/analytics/VisitorTracker";
import { ANALYTICS_EXCLUSION_COOKIE } from "@/lib/analytics-policy";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

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
    getPublicAppearance().catch(() => defaultAppearance),
  ]);
  const initialLocale = cookieJar.get("locale")?.value === "ko" ? "ko" : "en";
  const analyticsExcluded =
    cookieJar.get(ANALYTICS_EXCLUSION_COOKIE)?.value === "1" ||
    (await verifySession(cookieJar.get(SESSION_COOKIE)?.value));
  return (
    <html lang={initialLocale}>
      <body className="antialiased" style={appearanceStyle(appearance)}>
        <AppearanceProvider value={appearance}>
          <LocaleProvider initialLocale={initialLocale}>
            <SidePanelProvider>
              <div className="flex flex-col min-h-screen">
                <div className="flex-grow">{children}</div>
                <Footer />
                <UpdateNotice />
                <VisitorTracker
                  measurementId={process.env.GA_MEASUREMENT_ID || ""}
                  production={process.env.VERCEL_ENV === "production"}
                  initialExcluded={analyticsExcluded}
                />
              </div>
            </SidePanelProvider>
          </LocaleProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
