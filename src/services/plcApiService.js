// plcApiService.js
// Service for communicating with local Node.js ADS backend

const API_BASE = 'http://localhost:3001';

export async function readPLCVar() {
  const res = await fetch(`${API_BASE}/read`);
  if (!res.ok) throw new Error('Failed to read from PLC');
  const data = await res.json();
  return data.value;
}

export async function readAxisPositions() {
  const res = await fetch(`${API_BASE}/read-axis-positions`);
  if (!res.ok) throw new Error('Failed to read axis positions');
  const data = await res.json();
  return data;
}

export async function writePLCVar(value) {
  const res = await fetch(`${API_BASE}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });
  if (!res.ok) throw new Error('Failed to write to PLC');
}

// Write a specific boolean tag
export async function writeBoolTag(tag, value) {
  const res = await fetch(`${API_BASE}/write-bool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, value })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to write boolean tag');
  return data;
}

// Pulse a momentary boolean tag (true, wait, then false)
export async function pulseBoolTag(tag, durationMs = 150) {
  const res = await fetch(`${API_BASE}/pulse-bool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, durationMs })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to pulse boolean tag');
  return data;
}
