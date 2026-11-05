import { APP_MESSAGES } from '../constants/appMessages';
import { CODE128_PATTERNS } from '../constants/appConstants';

// Minimal Code 128-C encoder for numeric Factory Barcodes.
// Factory Barcode format is always numeric and even-length (YY + 3-digit factory + 9-digit sequence = 14 digits).

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export const code128Values = (rawValue) => {
  const value = String(rawValue || '').trim();
  if (!/^\d+$/.test(value) || value.length % 2 !== 0) {
    throw new Error(APP_MESSAGES.CODE128_EVEN_DIGITS_REQUIRED);
  }
  const values = [105]; // START C
  for (let index = 0; index < value.length; index += 2) {
    values.push(Number(value.slice(index, index + 2)));
  }
  let checksum = 105;
  for (let index = 1; index < values.length; index += 1) checksum += values[index] * index;
  values.push(checksum % 103);
  values.push(106); // STOP
  return values;
};

export const buildCode128Svg = (rawValue, options = {}) => {
  const value = String(rawValue || '').trim();
  const moduleWidth = Number(options.moduleWidth || 1.5);
  const barHeight = Number(options.barHeight || 54);
  const quietModules = Number(options.quietModules || 10);
  const showText = options.showText !== false;
  const fontSize = Number(options.fontSize || 14);
  const textGap = showText ? fontSize + 7 : 0;
  const values = code128Values(value);
  const patterns = values.map((code) => CODE128_PATTERNS[code]);
  const dataModules = patterns.reduce((sum, pattern) => (
    sum + [...pattern].reduce((inner, digit) => inner + Number(digit), 0)
  ), 0);
  const totalModules = dataModules + quietModules * 2;
  const width = totalModules * moduleWidth;
  const height = barHeight + textGap;

  let x = quietModules * moduleWidth;
  const bars = [];
  patterns.forEach((pattern) => {
    [...pattern].forEach((digit, index) => {
      const w = Number(digit) * moduleWidth;
      if (index % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="${barHeight}" fill="#000"/>`);
      x += w;
    });
  });

  const text = showText
    ? `<text x="${width / 2}" y="${barHeight + fontSize + 1}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="600" letter-spacing="0.4">${escapeXml(value)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="Factory Barcode ${escapeXml(value)}">${bars.join('')}${text}</svg>`;
};
