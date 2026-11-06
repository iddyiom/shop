// One number card on Home, e.g. "Items sold · Units · 126 · On all receipts today".
type Props = {
  label: string;
  value: string;
  note: string;
  pill?: string; // the small outlined word at the top right ("Owner only", "Units")
  strong?: boolean; // the one highlighted card (money for the owner)
};

export default function StatCard({ label, value, note, pill, strong = false }: Props) {
  return (
    <div className={strong ? 'stat-card strong' : 'stat-card'}>
      <span className="stat-top">
        <span className="stat-label">{label}</span>
        {pill && <span className="stat-pill">{pill}</span>}
      </span>
      <span className="stat-value">{value}</span>
      <span className="stat-note">{note}</span>
    </div>
  );
}
