"use client";
import { createContext, useContext, type ReactNode } from "react";
import { defaultAppearance, type Appearance } from "@/lib/appearance";
const Context = createContext<Appearance>(defaultAppearance);
export function AppearanceProvider({
  value,
  children,
}: {
  value: Appearance;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAppearance = () => useContext(Context);
