// src/pages/LoginPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  BusinessCenterOutlined,
  EmailOutlined,
  LockOutlined,
  LoginRounded,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';

// Keep this file at: src/assets/images/background/background_login.png
import backgroundLogin from '../assets/images/background/background_login.png';
import { apiRawClient } from './globalApi';
import {
  canAccessBuyer,
  getBuyerCatalog,
  normalizeBuyerPermissions,
  readSelectedBuyer,
  saveSelectedBuyer,
  setBuyerCatalog
} from '../utils/buyerAccess';
import { listAccessibleBuyers, listLoginBuyers } from '../services/buyerService';
import { getBuyerAccessLandingPath } from '../buyers/core/buyerModules';
import { AUTH_STORAGE_KEYS, ROLE, STORAGE_KEY } from '../constants/appConstants';
import { APP_MESSAGES, createLoginSuccessMessage } from '../constants/appMessages';

const DEFAULT_LOGIN_BUYER_CODE = getBuyerCatalog()[0]?.code || '';

const getSavedLoginDraft = (key) => {
  try {
    return sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const saveLoginDraft = (key, value) => {
  try {
    sessionStorage.setItem(key, value || '');
  } catch {
    // Ignore storage errors. The React state will still keep the value.
  }
};

const clearLoginDraft = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY.LOGIN_DRAFT_EMAIL);
    sessionStorage.removeItem(STORAGE_KEY.LOGIN_DRAFT_PASSWORD);
    sessionStorage.removeItem(STORAGE_KEY.LOGIN_DRAFT_BUYER);
  } catch {
    // Ignore storage errors.
  }
};

const decodeJwtPayload = (token) => {
  try {
    if (!token) return null;

    const base64Url = token.split('.')[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

const isTokenExpired = (token) => {
  const payload = decodeJwtPayload(token);

  if (!payload?.exp) {
    return false;
  }

  return payload.exp * 1000 <= Date.now();
};

const getUserIdFromUser = (user = {}) => {
  return user?.id || user?.userId || user?._id || user?.email || user?.sub || '';
};

const getUserRole = (user = {}, fallbackRole = '') => {
  return user?.role || user?.roles?.[0] || fallbackRole || '';
};

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const normalizePermission = (value) => String(value || '').trim().toUpperCase();

const isAdminRole = (role) => {
  const normalized = normalizeRole(role);
  return normalized === ROLE.ADMIN || normalized === ROLE.ROLE_ADMIN;
};

const getStoredUserForRedirect = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY.USER) || '{}') || {};
  } catch {
    return { role: localStorage.getItem(STORAGE_KEY.ROLE) || '' };
  }
};


const clearAuthSession = () => {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};


const persistAuthSession = ({ token, user, role }) => {
  const tokenPayload = decodeJwtPayload(token) || {};
  const safeUser = user && typeof user === 'object' ? user : {};
  const mergedUser = {
    email: tokenPayload.sub || safeUser.email || '',
    sub: tokenPayload.sub || safeUser.sub || '',
    role: safeUser.role || tokenPayload.role || role || '',
    ...safeUser
  };
  const userId = getUserIdFromUser(mergedUser) || tokenPayload.sub || '';
  const safeRole = getUserRole(mergedUser, role || tokenPayload.role || '');
  const safeAccessPermissions = Array.isArray(mergedUser.accessPermissions)
    ? mergedUser.accessPermissions.map(normalizePermission).filter(Boolean)
    : String(mergedUser.accessPermissions || tokenPayload.accessPermissions || '')
        .split(/[,;|]/).map(normalizePermission).filter(Boolean);
  const safeBuyerPermissions = normalizeBuyerPermissions(
    mergedUser.buyerPermissions || tokenPayload.buyerPermissions || [],
    isAdminRole(safeRole)
  );
  const safeFactoryPermissions = Array.isArray(mergedUser.factoryPermissions)
    ? mergedUser.factoryPermissions
    : String(mergedUser.factoryPermissions || '').split(/[,;|]/).map((value) => value.trim()).filter(Boolean);

  const storedUser = {
    ...mergedUser,
    role: safeRole,
    accessPermissions: safeAccessPermissions,
    buyerPermissions: safeBuyerPermissions,
    factoryPermissions: safeFactoryPermissions
  };

  localStorage.setItem(STORAGE_KEY.TOKEN, token);
  localStorage.setItem(STORAGE_KEY.ACCESS_TOKEN, token);
  localStorage.setItem(STORAGE_KEY.USER, JSON.stringify(storedUser));
  localStorage.setItem(STORAGE_KEY.USER_ID, userId);
  localStorage.setItem(STORAGE_KEY.IS_AUTHENTICATED, 'true');
  localStorage.setItem(STORAGE_KEY.ROLE, safeRole);
  localStorage.setItem(STORAGE_KEY.ACCESS_PERMISSIONS, JSON.stringify(safeAccessPermissions));
  localStorage.setItem(STORAGE_KEY.BUYER_PERMISSIONS, JSON.stringify(safeBuyerPermissions));
  localStorage.setItem(STORAGE_KEY.FACTORY_PERMISSIONS, JSON.stringify(safeFactoryPermissions));
  localStorage.setItem(STORAGE_KEY.LOGIN_AT, new Date().toISOString());
};


