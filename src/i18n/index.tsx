"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { ko, type Translations } from "./translations/ko";
import { en } from "./translations/en";

export type Locale = "ko" | "en";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const translations: Record<Locale, Translations> = { ko, en };

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem("locale");
        if (saved === "ko" || saved === "en") {
          setLocaleState(saved);
          document.documentElement.lang = saved;
          document.cookie = `locale=${saved}; Path=/; Max-Age=31536000; SameSite=Lax`;
        }
      } catch {}
      setMounted(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("locale", newLocale);
    } catch {}
    document.cookie = `locale=${newLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = newLocale;
  };

  // 항상 Context Provider를 제공하되, 마운트 전에는 기본값(ko) 사용
  // SSR 하이드레이션 시에도 컨텍스트 접근 가능
  const effectiveLocale = mounted ? locale : initialLocale;

  return (
    <LocaleContext.Provider
      value={{
        locale: effectiveLocale,
        setLocale,
        t: translations[effectiveLocale],
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}

// 조건부 훅 - Provider 외부에서도 안전하게 사용
export function useLocaleOptional() {
  const context = useContext(LocaleContext);
  return context;
}
