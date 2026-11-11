/**
 * Presentation-only labels for audit records. Never rewrite the stored action,
 * resource, result or snapshot: these codes remain the API contract.
 */
export const AUDIT_ACTION_LABELS = Object.freeze({
  CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted',
  RESET_PASSWORD: 'Reset user password', CHANGE_OWN_PASSWORD: 'Changed own password',
  GENERATE_RESET_PASSWORD: 'Generated password reset',
  LULULEMON_ALL_BP_IMPORT: 'Imported ALL_BP Excel',
  LULULEMON_PO_UPDATE: 'Updated PO', LULULEMON_PO_DELETE: 'Deleted PO',
  LULULEMON_UNDO_ITEM: 'Undid item scan', LULULEMON_FINISH_CARTON: 'Completed carton',
  LULULEMON_SHIPPING_IMPORT: 'Imported shipping data',
  LULULEMON_SHIPPING_SCHEDULE_CREATE: 'Created shipping schedule',
  LULULEMON_PO_SHIPPING_PLAN_CREATE: 'Added PO to shipping schedule',
  LULULEMON_PO_SHIPPING_PLAN_REMOVE: 'Removed PO from shipping schedule',
  LULULEMON_PO_SHIPPING_PLAN_SUBMIT: 'Submitted shipping schedule',
  LULULEMON_PO_SHIPPING_PLAN_UNSUBMIT: 'Reopened shipping schedule',
  LULULEMON_CARTON_QC_PASS: 'QC passed', LULULEMON_CARTON_QC_FAIL: 'QC failed',
  LULULEMON_SHIPPING_SCHEDULE_REMOVE: 'Removed shipping schedule',
  LULULEMON_SHIPPING_SCHEDULE_CHECK: 'Checked shipping schedule',
  LULULEMON_SHIPPING_SCHEDULE_SEND_CW: 'Sent shipping schedule to CW',
  LULULEMON_SHIPPING_SCHEDULE_COMPLETE: 'Completed shipping schedule',
  LULULEMON_CONFIRM_CARTON_LABEL: 'Confirmed carton label',
  LULULEMON_CONFIRM_CARTON_QTY: 'Confirmed carton quantity',
  LULULEMON_ASSIGN_SSCC: 'Assigned SSCC', LULULEMON_RESET_PO_SKU: 'Reset PO SKU',
  LULULEMON_REOPEN_CARTON: 'Reopened carton', LULULEMON_UNASSIGN_SSCC: 'Unassigned SSCC',
  LULULEMON_UNASSIGN_CARTON_IDENTITY: 'Unassigned carton identity',
  LULULEMON_WEIGHT_PROFILE_SAVE: 'Saved weight profile',
  LULULEMON_WEIGHING_ORDER_CREATE: 'Created weighing order',
  LULULEMON_WEIGHT_CAPTURE: 'Recorded carton weight',
  LULULEMON_REWEIGH_OPEN: 'Reopened for weighing',
  LULULEMON_RECALL_FAILED_CARTON: 'Recalled failed carton',
  LULULEMON_WEIGHT_OVERRIDE: 'Overrode weight result',
  LULULEMON_WEIGHING_SESSION_START: 'Started weighing session',
  LULULEMON_WEIGHING_SESSION_STOP: 'Stopped weighing session',
  LULULEMON_WEIGHING_SESSION_COMPLETE: 'Completed weighing session',
  SEND_PO_HANDOFF: 'Sent PO handoff', CANCEL_PO_HANDOFF: 'Cancelled PO handoff',
  DELETE_PO_HANDOFF: 'Deleted PO handoff', UPDATE_PO_HANDOFF_STATUS: 'Updated PO handoff status',
  MANUAL_INSPECTION: 'Performed manual inspection', CARTON_COMPLETED: 'Completed carton',
  SHIPMENT_PLANNED: 'Planned shipment', SHIPMENT_SHIPPED: 'Shipped shipment',
  SHIPMENT_CANCELLED: 'Cancelled shipment', RESET_CARTON_WEIGHT: 'Reset carton weight',
  RFID_READER_CONFIGURATION: 'Configured RFID reader',
  RFID_READER_REBIND: 'Reassigned RFID reader',
  RFID_READER_DEFAULT_ASSIGNMENT: 'Set default RFID reader',
  RFID_READER_FACTORY_UNASSIGN: 'Removed RFID reader from factory',
  RFID_READER_CONFIGURATION_DELETE: 'Deleted RFID reader configuration',
  RFID_PDA_FORCE_RELEASE: 'Released RFID PDA session',
  SCALE_AGENT_ROTATED: 'Rotated scale agent credentials',
  SCALE_AGENT_REGISTERED: 'Registered scale agent',
  PC_AGENT_REGISTERED: 'Registered factory PC agent',
  PC_AGENT_REVOKED: 'Revoked factory PC agent',
  CONVEYOR_DEVICE_SETTINGS: 'Updated conveyor settings',
  CONVEYOR_DEVICE_REMOVE: 'Removed conveyor configuration',
  CONVEYOR_SIM_START: 'Started conveyor simulator',
  CONVEYOR_SIM_STOP: 'Stopped conveyor simulator',
  CONVEYOR_SIM_REVERSE: 'Reversed conveyor simulator',
  MODBUSPAL_LAB_SIGNAL: 'Changed lab sensor signal',
  MODBUSPAL_LAB_WEIGHT: 'Changed lab weight signal',
  SCALE_DEVICE_SETTINGS: 'Updated scale settings',
  SCALE_DEVICE_REMOVE: 'Removed scale configuration',
  SCALE_SIMULATOR_PUBLISH: 'Published simulated weight',
  STATION_DEVICE_ASSIGNMENT: 'Assigned station device',
  STATION_DEVICE_UNASSIGN: 'Unassigned station device'
});