export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState(() => getSavedLoginDraft(STORAGE_KEY.LOGIN_DRAFT_EMAIL));
  const [password, setPassword] = useState(() => getSavedLoginDraft(STORAGE_KEY.LOGIN_DRAFT_PASSWORD));
  const [selectedBuyerCode, setSelectedBuyerCode] = useState(
    () => getSavedLoginDraft(STORAGE_KEY.LOGIN_DRAFT_BUYER) || DEFAULT_LOGIN_BUYER_CODE
  );
  const [buyerOptions, setBuyerOptions] = useState(() => getBuyerCatalog().filter((buyer) => buyer.active));
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY.TOKEN);

    if (!token) return;

    if (isTokenExpired(token)) {
      clearAuthSession();
      return;
    }

    const storedUser = getStoredUserForRedirect();
    const selectedBuyer = readSelectedBuyer();
    if (selectedBuyer && canAccessBuyer(selectedBuyer.code, storedUser)) {
      navigate(getBuyerAccessLandingPath(selectedBuyer), { replace: true });
      return;
    }

    // Older sessions may not have a Buyer saved because Buyer selection used
    // to happen in a popup after login. Force a fresh login so the Buyer is
    // selected together with the credentials.
    clearAuthSession();
  }, [navigate]);

  useEffect(() => {
    let active = true;
    listLoginBuyers()
      .then((rows) => {
        if (!active || !Array.isArray(rows) || !rows.length) return;
        const catalog = setBuyerCatalog(rows).filter((buyer) => buyer.active);
        setBuyerOptions(catalog);
        if (!catalog.some((buyer) => buyer.code === selectedBuyerCode)) {
          setSelectedBuyerCode(catalog[0]?.code || '');
        }
      })
      .catch(() => {
        // The cached Buyer catalog remains available when the API is offline.
      });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanEmail = email.trim();

    if (!cleanEmail || !password || !selectedBuyerCode) {
      const message = APP_MESSAGES.LOGIN_REQUIRED_FIELDS;
      setLoginError(message);
      toast.error(message);
      return;
    }

    setSubmitting(true);
    setLoginError('');

    try {
      const res = await apiRawClient.post(
        '/api/auth/login',
        { email: cleanEmail, password, buyerCode: selectedBuyerCode },
        {
          headers: { 'Content-Type': 'application/json' },
          validateStatus: () => true,
        }
      );

      const data = res?.data || null;
      const token = data?.token || data?.accessToken || data?.jwt || data?.data?.token || data?.data?.accessToken || '';
      const tokenPayload = decodeJwtPayload(token) || {};
      const loggedInUser = data?.user || data?.data?.user || data?.currentUser || {};
      const loggedInRole = getUserRole(loggedInUser, data?.role || data?.data?.role || tokenPayload?.role || '');

      if (res.status >= 200 && res.status < 300 && token) {
        persistAuthSession({
          token,
          user: loggedInUser,
          role: loggedInRole
        });

        try {
          const accessible = await listAccessibleBuyers();
          if (Array.isArray(accessible) && accessible.length) setBuyerCatalog(accessible);
        } catch {
          // Keep login options; authorization is still checked from the User payload.
        }

        const storedUser = getStoredUserForRedirect();
        if (!canAccessBuyer(selectedBuyerCode, storedUser)) {
          clearAuthSession();
          const message = APP_MESSAGES.LOGIN_BUYER_ACCESS_DENIED;
          setLoginError(message);
          toast.error(message);
          return;
        }

        const selectedBuyer = saveSelectedBuyer(selectedBuyerCode);
        if (!selectedBuyer) {
          clearAuthSession();
          const message = APP_MESSAGES.LOGIN_BUYER_INVALID;
          setLoginError(message);
          toast.error(message);
          return;
        }

        clearLoginDraft();
        const landingPath = getBuyerAccessLandingPath(selectedBuyer);
        toast.success(createLoginSuccessMessage(selectedBuyer.label));
        navigate(landingPath, { replace: true });

        return;
      }

      let message = data?.message || APP_MESSAGES.LOGIN_BAD_CREDENTIALS;

      if (res.status >= 200 && res.status < 300 && !token) {
        message = APP_MESSAGES.LOGIN_TOKEN_MISSING;
      }

      if (res.status === 401 || res.status === 404) {
        message = APP_MESSAGES.LOGIN_BAD_CREDENTIALS;
      }

      if (res.status === 403) {
        message = data?.message || APP_MESSAGES.LOGIN_ACCOUNT_DISABLED;
      }

      clearAuthSession();

      // Keep both email and password so the user can correct only the wrong field.
      setEmail(cleanEmail);
      setPassword(password);
      saveLoginDraft(STORAGE_KEY.LOGIN_DRAFT_EMAIL, cleanEmail);
      saveLoginDraft(STORAGE_KEY.LOGIN_DRAFT_PASSWORD, password);
      saveLoginDraft(STORAGE_KEY.LOGIN_DRAFT_BUYER, selectedBuyerCode);
      setLoginError(message);
      toast.error(message);
    } catch (err) {
      console.error(err);
      const message = APP_MESSAGES.LOGIN_SERVER_UNREACHABLE;
      setLoginError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        /* Desktop only: preserve the PC layout at every zoom level. */
        overflow: 'auto',
        p: 3,
        backgroundColor: '#EAF2F4',
        backgroundImage: `
          linear-gradient(
            100deg,
            rgba(234, 242, 244, 0.68) 0%,
            rgba(234, 242, 244, 0.52) 56%,
            rgba(234, 242, 244, 0.64) 100%
          ),
          url(${backgroundLogin})
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >

      <Box
        sx={{
          width: 'min(1120px, calc(100vw - 48px))',
          minWidth: 980,
          overflow: 'hidden',
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'row',
          boxShadow: '0 28px 85px rgba(3, 22, 35, 0.28)',
          border: `1px solid ${alpha('#FFFFFF', 0.38)}`,
          backgroundColor: alpha('#FFFFFF', 0.14),
          backdropFilter: 'blur(4px)'
        }}
      >
        {/* Simple product message */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            minHeight: 'min(590px, 78vh)',
            p: 5.5,
            color: '#FFFFFF',
            position: 'relative',
            overflow: 'hidden',
            /*
             * Put the image directly on this panel instead of relying only on the
             * page background. This keeps the garment / carton operations illustration
             * visible even when the card is above a light page background.
             */
            backgroundImage: `
              linear-gradient(
                145deg,
                rgba(4, 27, 45, 0.62) 0%,
                rgba(8, 73, 91, 0.54) 100%
              ),
              url(${backgroundLogin})
            `,
            backgroundSize: 'cover',
            backgroundPosition: 'left center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              width: 360,
              height: 360,
              top: -175,
              right: -165,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(72, 206, 185, 0.3), rgba(72, 206, 185, 0) 68%)'
            }}
          />
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              width: '100%'
            }}
          >
            <Box>
              <Typography
                sx={{
                  mt: 0.4,
                  fontSize: '3rem',
                  lineHeight: 1.05,
                  letterSpacing: -1.2,
                  fontWeight: 950
                }}
              >
                Order Scan & Weight
              </Typography>

              <Typography
                sx={{
                  mt: 1.1,
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: '#9DEBD9'
                }}
              >
                Operations Workspace
              </Typography>

              <Typography
                sx={{
                  mt: 2.1,
                  maxWidth: 300,
                  fontSize: '0.96rem',
                  lineHeight: 1.65,
                  color: alpha('#FFFFFF', 0.82)
                }}
              >
                Scan QA Codes with Zebra USB and receive carton weights automatically from PLC.
              </Typography>
            </Box>

            <Typography sx={{ fontSize: '0.78rem', color: alpha('#FFFFFF', 0.62) }}>
              Youngone Internal System
            </Typography>
          </Box>
        </Box>

        {/* Sign-in panel */}
        <Box
          sx={{
            width: 455,
            minWidth: 455,
            minHeight: 'min(590px, 78vh)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 5.5,
            py: 5,
            backgroundColor: alpha('#F9FCFD', 0.96)
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 350 }}>
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar />

            <Typography
              sx={{
                fontSize: '2.1rem',
                fontWeight: 950,
                lineHeight: 1.1,
                letterSpacing: -0.8,
                color: '#092E4A'
              }}
            >
              Sign in
            </Typography>

            <Typography sx={{ mt: 0.9, fontSize: '0.94rem', color: alpha('#092E4A', 0.62) }}>
              Order Scan & PLC Weight System
            </Typography>

            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 3.25 }}>
              <Stack spacing={2}>
                <TextField
                  label="Company email"
                  placeholder="name@youngonevn.com"
                  value={email}
                  onChange={(e) => {
                    const nextEmail = e.target.value;
                    setEmail(nextEmail);
                    saveLoginDraft(STORAGE_KEY.LOGIN_DRAFT_EMAIL, nextEmail);
                    if (loginError) setLoginError('');
                  }}
                  autoComplete="email"
                  fullWidth
                  InputLabelProps={{ sx: { fontWeight: 750 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlined sx={{ color: alpha('#0B5A76', 0.62), fontSize: 20 }} />
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2.5,
                      backgroundColor: '#FFFFFF',
                      '& fieldset': { borderColor: alpha('#0B5A76', 0.2) },
                      '&:hover fieldset': { borderColor: alpha('#0B5A76', 0.45) },
                      '&.Mui-focused fieldset': { borderColor: '#0B6E8A' }
                    }
                  }}
                />

                <TextField
                  label="Password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    const nextPassword = e.target.value;
                    setPassword(nextPassword);
                    saveLoginDraft(STORAGE_KEY.LOGIN_DRAFT_PASSWORD, nextPassword);
                    if (loginError) setLoginError('');
                  }}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  fullWidth
                  InputLabelProps={{ sx: { fontWeight: 750 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ color: alpha('#0B5A76', 0.62), fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPw ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPw((previous) => !previous)}
                          edge="end"
                        >
                          {showPw ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  error={Boolean(loginError)}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2.5,
                      backgroundColor: '#FFFFFF',
                      '& fieldset': { borderColor: alpha('#0B5A76', 0.2) },
                      '&:hover fieldset': { borderColor: alpha('#0B5A76', 0.45) },
                      '&.Mui-focused fieldset': { borderColor: '#0B6E8A' }
                    }
                  }}
                />

                <TextField
                  select
                  label="Buyer"
                  value={selectedBuyerCode}
                  onChange={(e) => {
                    const nextBuyer = e.target.value;
                    setSelectedBuyerCode(nextBuyer);
                    saveLoginDraft(STORAGE_KEY.LOGIN_DRAFT_BUYER, nextBuyer);
                    if (loginError) setLoginError('');
                  }}
                  fullWidth
                  InputLabelProps={{ sx: { fontWeight: 750 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <BusinessCenterOutlined sx={{ color: alpha('#0B5A76', 0.62), fontSize: 20 }} />
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2.5,
                      backgroundColor: '#FFFFFF',
                      '& fieldset': { borderColor: alpha('#0B5A76', 0.2) },
                      '&:hover fieldset': { borderColor: alpha('#0B5A76', 0.45) },
                      '&.Mui-focused fieldset': { borderColor: '#0B6E8A' }
                    }
                  }}
                >
                  <MenuItem value="" disabled>
                    Select Buyer
                  </MenuItem>
                  {buyerOptions.map((buyer) => (
                    <MenuItem key={buyer.code} value={buyer.code}>
                      {buyer.label}
                    </MenuItem>
                  ))}
                </TextField>

                {loginError && (
                  <Box
                    sx={{
                      p: 1.2,
                      borderRadius: 2,
                      border: `1px solid ${alpha('#DC2626', 0.28)}`,
                      backgroundColor: alpha('#DC2626', 0.07)
                    }}
                  >
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 750, color: '#B91C1C', lineHeight: 1.45 }}>
                      {loginError}
                    </Typography>
                  </Box>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  variant="contained"
                  startIcon={<LoginRounded />}
                  sx={{
                    height: 53,
                    mt: 0.5,
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 900,
                    fontSize: '1rem',
                    background: 'linear-gradient(90deg, #0A5E7A 0%, #087A73 100%)',
                    boxShadow: '0 14px 30px rgba(7, 108, 117, 0.26)',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #084F68 0%, #06665F 100%)'
                    }
                  }}
                >
                  {submitting ? 'Signing in...' : 'Sign in'}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
