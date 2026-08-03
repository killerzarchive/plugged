import React, { createContext, useContext } from "react";
import { dark as darkTokens, type Theme } from "@/constants/colors";

// ─── Context ──────────────────────────────────────────────────────────────────
interface ThemeContextValue {
  isDark: boolean;
  tokens: Theme;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  tokens: darkTokens,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ isDark: true, tokens: darkTokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// ─── useColors — returns spec tokens + utility values ─────────────────────────
export function useColors() {
  const { tokens } = useContext(ThemeContext);
  return {
    bg:          tokens.bg,
    bg2:         tokens.bg2,
    bg3:         tokens.bg3,
    border:      tokens.border,
    border2:     tokens.border2,
    txt:         tokens.txt,
    txt2:        tokens.txt2,
    txt3:        tokens.txt3,
    txt4:        tokens.txt4,
    accent:      tokens.accent,
    accentInv:   tokens.accentInv,
    card:        tokens.card,
    card2:       tokens.card2,
    input:       tokens.input,
    inputBorder: tokens.inputBorder,
    pill:        tokens.pill,
    pillBorder:  tokens.pillBorder,
    blue:        tokens.secondary,
    danger:      tokens.danger,
    dark:        true,
    statusBar:   "light-content" as "light-content" | "dark-content",
    mapType:     "mutedStandard" as const,
    // Legacy aliases
    label:       tokens.txt,
    sub:         tokens.txt2,
    muted:       tokens.txt3,
    fill:        tokens.pill,
    fillFocus:   tokens.bg3,
    surface:     tokens.bg2,
    separator:   tokens.border,
    brand:       tokens.accent,
    primary:     tokens.txt,
    secondary:   tokens.txt2,
    tertiary:    tokens.txt3,
  };
}
