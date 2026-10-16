"use client";
import { usePathname } from "next/navigation";
import { useLocale } from "@/i18n";
import { formatTranslation } from "@/lib/i18n-utils";
export default function Footer() {
  const pathname = usePathname(),
    { locale, t } = useLocale();
  if (
    !["/works", "/texts", "/contact"].some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    )
  )
    return null;
  const name = locale === "ko" ? "박정환" : "Jungwhan Park";
  return (
    <footer className="copyright-footer">
      <p>
        © {new Date().getFullYear()} {name}. All rights reserved.
      </p>
      <p>{formatTranslation(t.footer.notice, { name })}</p>
    </footer>
  );
}
