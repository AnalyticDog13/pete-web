import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { NeuralContext } from "./neural/useNeuralParams";
import { DEFAULT_PARAMS, type NeuralParams, type NeuralStats } from "./neural/types";
import NeuralBackground from "./components/NeuralBackground";
import type { NeuralEngine } from "./neural/NeuralEngine";
import Header from "./components/Header";
import Landing from "./pages/Landing";
import ProjectPage from "./pages/ProjectPage";
import NotFound from "./pages/NotFound";

const STORAGE_KEY = "po-neural-params";

function loadParams(): NeuralParams {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PARAMS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_PARAMS;
}

export default function App() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  const prefersReduced = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    []
  );

  const [params, setParamsState] = useState<NeuralParams>(() => ({
    ...loadParams(),
    reducedMotion: prefersReduced,
  }));

  const setParams = useCallback((patch: Partial<NeuralParams>) => {
    setParamsState((prev) => {
      const next = { ...prev, ...patch };
      try {
        // don't persist the derived reduced-motion flag
        const { reducedMotion: _rm, ...persist } = next;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setParamsState((prev) => ({ ...DEFAULT_PARAMS, reducedMotion: prev.reducedMotion }));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // keep the page hue in sync for chrome accents
  useEffect(() => {
    document.documentElement.style.setProperty("--signal-hue", String(params.hue));
  }, [params.hue]);

  const statsRef = useRef<NeuralStats>({ neurons: 0, synapses: 0, signalsPerSecond: 0 });
  const engineRef = useRef<NeuralEngine | null>(null);

  const ctxValue = useMemo(
    () => ({ params, setParams, reset, statsRef, engineRef }),
    [params, setParams, reset]
  );

  return (
    <NeuralContext.Provider value={ctxValue}>
      <NeuralBackground
        params={params}
        dim={!isLanding}
        interactive={isLanding}
        engineRef={engineRef}
        onStats={(s) => {
          statsRef.current = s;
        }}
      />
      <div className={`app-shell ${isLanding ? "is-landing" : "is-subpage"}`}>
        <Header />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/prediction-markets"
            element={
              <ProjectPage
                index="01"
                title="Prediction Markets"
                tag="Forecasting · Liquidity · Edge"
                blurb="Models and tooling for trading on what the crowd believes will happen next."
              />
            }
          />
          <Route
            path="/roth-ira"
            element={
              <ProjectPage
                index="02"
                title="Roth IRA"
                tag="Long horizon · Compounding · Allocation"
                blurb="A patient, tax-advantaged sleeve — systematized and tracked over decades."
              />
            }
          />
          <Route
            path="/pulse"
            element={
              <ProjectPage
                index="03"
                title="Pulse"
                tag="Signals · Data · Live experiments"
                blurb="A running feed of measurements, half-formed ideas, and things worth watching."
              />
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </NeuralContext.Provider>
  );
}
