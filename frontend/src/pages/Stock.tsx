// Store balance: empty until unit F7.
import PageHeader, { ComingSoon } from '../components/PageHeader';

export default function Stock() {
  return (
    <>
      <PageHeader eyebrow="STORE BALANCE" title="What is in the store" tabTitle="Store balance" />
      <ComingSoon unit="F7" />
    </>
  );
}
