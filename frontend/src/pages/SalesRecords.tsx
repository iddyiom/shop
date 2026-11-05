// Sales records: empty until unit F9.
import PageHeader, { ComingSoon } from '../components/PageHeader';

export default function SalesRecords() {
  return (
    <>
      <PageHeader eyebrow="SALES RECORDS" title="Every receipt" tabTitle="Sales records" />
      <ComingSoon unit="F9" />
    </>
  );
}
