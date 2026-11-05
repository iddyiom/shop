// Items and prices: empty until unit F8.
import PageHeader, { ComingSoon } from '../components/PageHeader';

export default function Items() {
  return (
    <>
      <PageHeader eyebrow="ITEMS AND PRICES" title="What you sell" tabTitle="Items and prices" />
      <ComingSoon unit="F8" />
    </>
  );
}
