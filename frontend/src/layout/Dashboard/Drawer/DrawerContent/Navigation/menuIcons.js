import {
  ApartmentOutlined,
  AssignmentOutlined,
  DashboardOutlined,
  EventAvailableOutlined,
  ForwardToInboxOutlined,
  GroupOutlined,
  HistoryOutlined,
  Inventory2Outlined,
  ManageAccountsOutlined,
  QrCode2Outlined,
  ScaleOutlined,
  StorefrontOutlined
} from '@mui/icons-material';

/**
 * Semantic sidebar icons. Match the function first, never the buyer slug in an item id.
 * The old implementation matched "lululemon" before the function name, which made every
 * LULULEMON entry render with the same Storefront icon and visually flattened the workflow.
 */
export const getNavigationIcon = (item = {}) => {
  const title = String(item.title || '').toLowerCase();
  const id = String(item.id || '').toLowerCase();
  const value = `${title} ${id}`;

  if (value.includes('handoff')) return ForwardToInboxOutlined;
  if (value.includes('packing')) return Inventory2Outlined;
  if (value.includes('label') || value.includes('sscc')) return QrCode2Outlined;
  if (value.includes('weight-management')) return ScaleOutlined;
  if (value.includes('shipping') || value.includes('ex-factory')) return EventAvailableOutlined;
  if (value.includes('order')) return AssignmentOutlined;
  if (value.includes('dashboard')) return DashboardOutlined;
  if (value.includes('user')) return GroupOutlined;
  if (value.includes('department')) return ApartmentOutlined;
  if (value.includes('audit')) return HistoryOutlined;
  if (value.includes('buyer') && !value.includes('buyer-home')) return ManageAccountsOutlined;
  if (value.includes('buyer-home') || title.includes('buyer home')) return StorefrontOutlined;

  return null;
};
