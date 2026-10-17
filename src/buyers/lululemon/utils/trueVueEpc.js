/** Preview helper only. Backend TrueVueDecoder remains authoritative for verification. */
export const numericSkuKey = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return /^\d+$/.test(text) ? (text.replace(/^0+(?=\d)/, '') || '0') : text.toUpperCase();
};

/** Accept a 96-bit TrueVUE EPC (24 HEX) or PM86 PC + EPC (28 HEX). */
export function decodeTrueVueEpc(input) {
  const raw = String(input ?? '').replace(/\s+/g, '').toUpperCase();
  let epc = raw;
  let pc = null;
  if (/^[0-9A-F]{28}$/.test(raw)) {
    pc = raw.slice(0, 4);
    const words = (parseInt(pc, 16) >>> 11) & 0x1f;
    if (words !== 6) return { raw, error: 'PC does not specify a 96-bit EPC' };
    epc = raw.slice(4);
  }
  if (!/^[0-9A-F]{24}$/.test(epc)) {
    return { raw, error: 'EPC must be 24 HEX characters or 28 HEX characters (PC + EPC)' };
  }
  const bits = BigInt(`0x${epc}`);
  if (Number(bits >> 84n) !== 0x3bd) {
    return { raw, epc, error: 'Invalid TrueVUE header (expected 3BD)' };
  }
  const productCode = ((bits >> 34n) & ((1n << 50n) - 1n)).toString();
  const serialNumber = (bits & ((1n << 34n) - 1n)).toString();
  if (serialNumber.length < 2) return { raw, epc, error: 'Serial number does not contain a vendor code' };
  return { raw, epc, pc, productCode, serialNumber, vendorCode: serialNumber.slice(0, 2) };
}

/** Backend stores one normalized EPC per physical tag; do not count repeated reads as items. */
export function getUniqueEpcRows(epcs, expectedSku, wrongSkuEpcs = [], crossCartonEpcs = []) {
  const expectedKey = numericSkuKey(expectedSku);
  const wrongSet = new Set(wrongSkuEpcs || []);
  const crossSet = new Set(crossCartonEpcs || []);
  const seen = new Set();
  return (epcs || []).map((epc) => decodeTrueVueEpc(epc)).filter((decoded) => {
    const identity = decoded.epc || decoded.raw;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).map((decoded) => {
    const sku = decoded.productCode ? decoded.productCode.padStart(12, '0') : null;
    const wrong = !!decoded.productCode && (wrongSet.has(decoded.epc) || numericSkuKey(decoded.productCode) !== expectedKey);
    const cross = crossSet.has(decoded.epc);
    return { ...decoded, sku, status: decoded.error ? 'INVALID' : cross ? 'DUPLICATE_CARTON' : wrong ? 'WRONG_SKU' : 'MATCH' };
  });
}