export const AUDIT_MODULE_LABELS = Object.freeze({
  USER: 'Users', BUYER: 'Buyers', DEPARTMENT: 'Departments', FACTORY: 'Factories',
  ORDER: 'Orders', CARTON: 'Cartons', SHIPMENT_CARTON: 'Shipment cartons',
  LULULEMON_CARTON_LOADING: 'Carton / RFID / Weight',
  LULULEMON_WEIGHING: 'Weighing',
  LULULEMON_SHIPPING_SCHEDULE: 'Shipping Schedule',
  LULULEMON_PO_SHIPPING_PLAN: 'PO Shipping Plan',
  LULULEMON_PO_HANDOFF: 'PO Handoff'
});

const FIELD_LABELS = Object.freeze({
  id: 'Record ID', buyerCode: 'Buyer', factoryCode: 'Factory', stationCode: 'Station',
  orderId: 'Order ID', orderName: 'Order', poId: 'PO ID', poNo: 'PO No.', poNumber: 'PO No.',
  masterPo: 'Master PO', packingPlan: 'Packing Plan', salesOrderPts: 'Sales Order',
  cartonId: 'Carton ID', cartonNo: 'Carton No.', sscc: 'SSCC-18', sscc18: 'SSCC-18',
  sku: 'SKU', epc: 'EPC', epcs: 'EPCs', rfidStatus: 'RFID status',
  weight: 'Weight', weightKg: 'Weight (kg)', grossWeight: 'Gross weight',
  scheduleNo: 'Schedule No.', shippingDate: 'Shipping date', plannedShippingDate: 'Shipping date',
  exFtyDate: 'Ex-Factory', result: 'QC / Business result', status: 'Status',
  createdAt: 'Created at', updatedAt: 'Updated at', createdBy: 'Created by', updatedBy: 'Updated by',
  enabled: 'Account enabled', accessPermissions: 'Permissions', factoryPermissions: 'Assigned factories',
  buyerAccessPermissions: 'Buyer permissions', lastLoginAt: 'Last login',
  weightProfile: 'Weight profile', checkedBy: 'Checked by', checkedAt: 'Checked at',
  note: 'Note', description: 'Description', style: 'Style', color: 'Color', channel: 'Channel'
});

