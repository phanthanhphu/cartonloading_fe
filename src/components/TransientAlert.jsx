import { useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import { FEEDBACK_DURATION_MS } from '../constants/appConstants';

/** One transient message; hides after five seconds without overwriting the parent's data. */
export default function TransientAlert({ messageKey, children, ...props }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), FEEDBACK_DURATION_MS.SUCCESS);
    return () => window.clearTimeout(timer);
  }, [messageKey]);
  return visible ? <Alert {...props}>{children}</Alert> : null;
}
