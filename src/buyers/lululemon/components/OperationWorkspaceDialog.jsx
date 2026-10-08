import { Box, Dialog, DialogContent, IconButton, Stack, Typography, useMediaQuery } from '@mui/material';
import { CloseRounded } from '@mui/icons-material';

export default function OperationWorkspaceDialog({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
  maxWidth = 'xl',
  disableClose = false,
  contentSx = {}
}) {
  const handheld = useMediaQuery('(max-width:768px)');

  const handleClose = (_event, reason) => {
    if (disableClose && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
    if (!disableClose) onClose?.();
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth
      fullScreen={handheld}
      keepMounted
      disableEscapeKeyDown={disableClose}
      PaperProps={{
        sx: {
          width: handheld ? '100%' : 'min(98vw, 1700px)',
          maxWidth: handheld ? '100%' : 'min(98vw, 1700px)',
          height: handheld ? '100dvh' : 'min(94vh, 980px)',
          maxHeight: handheld ? '100dvh' : '94vh',
          m: handheld ? 0 : { xs: 0.5, md: 1.5 },
          borderRadius: handheld ? 0 : { xs: 1.5, md: 2.5 },
          overflow: 'hidden'
        }
      }}
    >
      <Box
        sx={{
          px: { xs: 1, md: 1.4 },
          pt: { xs: 'max(10px, env(safe-area-inset-top))', md: 0.8 },
          pb: 0.8,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 3
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={950} sx={{ lineHeight: 1.15 }}>{title}</Typography>
            {subtitle ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.15, whiteSpace: { xs: 'normal', md: 'nowrap' } }}
              >
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <Stack
            direction="row"
            spacing={0.6}
            alignItems="center"
            justifyContent="flex-end"
            useFlexGap
            flexWrap="wrap"
            sx={{ flexShrink: 0, '& .MuiButton-root': { minHeight: { xs: 42, md: 'auto' } } }}
          >
            {actions}
            <IconButton
              size="small"
              onClick={() => onClose?.()}
              disabled={disableClose}
              aria-label="Close operation window"
              title={disableClose ? 'Stop the active operation before closing.' : 'Close'}
              sx={{ width: { xs: 42, md: 34 }, height: { xs: 42, md: 34 } }}
            >
              <CloseRounded fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Box>
      <DialogContent
        dividers={false}
        sx={{
          p: { xs: 0.8, md: 1 },
          pb: { xs: 'max(12px, env(safe-area-inset-bottom))', md: 1 },
          bgcolor: '#F8FAFC',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          ...contentSx
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
