import { PACKING_ALLOCATION_FIELDS, PACKING_LIST_FIELDS } from '../../../../constants/appConstants';

export { PACKING_ALLOCATION_FIELDS, PACKING_LIST_FIELDS, PACKING_ORDER_FIELDS } from '../../../../constants/appConstants';

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
