"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
export function AppTheme({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="emarque-theme"
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const light = mounted && resolvedTheme === "light";
  return (
    <label className="theme-toggle">
      <Moon size={16} aria-hidden="true" />
      <Switch
        aria-label="Mode clair"
        checked={light}
        onCheckedChange={(checked) => setTheme(checked ? "light" : "dark")}
      />
      <Sun size={16} aria-hidden="true" />
      <span>{light ? "Clair" : "Sombre"}</span>
    </label>
  );
}
