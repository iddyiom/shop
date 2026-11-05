// Restock history: empty until unit F9.
import PageHeader, { ComingSoon } from '../components/PageHeader';

export default function Restock() {
  return (
    <>
      <PageHeader eyebrow="RESTOCK HISTORY" title="Past deliveries" tabTitle="Restock history" />
      <ComingSoon unit="F9" />
    </>
  );
}
