import { useState } from 'react';
import { Box, Button, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useLanguage } from '../../../../i18n/LanguageProvider';

const OPTIONS = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' }
];

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const [anchorEl, setAnchorEl] = useState(null);
  const closeMenu = () => setAnchorEl(null);
  return (
    <>
      <Tooltip title={t('Language')}>
        <Button
          size="small"
          variant="outlined"
          aria-label={t('Language')}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchorEl)}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          startIcon={<PublicOutlinedIcon sx={{ fontSize: 19 }} />}
          endIcon={<KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            width: { xs: 110, sm: 120 }, minWidth: { xs: 110, sm: 120 }, maxWidth: { xs: 110, sm: 120 },
            height: 38, flexShrink: 0, boxSizing: 'border-box', px: 1.0, color: '#2D4358',
            borderColor: '#DCE6F0', borderRadius: '6px', fontWeight: 750,
            '&:hover': { bgcolor: '#F4F8FD', borderColor: '#A7BFDB' }
          }}
        >
          {language === 'vi' ? 'VN' : 'EN'}
        </Button>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ 'aria-label': t('Language') }}
        PaperProps={{ sx: { mt: 0.6, minWidth: 185, borderRadius: '8px', boxShadow: '0 8px 32px rgba(24,54,88,.12)' } }}
      >
        {OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            selected={language === option.value}
            onClick={() => { setLanguage(option.value); closeMenu(); }}
            sx={{ minHeight: 39, gap: 1.1 }}
          >
            <Box component="span" sx={{ fontSize: 18, lineHeight: 1 }}>{option.flag}</Box>
            <ListItemText primary={option.label} primaryTypographyProps={{ fontSize: 13, fontWeight: language === option.value ? 700 : 500 }} />
            <ListItemIcon sx={{ minWidth: 22, justifyContent: 'flex-end' }}>
              {language === option.value ? <CheckRoundedIcon fontSize="small" color="primary" /> : null}
            </ListItemIcon>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
