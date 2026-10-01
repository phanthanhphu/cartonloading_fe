import { Box, Paper, Stack, Typography } from '@mui/material';

export function CompactPageHeader({ title, subtitle, breadcrumbs, meta, actions, details }) {
  return (
    <Stack spacing={0.75}>
      {breadcrumbs ? <Box sx={{ px: 0.25, '& .MuiBreadcrumbs-root': { fontSize: '0.78rem', color: '#6B7F93' } }}>{breadcrumbs}</Box> : null}
      <Paper
        variant="outlined"
        sx={{
          px: { xs: 1.4, md: 1.75 },
          py: { xs: 1.15, md: 1.35 },
          borderRadius: 2.25,
          bgcolor: '#FFFFFF',
          borderColor: '#DFE7EF',
          boxShadow: '0 1px 2px rgba(30, 55, 80, 0.035)'
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ md: 'center' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography sx={{ fontSize: { xs: '1rem', md: '1.08rem' }, fontWeight: 760, lineHeight: 1.25, color: '#20364D' }}>{title}</Typography>
              {meta}
            </Stack>
            {subtitle ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3, maxWidth: 900 }}>{subtitle}</Typography> : null}
            {details ? <Box sx={{ mt: 0.8 }}>{details}</Box> : null}
          </Box>
          {actions ? <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>{actions}</Stack> : null}
        </Stack>
      </Paper>
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
