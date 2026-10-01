import StatusChip from 'components/StatusChip';

export default function LululemonStatusChip({ status }) {
  return <StatusChip status={status} variant="filled" sx={{ minWidth: 96 }} />;
}
