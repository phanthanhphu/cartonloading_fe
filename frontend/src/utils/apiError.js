export const getApiError = (error, fallback = 'Unable to complete the request.') => {
  const data = error?.response?.data;
  if (data?.fieldErrors && typeof data.fieldErrors === 'object') {
    const message = Object.values(data.fieldErrors).filter(Boolean).join(' • ');
    if (message) return message;
  }
  return data?.message || error?.message || fallback;
};

export default getApiError;
