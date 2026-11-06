// While something loads: grey lines where the content will be (R2b).
// Sighted people see the shape of what is coming; screen readers hear "Loading…",
// because the lines are only decoration (aria-hidden) and the words are hidden visually.
type Props = {
  lines?: number; // how many grey lines, 3 by default
  label?: string; // what screen readers hear, "Loading…" by default
};

export default function Skeleton({ lines = 3, label = 'Loading…' }: Props) {
  return (
    <div className="skeleton" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton-line" aria-hidden="true" />
      ))}
    </div>
  );
}
