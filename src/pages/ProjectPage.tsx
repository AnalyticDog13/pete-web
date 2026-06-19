import { Link } from "react-router-dom";

interface Props {
  index: string;
  title: string;
  tag: string;
  blurb: string;
}

/**
 * Scaffold for a project section. Intentionally near-empty — Peter will fill
 * each of these in later. The structure (eyebrow, title, status, slot) is here
 * so adding content is a matter of dropping it into `.project__slot`.
 */
export default function ProjectPage({ index, title, tag, blurb }: Props) {
  return (
    <main className="project">
      <Link to="/" className="project__back">
        ← Back
      </Link>

      <header className="project__head">
        <span className="project__index">{index}</span>
        <p className="project__tag">{tag}</p>
        <h1 className="project__title">{title}</h1>
        <p className="project__blurb">{blurb}</p>
      </header>

      <div className="project__slot" aria-label="Section content">
        <span className="project__status">
          <span className="project__pip" aria-hidden="true" />
          In development
        </span>
        <p className="project__placeholder">This section is being wired up. Check back soon.</p>
      </div>
    </main>
  );
}
