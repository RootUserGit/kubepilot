"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      themes={["light", "dark"]}
      enableSystem={false}
      storageKey="kubepilot-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
