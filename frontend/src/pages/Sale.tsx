// New sale: empty until unit F5.
import PageHeader, { ComingSoon } from '../components/PageHeader';

export default function Sale() {
  return (
    <>
      <PageHeader eyebrow="NEW SALE" title="Pick the items" tabTitle="New sale" />
      <ComingSoon unit="F5" />
    </>
  );
}
