import { useEffect } from 'react';
import { FEEDBACK_DURATION_MS } from '../constants/appConstants';

/**
 * Clear transient action feedback after a short interval.
 * Does not touch static warnings or saved workflow status.
 * The equality guard prevents a previous operation from dismissing newer feedback.
 * A new value cancels the previous timer; unmount also cancels it.
 *
 * @param {string|object|null} feedback State value (or {severity, text}).
 * @param {function} setFeedback React state setter.
 * @param {*} emptyValue Reset state value (usually '' or null).
 * @param {'success'|'error'|'info'} fallbackSeverity Type for plain strings.
 */
export default function useAutoDismissFeedback(feedback, setFeedback, emptyValue = '', fallbackSeverity = 'success') {
  useEffect(() => {
    if (!feedback || (typeof feedback === 'object' && feedback.open === false)) return undefined;
    const severity = typeof feedback === 'object' ? (feedback.severity || fallbackSeverity) : fallbackSeverity;
    const timeout = severity === 'error' ? FEEDBACK_DURATION_MS.ERROR
      : severity === 'info' ? FEEDBACK_DURATION_MS.INFO : FEEDBACK_DURATION_MS.SUCCESS;
    const timer = window.setTimeout(() => {
      setFeedback(current => Object.is(current, feedback) ? emptyValue : current);
    }, timeout);
    return () => window.clearTimeout(timer);
  }, [feedback, setFeedback, emptyValue, fallbackSeverity]);
}
