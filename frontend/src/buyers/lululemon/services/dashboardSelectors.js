/** Pure read-only selectors for LULULEMON operations metrics.
 * One input PO row represents a unique (Order ID, PO Number); source ALL_BP rows
 * must never be summed as distinct POs. Keep this module usable in node tests.
 */
const num = (value) => Number(value || 0);
const sum = (rows, field) => rows.reduce((total, row) => total + num(row[field]), 0);

export const filterScopedPos = (pos, orderId = 'ALL', factoryCode = 'ALL') => (pos || []).filter((row) =>
  (orderId === 'ALL' || row.orderId === orderId)
  && (factoryCode === 'ALL' || row.factoryCode === factoryCode)
);

export const dashboardTotals = (rows) => ({
  orders: new Set(rows.map((p) => p.orderId)).size,
  pos: rows.length,
  pickedPos: rows.filter((p) => p.picked).length,
  notPickedPos: rows.filter((p) => !p.picked).length,
  plannedCartons: sum(rows, 'plannedCartons'),
  createdCartons: sum(rows, 'createdCartons'),
  weightPass: sum(rows, 'weightPass'),
  weightFailed: sum(rows, 'weightFailed'),
  rfidPass: sum(rows, 'rfidPass'),
  rfidFailed: sum(rows, 'rfidFailed'),
  rfidNotScanned: sum(rows, 'rfidNotScanned'),
  finalPass: sum(rows, 'finalPass')
});

export const dashboardOrders = (rows, orderRecords = []) => {
  const names = new Map(orderRecords.map((row) => [row.orderId, row.orderName]));
  const result = new Map();
  for (const po of rows) {
    if (!result.has(po.orderId)) result.set(po.orderId, {
      orderId: po.orderId,
      orderName: names.get(po.orderId) || po.orderName || po.orderId,
      pos: 0, pickedPos: 0, notPickedPos: 0,
      plannedCartons: 0, createdCartons: 0,
      weightPass: 0, weightFailed: 0, weightPending: 0,
      rfidPass: 0, rfidFailed: 0, rfidNotScanned: 0, finalPass: 0
    });
    const row = result.get(po.orderId);
    row.pos++;
    if (po.picked) row.pickedPos++; else row.notPickedPos++;
    for (const key of ['plannedCartons', 'createdCartons', 'weightPass', 'weightFailed',
      'weightPending', 'rfidPass', 'rfidFailed', 'rfidNotScanned', 'finalPass']) {
      row[key] += num(po[key]);
    }
  }
  return Array.from(result.values()).sort((a, b) => a.orderName.localeCompare(b.orderName));
};

export const dashboardFactories = (rows, factoryRecords = [], selectedFactory = 'ALL') =>
  factoryRecords.filter((f) => selectedFactory === 'ALL' || f.factoryCode === selectedFactory)
    .map((f) => {
      const picked = rows.filter((po) => po.factoryCode === f.factoryCode && po.picked);
      const row = { factoryCode: f.factoryCode, pickedPos: picked.length,
        pickedPoNumbers: [...new Set(picked.map((po) => po.poNumber))].sort() };
      for (const key of ['plannedCartons', 'createdCartons', 'identifiedCartons',
        'weightPass', 'weightFailed', 'weightPending', 'rfidPass', 'rfidFailed',
        'rfidNotScanned', 'finalPass']) row[key] = sum(picked, key);
      return row;
    });
