/**
 * Position Validation Service
 * Validates positions against configured min/max limits from Machine Parameters
 */

/**
 * Get machine parameters from localStorage
 * @returns {Object} Machine parameters object
 */
export function getMachineParameters() {
  const saved = localStorage.getItem('machineParameters');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('[positionValidationService] Failed to parse machine parameters');
    }
  }
  // Default values (stored in inches)
  return {
    minPosition: 0,
    maxPosition: 100,
  };
}

/**
 * Validate a single position value
 * @param {number} position - The position value to validate (in inches)
 * @param {string} axisName - Name of axis (e.g., 'ID', 'OD') for messages
 * @returns {Object} { isValid: boolean, message: string, clamped: number }
 */
export function validatePosition(position, axisName = 'Axis') {
  const params = getMachineParameters();
  const min = params.minPosition ?? 0;
  const max = params.maxPosition ?? 100;

  if (position < min) {
    return {
      isValid: false,
      message: `❌ ${axisName} position ${position.toFixed(2)} is below minimum ${min.toFixed(2)}`,
      clamped: min,
      warning: false
    };
  }

  if (position > max) {
    return {
      isValid: false,
      message: `⚠️ ${axisName} position ${position.toFixed(2)} exceeds maximum ${max.toFixed(2)}`,
      clamped: max,
      warning: true
    };
  }

  return {
    isValid: true,
    message: `✓ ${axisName} position valid (${position.toFixed(2)})`,
    clamped: position,
    warning: false
  };
}

/**
 * Validate multiple positions
 * @param {Object} positions - Object with axis names as keys and position values
 * @returns {Object} { isValid: boolean, messages: Array, violations: Array }
 */
export function validatePositions(positions) {
  const messages = [];
  const violations = [];

  for (const [axisName, value] of Object.entries(positions)) {
    if (value === undefined || value === null) continue;
    
    const result = validatePosition(value, axisName);
    if (!result.isValid) {
      messages.push(result.message);
      violations.push({
        axis: axisName,
        value,
        min: getMachineParameters().minPosition,
        max: getMachineParameters().maxPosition,
        type: result.warning ? 'exceeds' : 'below'
      });
    }
  }

  return {
    isValid: violations.length === 0,
    messages,
    violations,
    summary: violations.length > 0 
      ? `${violations.length} position(s) out of range` 
      : 'All positions valid'
  };
}

/**
 * Check if position is beyond max and return warning only (not an error)
 * @param {number} position - The position value to check
 * @param {string} axisName - Name of axis for messages
 * @returns {Object} { isBeyondMax: boolean, message: string }
 */
export function checkBeyondMax(position, axisName = 'Axis') {
  const params = getMachineParameters();
  const max = params.maxPosition ?? 100;

  if (position > max) {
    return {
      isBeyondMax: true,
      message: `⚠️ WARNING: ${axisName} position ${position.toFixed(2)} exceeds maximum ${max.toFixed(2)}`,
      excess: position - max
    };
  }

  return {
    isBeyondMax: false,
    message: ''
  };
}

/**
 * Clamp position to valid range
 * @param {number} position - The position value
 * @returns {number} Clamped position
 */
export function clampPosition(position) {
  const params = getMachineParameters();
  const min = params.minPosition ?? 0;
  const max = params.maxPosition ?? 100;
  return Math.max(min, Math.min(max, position));
}
