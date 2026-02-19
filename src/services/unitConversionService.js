/**
 * Unit Conversion Service
 * Converts between mm and inches for PLC communication
 * PLC always expects inches
 */

const MM_TO_INCH = 0.03937008;  // 1 mm = 0.03937008 inches (or divide by 25.4)
const INCH_TO_MM = 25.4;

/**
 * Convert value to inches if in mm
 * @param {number} value - The value to convert
 * @param {string} unitSystem - 'mm' or 'inch'
 * @returns {number} Value in inches
 */
export const convertToInches = (value, unitSystem) => {
  if (!value && value !== 0) return 0;
  if (unitSystem === 'mm') {
    return parseFloat((value / INCH_TO_MM).toFixed(6));
  }
  return parseFloat(value);
};

/**
 * Convert value from inches to mm for display
 * @param {number} value - The value in inches
 * @param {string} unitSystem - 'mm' or 'inch'
 * @returns {number} Value in specified unit
 */
export const convertFromInches = (value, unitSystem) => {
  if (!value && value !== 0) return 0;
  if (unitSystem === 'mm') {
    return parseFloat((value * INCH_TO_MM).toFixed(2));
  }
  return parseFloat(value);
};

/**
 * Convert all position keys in a step to inches
 * @param {Object} positions - Position data with axis*Cmd keys
 * @param {string} unitSystem - 'mm' or 'inch'
 * @returns {Object} Converted positions
 */
export const convertPositionsToInches = (positions, unitSystem) => {
  if (!positions) return positions;
  
  const converted = { ...positions };
  const axisKeys = ['axis1Cmd', 'axis2Cmd', 'axis3Cmd', 'axis4Cmd'];
  
  axisKeys.forEach(key => {
    if (key in converted && converted[key] != null) {
      converted[key] = convertToInches(converted[key], unitSystem);
    }
  });
  
  return converted;
};

/**
 * Convert recipe parameters to inches
 * @param {Object} parameters - Recipe parameter object
 * @param {string} unitSystem - 'mm' or 'inch'
 * @returns {Object} Converted parameters
 */
export const convertRecipeParametersToInches = (parameters, unitSystem) => {
  if (!parameters) return parameters;
  
  const converted = { ...parameters };
  const dimensionKeys = ['tubeID', 'tubeOD', 'finalSize', 'tubeLength', 'idFingerRadius', 'depth'];
  
  dimensionKeys.forEach(key => {
    if (key in converted && converted[key] != null) {
      converted[key] = convertToInches(converted[key], unitSystem);
    }
  });
  
  return converted;
};

export default {
  convertToInches,
  convertFromInches,
  convertPositionsToInches,
  convertRecipeParametersToInches
};
