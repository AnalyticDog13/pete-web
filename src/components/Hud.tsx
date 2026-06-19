import { useEffect, useState } from "react";
import { useNeuralParams } from "../neural/useNeuralParams";

/** Live simulation readout. Rendered inside the control deck. */
export default function Hud() {
  const { statsRef } = useNeuralParams();
  const [stats, setStats] = useState({ neurons: 0, synapses: 0, signalsPerSecond: 0 });

  useEffect(() => {
    const id = window.setInterval(() => setStats({ ...statsRef.current }), 300);
    return () => window.clearInterval(id);
  }, [statsRef]);

  return (
    <div className="hud" aria-hidden="true">
      <div className="hud__grid">
        <div className="hud__stat">
          <span className="hud__val">{String(stats.neurons).padStart(3, "0")}</span>
          <span className="hud__key">neurons</span>
        </div>
        <div className="hud__stat">
          <span className="hud__val">{String(stats.synapses).padStart(3, "0")}</span>
          <span className="hud__key">synapses</span>
        </div>
        <div className="hud__stat">
          <span className="hud__val">{String(stats.signalsPerSecond).padStart(3, "0")}</span>
          <span className="hud__key">signals/s</span>
        </div>
      </div>
      <div className="hud__bar">
        <span className="hud__pip is-live" />
        <span className="hud__status">field online</span>
      </div>
    </div>
  );
}
