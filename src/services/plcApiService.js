// plcApiService.js
// Service for communicating with local Node.js ADS backend

const API_BASE = 'http://localhost:3001';

export async function readPLCVar() {
  const res = await fetch(`${API_BASE}/read`);
  if (!res.ok) throw new Error('Failed to read from PLC');
  const data = await res.json();
  return data.value;
}

export async function writePLCVar(value) {
  const res = await fetch(`${API_BASE}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value })
  });
  if (!res.ok) throw new Error('Failed to write to PLC');
}
