const BASE_URL = 'http://localhost:3001';

// Fetch the IO map
export async function getIoMap() {
  try {
    const response = await fetch(`${BASE_URL}/io-map`);
    const data = await response.json();
    return data.buttons || [];
  } catch (err) {
    console.error('[ioService] Failed to fetch IO map:', err);
    return [];
  }
}

// Pulse a button by index (momentary)
export async function pulseButton(index, durationMs = 150) {
  try {
    const response = await fetch(`${BASE_URL}/io/pulse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, durationMs })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Pulse failed');
    }
    return result;
  } catch (err) {
    console.error(`[ioService] Pulse index ${index} failed:`, err);
    throw err;
  }
}

// Write a boolean value by index
export async function writeBoolean(index, value) {
  try {
    const response = await fetch(`${BASE_URL}/io/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index, value })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Write failed');
    }
    return result;
  } catch (err) {
    console.error(`[ioService] Write index ${index} failed:`, err);
    throw err;
  }
}

// Read multiple indices (for outputs/status)
export async function readIndices(indexes) {
  try {
    const response = await fetch(`${BASE_URL}/io/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indexes })
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Read failed');
    }
    return data.results; // { index: { value, error }, ... }
  } catch (err) {
    console.error('[ioService] Read indices failed:', err);
    throw err;
  }
}

// Helper to filter IO map by direction and index range
export function filterIoMap(ioMap, { direction, minIndex, maxIndex, side } = {}) {
  return ioMap.filter(item => {
    if (direction && item.direction !== direction) return false;
    if (minIndex !== undefined && item.index < minIndex) return false;
    if (maxIndex !== undefined && item.index > maxIndex) return false;
    if (side === 'left' && item.index >= 40) return false;
    if (side === 'right' && item.index < 40) return false;
    return true;
  });
}
