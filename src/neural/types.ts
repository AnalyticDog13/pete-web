export type NeuralStyle = "dendrite" | "synapse" | "constellation" | "cortex";

export interface NeuralParams {
  /** Base signal hue, 0–360. Drives synapse + pulse color. */
  hue: number;
  /** Neuron population, 0–1 (mapped to a node count). */
  density: number;
  /** How frequently the network fires, 0–1. */
  pulseSpeed: number;
  /** How quickly new synapses grow and prune, 0–1. */
  growth: number;
  /** Strength of the cursor as an attractor / stimulus, 0–1. */
  cursorPull: number;
  /** Overall luminance + bloom of the field, 0–1. */
  glow: number;
  /** Visual mode. */
  style: NeuralStyle;
  /** When true, the field renders calmly with minimal motion. */
  reducedMotion: boolean;
}

export interface NeuralStats {
  neurons: number;
  synapses: number;
  signalsPerSecond: number;
}

export const DEFAULT_PARAMS: NeuralParams = {
  hue: 188,
  density: 0.55,
  pulseSpeed: 0.5,
  growth: 0.5,
  cursorPull: 0.3,
  glow: 0.55,
  style: "dendrite",
  reducedMotion: false,
};
