import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="project">
      <header className="project__head">
        <span className="project__index">404</span>
        <p className="project__tag">Signal lost</p>
        <h1 className="project__title">No path here</h1>
        <p className="project__blurb">That route never grew a connection.</p>
      </header>
      <Link to="/" className="project__back">
        ← Back to the field
      </Link>
    </main>
  );
}
