import {
  DEFAULT_SCALE_MINIMUM_WEIGHT_KG,
  DEFAULT_SCALE_STABILITY_TOLERANCE_KG,
  DEFAULT_SCALE_STATION_FORM
} from '../../../../constants/appConstants';

export { DEFAULT_SCALE_STATION_FORM as EMPTY_SCALE_STATION_FORM } from '../../../../constants/appConstants';

export const toScaleStationForm = (row) => ({
  stationCode: row?.stationCode || '',
  stationName: row?.stationName || '',
  plcIp: row?.plcIp || '',
  gatewayIp: row?.gatewayIp || '',
  location: row?.location || '',
  active: row?.active !== false,
  minimumWeightKg: row?.minimumWeightKg ?? DEFAULT_SCALE_MINIMUM_WEIGHT_KG,
  stabilityToleranceKg: row?.stabilityToleranceKg ?? DEFAULT_SCALE_STABILITY_TOLERANCE_KG
});
