import { Children, cloneElement, Fragment, isValidElement, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel } from '@mui/material';

const ACTION_LABELS = new Set(['ACTION', 'ACTIONS', 'OPERATION', 'OPERATIONS']);
const ROW_NUMBER_LABELS = new Set(['STT', 'STT.', 'NO', 'NO.', '#']);

const flattenChildren = (children) => Children.toArray(children).flatMap((child) => {
  if (isValidElement(child) && child.type === Fragment) return flattenChildren(child.props?.children);
  return [child];
});

const extractText = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(' ').trim();
  if (!isValidElement(node)) return '';

  const props = node.props || {};
  for (const key of ['sortValue', 'status', 'label', 'value', 'title', 'aria-label']) {
    const value = props[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return extractText(props.children);
};

const normalizeHeader = (value) => String(value || '').trim().toUpperCase();

const asComparable = (value) => {
  const text = String(value ?? '').trim();
  if (!text || text === '—' || text === '-') return { empty: true, type: 'text', value: '' };

  const numeric = Number(text.replace(/[,%$€£\s]/g, ''));
  if (Number.isFinite(numeric) && /\d/.test(text)) return { empty: false, type: 'number', value: numeric };

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (iso) return { empty: false, type: 'number', value: Number(`${iso[1]}${iso[2]}${iso[3]}`) };

  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return { empty: false, type: 'number', value: Number(`${dmy[3]}${String(dmy[2]).padStart(2, '0')}${String(dmy[1]).padStart(2, '0')}`) };

  return { empty: false, type: 'text', value: text.toLocaleLowerCase() };
};

const compare = (left, right, direction) => {
  const a = asComparable(left);
  const b = asComparable(right);
  if (a.empty && b.empty) return 0;
  if (a.empty) return 1;
  if (b.empty) return -1;

  let result;
  if (a.type === 'number' && b.type === 'number') result = a.value - b.value;
  else result = String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'desc' ? -result : result;
};

const directCells = (row) => {
  if (!isValidElement(row)) return [];
  return flattenChildren(row.props?.children).filter((child) => isValidElement(child));
};

const isDataRow = (row) => {
  if (!isValidElement(row)) return false;
  const cells = directCells(row);
  return cells.length > 1 && !cells.some((cell) => Number(cell.props?.colSpan || 1) > 1);
};

const getHeaderRows = (head) => {
  if (!isValidElement(head)) return [];
  return flattenChildren(head.props?.children).filter((row) => isValidElement(row));
};

const getExplicitRowNumberIndex = (head) => {
  const rows = getHeaderRows(head);
  if (!rows.length) return -1;
  const cells = directCells(rows[0]);
  return cells.findIndex((cell) => ROW_NUMBER_LABELS.has(normalizeHeader(extractText(cell.props?.children))));
};

const transformHeaderRow = (row, sortIndex, direction, handleSort) => {
  if (!isValidElement(row)) return row;
  const cells = flattenChildren(row.props?.children);
  const nextCells = cells.map((cell, index) => {
    if (!isValidElement(cell)) return cell;
    const label = extractText(cell.props?.children).trim();
    const normalized = normalizeHeader(label);
    const blocked = cell.props?.['data-sortable'] === false || ACTION_LABELS.has(normalized) || ROW_NUMBER_LABELS.has(normalized) || !label;
    if (blocked) return cell;

    return cloneElement(cell, {
      sortDirection: sortIndex === index ? direction : false,
      children: (
        <TableSortLabel
          active={sortIndex === index}
          direction={sortIndex === index ? direction : 'asc'}
          onClick={(event) => {
            event.stopPropagation();
            handleSort(index);
          }}
          sx={{ fontWeight: 'inherit', color: 'inherit !important' }}
        >
          {cell.props?.children}
        </TableSortLabel>
      )
    });
  });
  return cloneElement(row, {}, nextCells);
};

const transformHead = (head, sortIndex, direction, handleSort, injectRowNumber) => {
  if (!isValidElement(head)) return head;
  const originalRows = getHeaderRows(head);
  const rows = originalRows.map((row, rowIndex) => {
    const transformed = transformHeaderRow(row, sortIndex, direction, handleSort);
    if (!injectRowNumber || rowIndex !== 0 || !isValidElement(transformed)) return transformed;

    const cells = flattenChildren(transformed.props?.children);
    const sequenceCell = (
      <TableCell
        key="__row_number__"
        data-sortable={false}
        rowSpan={Math.max(1, originalRows.length)}
        align="center"
        sx={{ fontWeight: 800, width: 64, minWidth: 64, whiteSpace: 'nowrap' }}
      >
        STT
      </TableCell>
    );
    return cloneElement(transformed, {}, [sequenceCell, ...cells]);
  });
  return cloneElement(head, {}, rows);
};

const replaceOrInjectRowNumber = (row, number, explicitIndex, injectRowNumber) => {
  if (!isValidElement(row)) return row;
  const cells = directCells(row);

  if (isDataRow(row)) {
    const sequenceCell = (
      <TableCell
        key="__row_number__"
        data-sort-value={number}
        align="center"
        sx={{ width: 64, minWidth: 64, whiteSpace: 'nowrap' }}
      >
        {number}
      </TableCell>
    );

    if (explicitIndex >= 0 && explicitIndex < cells.length) {
      const nextCells = [...cells];
      const original = nextCells[explicitIndex];
      nextCells[explicitIndex] = cloneElement(original, {
        key: original.key ?? '__row_number__',
        children: number,
        'data-sort-value': number,
        align: original.props?.align || 'center',
        sx: { width: 64, minWidth: 64, whiteSpace: 'nowrap', ...(original.props?.sx || {}) }
      });
      return cloneElement(row, {}, nextCells);
    }

    if (injectRowNumber) return cloneElement(row, {}, [sequenceCell, ...cells]);
    return row;
  }

  // Loading / empty-state rows usually span the entire table. Keep their colspan
  // aligned after the automatic STT column is inserted.
  if (injectRowNumber && cells.length === 1 && Number(cells[0].props?.colSpan || 1) > 1) {
    const cell = cells[0];
    return cloneElement(row, {}, cloneElement(cell, { colSpan: Number(cell.props.colSpan || 1) + 1 }));
  }

  return row;
};

const transformBody = (body, sortIndex, direction, rowNumberStart, explicitIndex, injectRowNumber) => {
  if (!isValidElement(body)) return body;
  const children = flattenChildren(body.props?.children);
  const sortable = children.filter(isDataRow);

  let orderedChildren = children;
  if (sortIndex !== null && sortable.length >= 2) {
    const positions = new Map(sortable.map((row, index) => [row, index]));
    const sorted = [...sortable].sort((a, b) => {
      const aCell = directCells(a)[sortIndex];
      const bCell = directCells(b)[sortIndex];
      const result = compare(extractText(aCell), extractText(bCell), direction);
      return result || positions.get(a) - positions.get(b);
    });

    let cursor = 0;
    orderedChildren = children.map((child) => (isDataRow(child) ? sorted[cursor++] : child));
  }

  let visibleRowIndex = 0;
  const numbered = orderedChildren.map((child) => {
    if (!isDataRow(child)) return replaceOrInjectRowNumber(child, null, explicitIndex, injectRowNumber);
    const number = Number(rowNumberStart || 0) + visibleRowIndex + 1;
    visibleRowIndex += 1;
    return replaceOrInjectRowNumber(child, number, explicitIndex, injectRowNumber);
  });

  return cloneElement(body, {}, numbered);
};

/**
 * Drop-in replacement for MUI <Table> that enables client-side sorting and
 * automatically adds a sequential STT column to list tables.
 *
 * - rowNumberStart: zero-based offset for paginated tables (page * pageSize).
 * - disableRowNumber: used by Carton Loading screens, where STT is intentionally hidden.
 * - Existing STT/No./# columns are reused rather than duplicated.
 */
export default function SortableTable({ children, rowNumberStart = 0, disableRowNumber = false, ...props }) {
  const [sortIndex, setSortIndex] = useState(null);
  const [direction, setDirection] = useState('asc');

  const handleSort = (index) => {
    if (sortIndex === index) setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSortIndex(index);
      setDirection('asc');
    }
  };

  const flat = flattenChildren(children);
  const head = flat.find((child) => isValidElement(child) && child.type === TableHead);
  const explicitRowNumberIndex = disableRowNumber ? -1 : getExplicitRowNumberIndex(head);
  const injectRowNumber = !disableRowNumber && Boolean(head) && explicitRowNumberIndex < 0;

  const transformed = flat.map((child) => {
    if (!isValidElement(child)) return child;
    if (child.type === TableHead) return transformHead(child, sortIndex, direction, handleSort, injectRowNumber);
    if (child.type === TableBody) return transformBody(child, sortIndex, direction, rowNumberStart, explicitRowNumberIndex, injectRowNumber);
    return child;
  });

  return <Table {...props}>{transformed}</Table>;
}

export { TableBody, TableCell, TableHead, TableRow };
