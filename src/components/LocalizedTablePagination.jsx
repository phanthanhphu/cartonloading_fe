import { TablePagination as MuiTablePagination } from '@mui/material';
import { useLanguage } from '../i18n/LanguageProvider';

/** One translation point for the pagination footer across every buyer and shared table. */
export default function LocalizedTablePagination({
  labelRowsPerPage,
  labelDisplayedRows,
  getItemAriaLabel,
  ...props
}) {
  const { language, t } = useLanguage();
  return (
    <MuiTablePagination
      {...props}
      labelRowsPerPage={labelRowsPerPage ? t(labelRowsPerPage) : t('Rows per page:')}
      labelDisplayedRows={labelDisplayedRows || (({ from, to, count }) => (
        language === 'vi'
          ? `${from}–${to} / ${count === -1 ? `hơn ${to}` : count}`
          : `${from}–${to} of ${count === -1 ? `more than ${to}` : count}`
      ))}
      getItemAriaLabel={getItemAriaLabel || ((type) => {
        const labels = { first: 'First page', last: 'Last page', next: 'Next page', previous: 'Previous page' };
        return t(labels[type] || type);
      })}
    />
  );
}
