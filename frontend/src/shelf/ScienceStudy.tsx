import { useState, type PointerEvent } from "react";
import { ArrowRight } from "lucide-react";

const studies = [
  { id: "newton", name: "Isaac Newton", title: "The prism", shortName: "Newton" },
  { id: "edison", name: "Thomas Edison", title: "The filament", shortName: "Edison" },
  { id: "einstein", name: "Albert Einstein", title: "Bent starlight", shortName: "Einstein" },
] as const;

function initialStudy() {
  try {
    const stored = sessionStorage.getItem("books.scienceStudy");
    return Math.max(0, studies.findIndex(study => study.id === stored));
  } catch {
    return 0;
  }
}

export function ScienceStudy() {
  const [index, setIndex] = useState(initialStudy);
  const study = studies[index];
  const next = (index + 1) % studies.length;

  function turnPlate(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = event.currentTarget, bounds = el.getBoundingClientRect();
    el.style.setProperty("--tilt-x", ((event.clientX - bounds.left) / bounds.width * 8 - 4) + "deg");
    el.style.setProperty("--tilt-y", (3 - (event.clientY - bounds.top) / bounds.height * 6) + "deg");
  }

  return <button type="button" className="science-study" data-study={study.id} onPointerMove={turnPlate}
    onPointerLeave={event => {
      event.currentTarget.style.removeProperty("--tilt-x");
      event.currentTarget.style.removeProperty("--tilt-y");
    }}
    onClick={() => {
      setIndex(next);
      try { sessionStorage.setItem("books.scienceStudy", studies[next].id); } catch { /* Storage is optional. */ }
    }}
    aria-label={`${study.name}, ${study.title}. Show ${studies[next].name}, ${studies[next].title}.`}>
    <span key={study.id} className="study-print">
      <img src={`/materials/${study.id}.webp`} alt="" width="160" height="160" />
    </span>
    <span className="study-label">
      <span className="study-name"><span className="full-name">{study.name}</span><span className="short-name">{study.shortName}</span></span>
      <span className="study-subject">{study.title}</span>
    </span>
    <ArrowRight className="study-arrow" size={14} aria-hidden="true"/>
  </button>;
}
