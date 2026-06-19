import { createContext, useContext, type MutableRefObject } from "react";
import type { NeuralParams, NeuralStats } from "./types";
import type { NeuralEngine } from "./NeuralEngine";

export interface NeuralContextValue {
  params: NeuralParams;
  setParams: (patch: Partial<NeuralParams>) => void;
  reset: () => void;
  /** Live simulation stats, updated in place by the background (no re-render). */
  statsRef: MutableRefObject<NeuralStats>;
  /** Handle to the running engine, for imperative controls (zoom, etc.). */
  engineRef: MutableRefObject<NeuralEngine | null>;
}

export const NeuralContext = createContext<NeuralContextValue | null>(null);

export function useNeuralParams(): NeuralContextValue {
  const ctx = useContext(NeuralContext);
  if (!ctx) throw new Error("useNeuralParams must be used within <App>");
  return ctx;
}
