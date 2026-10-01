// Minimal Code 128-C encoder for numeric Factory Barcodes.
// Factory Barcode format is always numeric and even-length (YY + 3-digit factory + 9-digit sequence = 14 digits).
const CODE128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212',
  '112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131',
  '311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321',
  '112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121',
  '313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114',
  '122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212',
  '124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'
];

const escapeXml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export const code128Values = (rawValue) => {
  const value = String(rawValue || '').trim();
  if (!/^\d+$/.test(value) || value.length % 2 !== 0) {
    throw new Error('Code 128-C requires an even number of numeric digits.');
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
