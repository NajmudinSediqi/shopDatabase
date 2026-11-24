import { useSyncExternalStore } from "react";

/** "original" shows every amount in the currency it was recorded in. */
export type DisplayCurrency = "original" | "AFN" | "USD";

type State = { display: DisplayCurrency; rate: number };
let state: State = { display: "original", rate: 70 };
const subs = new Set<() => void>();

export function getCurrencyState() {
  return state;
}
export function setCurrencyState(patch: Partial<State>) {
  const next = { ...state, ...patch };
  if (next.display === state.display && next.rate === state.rate) return;
  state = next;
  if (patch.display && typeof window !== "undefined") localStorage.setItem("display-currency", patch.display);
  subs.forEach((f) => f());
}
export function loadDisplayPref() {
  const v = typeof window !== "undefined" ? localStorage.getItem("display-currency") : null;
  if (v === "AFN" || v === "USD" || v === "original") setCurrencyState({ display: v });
}
export function useCurrencyState() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => state,
  );
}

/** Live USD→AFN market rate from a free public API (no key). */
export async function fetchLiveRate(): Promise<number | null> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await r.json();
    const v = Number(j?.rates?.AFN);
    return v > 0 ? Math.round(v * 100) / 100 : null;
  } catch {
    return null;
  }
}
