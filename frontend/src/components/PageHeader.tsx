// The top of every page: small eyebrow line and the big title. Also names the browser tab.
import { useEffect } from 'react';

type Props = {
  eyebrow: string; // e.g. "STORE BALANCE"
  title: string; // e.g. "What is in the store"
  tabTitle: string; // e.g. "Store balance"
};

export default function PageHeader({ eyebrow, title, tabTitle }: Props) {
  useEffect(() => {
    document.title = `${tabTitle} · Depot`;
  }, [tabTitle]);

  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
    </header>
  );
}

/** The F2 stand-in for a page's content. */
export function ComingSoon({ unit }: { unit: string }) {
  return <p className="coming-soon">Coming in unit {unit}.</p>;
}