const ACRONYMS = new Set(['PO', 'SKU', 'SSCC', 'RFID', 'QC', 'PLC', 'PDA', 'PC', 'ID', 'IP', 'CW', 'BP', 'EPC']);
const words = (value) => String(value || '')
  .replace(/^LULULEMON[_-]/i, '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  .map((part) => ACRONYMS.has(part.toUpperCase()) ? part.toUpperCase() : part.toLowerCase());

export const auditActionLabel = (code) => AUDIT_ACTION_LABELS[code] || words(code).join(' ').replace(/^./, (ch) => ch.toUpperCase()) || 'Unknown activity';
export const auditModuleLabel = (code) => AUDIT_MODULE_LABELS[code] || words(code).join(' ').replace(/^./, (ch) => ch.toUpperCase()) || 'Other';
export const auditFieldLabel = (key) => FIELD_LABELS[key] || words(key).join(' ').replace(/^./, (ch) => ch.toUpperCase()) || String(key);

export const AUDIT_MODULE_FILTER_OPTIONS = Object.entries(AUDIT_MODULE_LABELS)
  .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
export const AUDIT_ACTION_FILTER_OPTIONS = Object.entries(AUDIT_ACTION_LABELS)
  .map(([value, label]) => ({ value, label: ['CREATE', 'UPDATE', 'DELETE'].includes(value) ? `${label} (any matching code)` : label }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** The Java service returns LocalDateTime without offset. Show its recorded wall-clock time unchanged. */
export const auditDateTime = (value) => {
  if (!value) return '—';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : String(value);
};

export const auditValueText = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(auditValueText).join(', ') : 'Empty';
  if (typeof value === 'object') return Object.entries(value).map(([key, val]) => `${auditFieldLabel(key)}: ${auditValueText(val)}`).join('; ') || 'Empty';
  return String(value);
};

/** Prefer business identifiers actually persisted in the record; never derive a carton/PO from a random UUID. */
export const auditReference = (row) => {
  const containers = [row?.after, row?.before].filter((item) => item && typeof item === 'object');
  const candidates = [
    ['poNumber', 'PO'], ['sscc18', 'SSCC'], ['sscc', 'SSCC'],
    ['cartonNo', 'Carton'], ['scheduleNo', 'Schedule'],
    ['orderName', 'Order'], ['masterPo', 'Master PO'], ['sku', 'SKU']
  ];
  for (const [key, label] of candidates) {
    for (const data of containers) {
      const value = data[key];
      if (value !== null && value !== undefined && String(value).trim()) {
        return `${label}: ${String(value)}`;
      }
    }
  }
  const description = String(row?.description || '');
  const sscc = description.match(/\bSSCC(?:[- ]?18)?\s*[:#]?\s*([0-9]{18})\b/i);
  if (sscc) return `SSCC: ${sscc[1]}`;
  const po = description.match(/\bPO\s*(?:No\.?\s*)?[:# ]+\s*([0-9]{4,})\b/i);
  if (po) return `PO: ${po[1]}`;
  // Keep system IDs accessible in the detail panel without presenting random UUIDs as PO numbers.
  return '';
};

export const auditSnapshotType = (row) => {
  const before = row?.before && Object.keys(row.before).length > 0;
  const after = row?.after && Object.keys(row.after).length > 0;
  if (before && after) return 'comparison';
  if (after) return 'after';
  if (before) return 'before';
  return 'none';
};

export const auditChangeRows = (row) => {
  const type = auditSnapshotType(row);
  if (type === 'after' || type === 'before') {
    const data = type === 'after' ? row.after : row.before;
    return Object.entries(data || {}).map(([field, value]) => ({ field, value }));
  }
  const diff = row?.changes && Object.keys(row.changes).length ? row.changes : null;
  if (diff) return Object.entries(diff).map(([field, values]) => ({
    field, before: values?.before, after: values?.after
  }));
  if (type === 'comparison') {
    const keys = new Set([...Object.keys(row.before || {}), ...Object.keys(row.after || {})]);
    return [...keys].filter((field) => JSON.stringify(row.before?.[field]) !== JSON.stringify(row.after?.[field]))
      .map((field) => ({ field, before: row.before?.[field], after: row.after?.[field] }));
  }
  return [];
};

export const auditLogStatus = (result) => {
  const code = String(result || '').trim().toUpperCase();
  if (!code) return { label: 'Not specified', color: 'default' };
  if (code === 'SUCCESS') return { label: 'Recorded', color: 'success' };
  if (['FAILED', 'FAILURE', 'ERROR'].includes(code)) return { label: 'Error', color: 'error' };
  return { label: auditActionLabel(code), color: 'default' };
};

export const vietnamDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date);

export const quickDateRange = (days) => {
  if (!days) return { fromDate: '', toDate: '' };
  const today = vietnamDate();
  const [year, month, date] = today.split('-').map(Number);
  return {
    fromDate: new Date(Date.UTC(year, month - 1, date - (days - 1))).toISOString().slice(0, 10),
    toDate: today
  };
};
