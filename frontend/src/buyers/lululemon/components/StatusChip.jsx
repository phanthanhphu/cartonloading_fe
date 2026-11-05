import BaseStatusChip from 'components/StatusChip';

export default function StatusChip({ status }) {
  return <BaseStatusChip status={status} variant="filled" sx={{ minWidth: 96 }} />;
}
