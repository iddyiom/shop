// One number card on Home, e.g. "ITEMS SOLD TODAY · 126 · Units on all receipts".
type Props = {
  label: string;
  value: string;
  note: string;
  strong?: boolean; // the one highlighted card (money for the owner)
};

export default function StatCard({ label, value, note, strong = false }: Props) {
  return (
    <div className={strong ? 'stat-card strong' : 'stat-card'}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-note">{note}</span>
    </div>
  );
}
