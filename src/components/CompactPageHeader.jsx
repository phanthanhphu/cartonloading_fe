import { Box, Paper, Stack, Typography } from '@mui/material';

/** Global AppBar provides the page heading; keep only navigation, key facts and actions. */
export function CompactPageHeader({ breadcrumbs, meta, actions, details, dense = false }) {
  if (!breadcrumbs && !meta && !actions && !details) return null;
  return (
    <Stack spacing={dense ? 0.4 : 0.6}>
      {breadcrumbs ? <Box sx={{ px: 0.15, '& .MuiBreadcrumbs-root': { fontSize: '0.76rem', color: '#6B7F93' } }}>{breadcrumbs}</Box> : null}
      {(meta || details || actions) ? (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.65} justifyContent="space-between" alignItems={{ md: 'center' }} useFlexGap>
          {(meta || details) ? (
            <Stack direction="row" spacing={0.55} useFlexGap flexWrap="wrap" alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
              {meta}
              {details}
            </Stack>
          ) : <Box sx={{ flex: 1 }} />}
          {actions ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center" sx={{ justifyContent: { xs: 'flex-start', md: 'flex-end' }, '& .MuiButton-root': { minHeight: 32 } }}>
              {actions}
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

export function CompactToolbar({ children, sx }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.25,
        py: 0.9,
        borderRadius: 2.25,
        borderColor: '#DFE7EF',
        bgcolor: '#FFFFFF',
        boxShadow: '0 1px 2px rgba(30, 55, 80, 0.025)',
        ...sx
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} alignItems={{ md: 'center' }}>
        {children}
      </Stack>
    </Paper>
  );
}

export function CompactStat({ label, value }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="baseline" sx={{ px: 0.9, py: 0.45, borderRadius: 1.4, bgcolor: '#F5F8FB', border: '1px solid #EDF1F5' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={750} color="text.primary">{value ?? '—'}</Typography>
    </Stack>
  );
}
