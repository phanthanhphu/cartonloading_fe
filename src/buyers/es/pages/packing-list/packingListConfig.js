export const PACKING_ORDER_FIELDS = [
  { name: 'orderName', label: 'Order Name', required: true },
  { name: 'orderDate', label: 'Start Order', type: 'date', required: true },
  { name: 'endOrderDate', label: 'End Order', type: 'date', required: true }
];

export const PACKING_ALLOCATION_FIELDS = [
  { name: 'supplierName', label: 'Supplier name', type: 'text', width: 150 },
  { name: 'supplierNumber', label: 'e.s. Supplier #', type: 'text', width: 120 },
  { name: 'productionFacility', label: 'Production facility', type: 'text', width: 135 },
  { name: 'containerNumber', label: 'Container #', type: 'text', width: 120 },
  { name: 'shipmentMode', label: 'Mode of shipment', type: 'text', width: 135 },
  { name: 'etd', label: 'ETD', type: 'date', width: 110 },
  { name: 'eta', label: 'ETA', type: 'date', width: 110 },
  { name: 'poNumber', label: 'e.s. PO #', type: 'text', required: true, width: 110 },
  { name: 'articleNumber', label: 'e.s. Article #', type: 'text', required: true, width: 125 },
  { name: 'styleNumber', label: 'STYLE#', type: 'text', required: true, width: 110 },
  { name: 'style', label: 'STYLE', type: 'text', required: true, width: 290 },
  { name: 'color', label: 'Color', type: 'text', required: true, width: 150 },
  { name: 'size', label: 'Size', type: 'text', required: true, width: 90 },
  { name: 'qtyPerCarton', label: 'Qty Per Ctn', type: 'number', required: true, width: 110 },
  { name: 'invoiceNumber', label: 'Invoice #', type: 'text', width: 120 },
  { name: 'totalPcs', label: 'Total pcs', type: 'number', required: true, width: 105 },
  { name: 'totalCartons', label: 'Total ctns', type: 'number', required: true, width: 105 },
  { name: 'pcsAir', label: 'Pcs AIR', type: 'number', width: 95 },
  { name: 'cartonsAir', label: 'Ctns AIR', type: 'number', width: 95 },
  { name: 'pcsSea', label: 'Pcs SEA', type: 'number', width: 95 },
  { name: 'cartonsSea', label: 'Ctns SEA', type: 'number', width: 95 },
  { name: 'cbmAir', label: 'CBM AIR', type: 'number', width: 100 },
  { name: 'kgAir', label: 'KG AIR', type: 'number', width: 100 },
  { name: 'status', label: 'STATUS', type: 'text', width: 100 },
  { name: 'openPoQtyOverdel', label: 'Open PO QTY / Overdel', type: 'number', width: 155 },
  { name: 'remarks', label: 'Remarks', type: 'text', width: 170 },
  { name: 'yoLotNumber', label: 'YO Lot#', type: 'text', width: 100 },
  { name: 'hCtn', label: 'H CTN', type: 'number', width: 90 },
  { name: 'cbmCtn', label: 'CBM CTN', type: 'number', width: 100 }
];

export const PACKING_LIST_FIELDS = [
  { name: 'cartonFrom', label: 'C/T From', type: 'number', width: 95 },
  { name: 'cartonTo', label: 'C/T To', type: 'number', width: 95 },
  { name: 'cartonsQty', label: 'CTNS Qty', type: 'number', required: true, width: 100 },
  { name: 'poNumber', label: 'P.O. #', type: 'text', required: true, width: 115 },
  { name: 'styleNumber', label: 'Style #', type: 'text', required: true, width: 115 },
  { name: 'style', label: 'Style', type: 'text', width: 300 },
  { name: 'articleNumber', label: 'Art.no.', type: 'text', required: true, width: 120 },
  { name: 'color', label: 'Color', type: 'text', required: true, width: 150 },
  { name: 'size', label: 'Size', type: 'text', required: true, width: 105 },
  { name: 'qtyPerCarton', label: 'Qty/CTN', type: 'number', required: true, width: 105 },
  { name: 'totalPcs', label: 'Total PCS', type: 'number', required: true, width: 110 },
  { name: 'cartonMeasurement', label: 'Ctn Meas', type: 'text', width: 145 },
  { name: 'cbm', label: 'CBM', type: 'number', width: 100 },
  { name: 'grossWeightKg', label: 'Gross Weight (kg)', type: 'number', width: 145 },
  { name: 'netWeightKg', label: 'Net Weight (kg)', type: 'number', width: 140 },
  { name: 'actualWeightKg', label: 'Actual Weight (kg)', type: 'number', width: 150 },
  { name: 'remarks', label: 'Remarks', type: 'text', width: 200 }
];

export const emptyFormFromFields = (fields) => fields.reduce((result, field) => {
  result[field.name] = '';
  return result;
}, {});

export const emptyAllocationForm = () => emptyFormFromFields(PACKING_ALLOCATION_FIELDS);
export const emptyPackingListForm = () => emptyFormFromFields(PACKING_LIST_FIELDS);

export const toPayload = (fields, form) => fields.reduce((result, field) => {
  const value = form[field.name];
  if (field.type === 'number') {
    result[field.name] = value === '' || value === null || value === undefined ? null : Number(value);
  } else {
    result[field.name] = value === '' ? null : value;
  }
  return result;
}, {});

export const toAllocationPayload = (form) => toPayload(PACKING_ALLOCATION_FIELDS, form);
export const toPackingListPayload = (form) => toPayload(PACKING_LIST_FIELDS, form);

export const formatPackingValue = (value, type) => {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'number') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString(undefined, { maximumFractionDigits: 6 }) : value;
  }
  return String(value);
};
