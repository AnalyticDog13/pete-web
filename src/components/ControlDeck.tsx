import { useEffect, useState } from "react";
import { useNeuralParams } from "../neural/useNeuralParams";
import type { NeuralStyle } from "../neural/types";
import Hud from "./Hud";

const STYLES: { id: NeuralStyle; label: string }[] = [
  { id: "dendrite", label: "Dendrite" },
  { id: "synapse", label: "Synapse" },
  { id: "constellation", label: "Lattice" },
  { id: "cortex", label: "Cortex" },
];

function Slider({
  label,
  value,
  onChange,
  display,
  hueTrack = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  display: string;
  hueTrack?: boolean;
}) {
  return (
    <label className={`deck-slider ${hueTrack ? "deck-slider--hue" : ""}`}>
      <span className="deck-slider__head">
        <span className="deck-slider__label">{label}</span>
        <span className="deck-slider__value">{display}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
      />
    </label>
  );
}

export default function ControlDeck() {
  const { params, setParams, reset, engineRef } = useNeuralParams();
  // start open on desktop, collapsed on phones so the field is visible first
  const [open, setOpen] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 761px)").matches
  );
  const [zoom, setZoom] = useState(1);

  // keep the zoom readout in sync with wheel / pinch gestures
  useEffect(() => {
    const id = window.setInterval(() => {
      const z = engineRef.current?.getZoom();
      if (z) setZoom(z);
    }, 200);
    return () => window.clearInterval(id);
  }, [engineRef]);

  return (
    <aside className={`control-deck ${open ? "is-open" : "is-closed"}`} aria-label="Field controls">
      <button
        type="button"
        className="control-deck__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="control-deck__dot" aria-hidden="true" />
        <span className="control-deck__title">Field Controls</span>
        <span className="control-deck__chev" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="control-deck__body">
          <Hud />

          <div className="deck-presets" role="group" aria-label="Animation style">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`deck-preset ${params.style === s.id ? "is-active" : ""}`}
                onClick={() => setParams({ style: s.id })}
                aria-pressed={params.style === s.id}
              >
                {s.label}
              </button>
            ))}
          </div>

          <Slider
            label="Hue"
            value={params.hue / 360}
            onChange={(v) => setParams({ hue: Math.round(v * 360) })}
            display={`${Math.round(params.hue)}°`}
            hueTrack
          />
          <Slider
            label="Density"
            value={params.density}
            onChange={(v) => setParams({ density: v })}
            display={`${Math.round(params.density * 100)}%`}
          />
          <Slider
            label="Pulse"
            value={params.pulseSpeed}
            onChange={(v) => setParams({ pulseSpeed: v })}
            display={`${Math.round(params.pulseSpeed * 100)}%`}
          />
          <Slider
            label="Growth"
            value={params.growth}
            onChange={(v) => setParams({ growth: v })}
            display={`${Math.round(params.growth * 100)}%`}
          />
          <Slider
            label="Cursor Pull"
            value={params.cursorPull}
            onChange={(v) => setParams({ cursorPull: v })}
            display={`${Math.round(params.cursorPull * 100)}%`}
          />
          <Slider
            label="Glow"
            value={params.glow}
            onChange={(v) => setParams({ glow: v })}
            display={`${Math.round(params.glow * 100)}%`}
          />

          <div className="deck-zoom" role="group" aria-label="Zoom the field">
            <span className="deck-zoom__label">Zoom</span>
            <div className="deck-zoom__controls">
              <button
                type="button"
                className="deck-zoom__btn"
                onClick={() => engineRef.current?.zoomBy(1 / 1.2)}
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                className="deck-zoom__value"
                onClick={() => engineRef.current?.resetZoom()}
                aria-label="Reset zoom"
                title="Reset zoom"
              >
                {zoom.toFixed(1)}×
              </button>
              <button
                type="button"
                className="deck-zoom__btn"
                onClick={() => engineRef.current?.zoomBy(1.2)}
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          </div>

          <p className="deck-tip">Click the field to grow a neuron · scroll or pinch to zoom</p>

          <button type="button" className="deck-reset" onClick={reset}>
            Reset field
          </button>
        </div>
      )}
    </aside>
  );
}
