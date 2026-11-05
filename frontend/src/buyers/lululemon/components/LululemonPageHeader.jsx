import { Box, Stack } from '@mui/material';

/**
 * Page identity is rendered once in the global AppBar.
 * Render a compact action/status line here only when needed.
 * Notifications live on each page and are never suppressed by this component.
 */
export function CompactPageHeader({ breadcrumbs, meta, actions, details }) {
  if (!breadcrumbs && !meta && !actions && !details) return null;
  return (
    <Stack spacing={0.45}>
      {breadcrumbs ? <Box sx={{ px: 0.15, '& .MuiBreadcrumbs-root': { fontSize: '0.74rem' } }}>{breadcrumbs}</Box> : null}
      {(meta || details || actions) ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={0.65}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          useFlexGap
          sx={{ minWidth: 0 }}
        >
          {(meta || details) ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center" sx={{ minWidth: 0 }}>
              {meta}
              {details}
            </Stack>
          ) : <Box sx={{ flex: 1 }} />}
          {actions ? (
            <Stack direction="row" spacing={0.45} flexWrap="wrap" useFlexGap alignItems="center"
              sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' }, '& .MuiButton-root': { textTransform: 'none', minHeight: 32 } }}>
              {actions}
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
