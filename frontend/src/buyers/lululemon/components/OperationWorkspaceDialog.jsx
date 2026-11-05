import { useEffect, useState } from 'react';
import { Box, Dialog, DialogContent, IconButton, Stack, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { CloseRounded, FullscreenExitRounded, FullscreenRounded } from '@mui/icons-material';

export default function OperationWorkspaceDialog({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
  maxWidth = 'xl',
  disableClose = false,
  allowMaximize = false,
  startMaximized = false,
  fitViewport = false,
  contentSx = {}
}) {
  const handheld = useMediaQuery('(max-width:768px)');
  const [maximized, setMaximized] = useState(false);
  const fullScreen = handheld || (allowMaximize && maximized);

  // Closing the workspace resets its size without touching the active weighing or RFID session.
  useEffect(() => {
    setMaximized(Boolean(open && startMaximized));
  }, [open, startMaximized]);

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
      fullScreen={fullScreen}
      keepMounted
      disableEscapeKeyDown={disableClose}
      PaperProps={{
        sx: {
          width: fullScreen ? '100%' : 'min(98vw, 1700px)',
          maxWidth: fullScreen ? '100%' : 'min(98vw, 1700px)',
          height: fitViewport ? '100dvh' : fullScreen ? '100dvh' : 'min(94vh, 980px)',
          maxHeight: fitViewport ? '100dvh' : fullScreen ? '100dvh' : '94vh',
          m: fitViewport ? 0 : fullScreen ? 0 : { xs: 0.5, md: 1.5 },
          borderRadius: fullScreen ? 0 : { xs: 1.5, md: 2.5 },
          overflow: 'hidden'
        }
      }}
    >
      <Box
        sx={{
          px: { xs: 1, md: 1.4 },
          pt: { xs: 'max(8px, env(safe-area-inset-top))', md: 0.5 },
          pb: 0.5,
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
            {allowMaximize && !handheld ? (
              <Tooltip title={maximized ? 'Restore window' : 'Expand to full screen'}>
                <IconButton
                  size="small"
                  onClick={() => setMaximized((previous) => !previous)}
                  aria-label={maximized ? 'Restore weighing window' : 'Expand weighing window to full screen'}
                  aria-pressed={maximized}
                  sx={{ width: 34, height: 34 }}
                >
                  {maximized ? <FullscreenExitRounded fontSize="small" /> : <FullscreenRounded fontSize="small" />}
                </IconButton>
              </Tooltip>
            ) : null}
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
          // Keep the LULULEMON workstation in one viewport on desktop.
          // Mobile/small viewports retain normal scrolling rather than clipping controls.
          overflowY: fitViewport ? { xs: 'auto', md: 'hidden' } : 'auto',
          overflowX: 'hidden',
          flex: '1 1 auto',
          minHeight: 0,
          display: fitViewport ? 'flex' : 'block',
          flexDirection: 'column',
          WebkitOverflowScrolling: 'touch',
          ...contentSx,
          // Very short laptop/browser windows must scroll rather than hide any action.
          ...(fitViewport ? { '@media (max-height: 680px)': { overflowY: 'auto' } } : {})
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
