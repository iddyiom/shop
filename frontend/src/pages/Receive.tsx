// Receive stock: empty until unit F6.
import PageHeader, { ComingSoon } from '../components/PageHeader';

export default function Receive() {
  return (
    <>
      <PageHeader eyebrow="RECEIVE STOCK" title="The truck came" tabTitle="Receive stock" />
      <ComingSoon unit="F6" />
    </>
  );
}
