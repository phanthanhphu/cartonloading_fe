import {
  DashboardOutlined,
  StoreOutlined,
  GroupOutlined,
  BusinessOutlined,
  ManageAccountsOutlined,
  HistoryOutlined,
  QrCode2Outlined,
  ScaleOutlined
} from '@mui/icons-material';
import { isAdmin, readStoredUser } from 'utils/accessControl';
import { getAccessibleBuyers, getActiveBuyer } from 'utils/buyerAccess';
import { buyerCapability, getBuyerMenuEntries } from 'buyers/core/buyerModules';
import { BUYER_CODE } from '../constants/appConstants';

const item = (id, title, url, icon, activePaths = [url], matchDescendants = false) => ({
  id,
  title,
  url,
  icon,
  activePaths,
  matchDescendants,
  type: 'item',
  breadcrumbs: false,
  exact: true
});

const toMenuItem = (entry, buyer) => item(
  `buyer-${entry.id}-${buyer.slug}`,
  entry.title,
  entry.to,
  entry.icon,
  entry.activePaths || [entry.to],
  true // Buyer operations own their nested routes; admin/home items remain exact.
);

const getDashboardMenu = () => {
  const user = readStoredUser();
  const buyers = getAccessibleBuyers(user);
  const requestedBuyer = getActiveBuyer();
  const activeBuyer = buyers.find((buyer) => buyer.code === requestedBuyer?.code) || buyers[0] || null;

  const buyerEntries = activeBuyer ? getBuyerMenuEntries(activeBuyer) : [];
  const entryById = new Map(buyerEntries.map((entry) => [entry.id, entry]));
  // LULULEMON: Shipment hand-off belongs to Packing / Operations, not Sales.
  // Keep the navigation grouping for other buyers unchanged.
  const isLululemon = activeBuyer?.code === BUYER_CODE.LULULEMON;
  const salesIds = isLululemon ? [] : ['orders', 'shipping'];
  const operationIds = [
    'po-picking', 'packing', 'checking',
    ...(isLululemon ? ['shipping'] : []),
    'weight-management',
    ...buyerEntries.filter((entry) => entry.id.startsWith('weight-management-')).map((entry) => entry.id)
  ];

  const salesChildren = activeBuyer
    ? salesIds.map((id) => entryById.get(id)).filter(Boolean).map((entry) => toMenuItem(entry, activeBuyer))
    : [];

  const operationChildren = activeBuyer
    ? operationIds.map((id) => entryById.get(id)).filter(Boolean).map((entry) => toMenuItem(entry, activeBuyer))
    : [];

  // Buyer modules other than LULULEMON may expose different entries. Keep those visible
  // instead of dropping them when they do not fit the two LULULEMON workflow groups.
  const groupedIds = new Set([...salesIds, ...operationIds]);
  const otherBuyerChildren = activeBuyer
    ? buyerEntries.filter((entry) => !groupedIds.has(entry.id)).map((entry) => toMenuItem(entry, activeBuyer))
    : [];

  const factoryTools = [];
  if (activeBuyer && buyerCapability(activeBuyer, 'barcodeInventory')) {
    factoryTools.push(item('barcode-management', 'Barcode Inventory', '/barcode-management', QrCode2Outlined));
  }
  if (activeBuyer && buyerCapability(activeBuyer, 'scaleStations') && isAdmin()) {
    factoryTools.push(item('scale-stations', 'Scale Stations', '/scale-stations', ScaleOutlined));
  }

  const buyerLabel = activeBuyer?.label || 'Buyer';

  return {
    items: [
      {
        id: 'workspace',
        title: 'Home',
        type: 'group',
        children: [
          item('buyer-workspaces', 'Buyer Workspace', '/workflow', StoreOutlined, ['/workflow', '/buyers']),
          item('dashboard', 'Dashboard', '/dashboard', DashboardOutlined)
        ]
      },
      {
        id: 'buyer-sales',
        title: `${buyerLabel} · Sales`,
        type: 'group',
        children: salesChildren
      },
      {
        id: 'buyer-operations',
        title: `${buyerLabel} · Operations`,
        type: 'group',
        children: operationChildren
      },
      {
        id: 'buyer-other',
        title: `${buyerLabel} · Tools`,
        type: 'group',
        children: otherBuyerChildren
      },
      {
        id: 'factory-tools',
        title: 'Factory Tools',
        type: 'group',
        children: factoryTools
      },
      {
        id: 'management',
        title: 'Administration',
        type: 'group',
        children: isAdmin() ? [
          item('users', 'Users', '/users', GroupOutlined),
          item('departments', 'Factories & Departments', '/departments', BusinessOutlined),
          item('buyers', 'Buyers', '/buyers', ManageAccountsOutlined),
          item('audit-logs', 'Audit Logs', '/audit-logs', HistoryOutlined)
        ] : []
      }
    ].filter((group) => group.children.length)
  };
};

export default getDashboardMenu();
export { getDashboardMenu };
