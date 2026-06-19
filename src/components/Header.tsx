import { NavLink, Link, useLocation } from "react-router-dom";

const NAV = [
  { to: "/prediction-markets", label: "Prediction Markets", idx: "01" },
  { to: "/roth-ira", label: "Roth IRA", idx: "02" },
  { to: "/pulse", label: "Pulse", idx: "03" },
];

export default function Header() {
  const isLanding = useLocation().pathname === "/";

  return (
    <header className="site-header">
      <Link to="/" className="wordmark" aria-label="Peter Olhava — home">
        <span className="wordmark__mark" aria-hidden="true">
          ◉
        </span>
        <span className="wordmark__name">Peter Olhava</span>
      </Link>

      {/* On the landing page the sections live as hero buttons, so the header
          nav would be redundant — show it only on the interior pages. */}
      {!isLanding && (
        <nav className="site-nav" aria-label="Sections">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""}`}
            >
              <span className="nav-link__idx">{n.idx}</span>
              <span className="nav-link__label">{n.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
