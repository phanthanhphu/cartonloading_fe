/**
 * Shared LULULEMON Management Reports / Dashboard default reporting window.
 * The default ALL mode counts imported Order/PO data regardless of schedule.
 * This window remains available for filtering imported dates and shipping trends.
 * Dates are calculated in Vietnam time to match backend Shipping Scheduler.
 * The report's explicit user-applied filters and 1-year maximum are unchanged.
 */
export function getDefaultManagementReportFilters(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric'
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const year = Number(byType.year);
  const month = Number(byType.month); // 1-based
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  // Through the last day of the next two months, includes future Shipping plans.
  const end = new Date(Date.UTC(year, month + 2, 0));
  const to = end.toISOString().slice(0, 10);
  return { from, to, factory: '', shippingDate: '', orderId: '', status: '', dateBasis: 'ALL' };
}
