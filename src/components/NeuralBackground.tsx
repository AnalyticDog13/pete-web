import { useEffect, useRef, type MutableRefObject } from "react";
import { NeuralEngine } from "../neural/NeuralEngine";
import type { NeuralParams, NeuralStats } from "../neural/types";

interface Props {
  params: NeuralParams;
  dim: boolean;
  /** When true, the field accepts clicks (add neuron) and zoom gestures. */
  interactive: boolean;
  engineRef: MutableRefObject<NeuralEngine | null>;
  /** Optional callback fed live stats (~4 Hz) for the HUD. */
  onStats?: (stats: NeuralStats) => void;
}

/** True if a UI control (button/slider/link/panel) was the event target. */
function hitUI(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el?.closest?.("button, input, a, label, .control-deck, .zoom-controls, .site-header");
}

export default function NeuralBackground({ params, dim, interactive, engineRef, onStats }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  // create engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new NeuralEngine(canvas, params);
    engineRef.current = engine;
    engine.start();

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    const onVisibility = () => {
      if (document.hidden) engine.stop();
      else engine.start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let statsTimer = 0;
    if (onStatsRef.current) {
      statsTimer = window.setInterval(() => onStatsRef.current?.(engine.getStats()), 260);
    }

    return () => {
      engine.stop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (statsTimer) window.clearInterval(statsTimer);
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push param changes into the engine
  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [params, engineRef]);

  // pointer tracking (works for mouse, pen and touch via Pointer Events)
  useEffect(() => {
    const move = (e: PointerEvent) => engineRef.current?.pointerMove(e.clientX, e.clientY);
    const leave = () => engineRef.current?.pointerLeave();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", leave);
    };
  }, [engineRef]);

  // click / tap on empty field → add a neuron
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!interactiveRef.current || hitUI(e.target)) return;
      engineRef.current?.pointerMove(e.clientX, e.clientY);
      engineRef.current?.addNeuronAt(e.clientX, e.clientY);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [engineRef]);

  // wheel zoom (desktop)
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!interactiveRef.current) return;
      if ((e.target as HTMLElement)?.closest?.(".control-deck")) return;
      e.preventDefault();
      engineRef.current?.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [engineRef]);

  // pinch zoom (touch)
  useEffect(() => {
    let startDist = 0;
    let startZoom = 1;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (!interactiveRef.current || e.touches.length !== 2) return;
      startDist = dist(e.touches);
      startZoom = engineRef.current?.getZoom() ?? 1;
    };
    const onMove = (e: TouchEvent) => {
      if (!interactiveRef.current || e.touches.length !== 2 || startDist === 0) return;
      e.preventDefault();
      engineRef.current?.setZoom((startZoom * dist(e.touches)) / startDist);
    };
    const onEnd = () => {
      startDist = 0;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [engineRef]);

  return (
    <div className={`neural-bg ${dim ? "is-dim" : ""}`} aria-hidden="true">
      <canvas ref={canvasRef} className="neural-canvas" />
      <div className="neural-vignette" />
    </div>
  );
}
