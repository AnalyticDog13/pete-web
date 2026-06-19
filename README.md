# Substrate — Peter Olhava

A portfolio / contact site for Peter Olhava. The landing page is a living neural
field — neurons grow dendrites, form synapses, and fire signals across the
network. It reacts to the cursor, can be tuned live, clicked to grow new
neurons, and zoomed.

> Mathematics, markets, and design — automated trading, data experiments, and
> generative art. This is where the work lives, and where I think out loud.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build → dist/
npm run preview  # serve the production build locally
```

Requires Node 18+ (developed on Node 24).

## The neural field

`src/neural/NeuralEngine.ts` is a self-contained canvas-2D simulation with no
React in its hot loop. React only feeds it parameters and reads back stats.

**Interactions (landing page):**

- **Move** the cursor — nearby neurons excite and fire; quick movement leaves a wake.
- **Click** empty space — grows a new neuron there and fires it.
- **Scroll / pinch** — zoom the field in and out. (Also `−/+` in the deck.)
- **Field Controls** deck — Hue, Density, Pulse, Growth, Cursor Pull, Glow, and
  four styles: Dendrite, Synapse, Lattice, Cortex. Settings persist in
  `localStorage`; "Reset field" restores defaults.

Defaults live in `src/neural/types.ts` (`DEFAULT_PARAMS`). `prefers-reduced-motion`
is respected — the field renders calmly.

## Structure

```
src/
  neural/
    NeuralEngine.ts     simulation (nodes, synapses, pulses, zoom, cursor)
    types.ts            NeuralParams + DEFAULT_PARAMS
    useNeuralParams.ts  React context (params, stats, engine handle)
  components/
    NeuralBackground.tsx  canvas + pointer/click/wheel/pinch wiring
    ControlDeck.tsx       the instrument panel (sliders, presets, zoom)
    Hud.tsx               live neurons / synapses / signals readout
    Header.tsx, Hero.tsx
  pages/
    Landing.tsx
    ProjectPage.tsx     shared scaffold for the three sections
    NotFound.tsx
  App.tsx               routes + shared param state
  index.css             design tokens + all chrome styling
```

## Adding content to the sections

The three sections — **Prediction Markets**, **Roth IRA**, **Pulse** — are
intentionally near-empty for now. Each is rendered by `pages/ProjectPage.tsx`;
drop content into the `.project__slot` element (or give a section its own page
component and wire a route in `App.tsx`). Routes:
`/prediction-markets`, `/roth-ira`, `/pulse`.

## Deploying

It's a single-page app, so the host must rewrite unknown paths to `index.html`
(e.g. a Netlify `_redirects` rule `/* /index.html 200`, or Vercel's SPA
fallback). Otherwise refreshing `/pulse` will 404.
