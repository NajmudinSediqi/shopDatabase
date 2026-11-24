import { useEffect } from "react";

export type SidebarTheme = "noor" | "classic";
const storageKey = "sidebar-theme";

export function readSidebarTheme(): SidebarTheme {
  try {
    return localStorage.getItem(storageKey) === "classic" ? "classic" : "noor";
  } catch {
    return "noor";
  }
}

export function applySidebarTheme(theme: SidebarTheme) {
  document.documentElement.dataset["sidebarTheme"] = theme;
}

export function useSidebarThemePreference() {
  useEffect(() => {
    applySidebarTheme(readSidebarTheme());
    const update = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) applySidebarTheme(readSidebarTheme());
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
}
