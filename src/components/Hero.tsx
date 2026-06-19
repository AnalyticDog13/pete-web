import { Link } from "react-router-dom";

const SECTIONS = [
  { to: "/prediction-markets", label: "Prediction Markets", idx: "01", note: "Forecasting & edge" },
  { to: "/roth-ira", label: "Roth IRA", idx: "02", note: "Long-horizon compounding" },
  { to: "/pulse", label: "Pulse", idx: "03", note: "Live signals & notes" },
];

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-name">
      <p className="hero__eyebrow">Mathematics · Markets · Design</p>

      <h1 className="hero__name" id="hero-name">
        Peter Olhava
      </h1>

      <p className="hero__lede">
        Automated trading, data experiments, and generative art — built where mathematics,
        markets, and design converge. This is where the work lives, and where I think out loud.
      </p>

      <nav className="hero__sections" aria-label="Projects">
        {SECTIONS.map((s) => (
          <Link key={s.to} to={s.to} className="node-button">
            <span className="node-button__idx">{s.idx}</span>
            <span className="node-button__body">
              <span className="node-button__label">{s.label}</span>
              <span className="node-button__note">{s.note}</span>
            </span>
            <span className="node-button__arrow" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
