// Service to initialize backend with saved Net ID from localStorage

export async function initializeBackendNetId() {
  try {
    const savedNetID = localStorage.getItem('ams_net_id');
    
    if (savedNetID) {
      console.log('[netIdService] Sending saved Net ID to backend:', savedNetID);
      const res = await fetch('http://localhost:3001/set-net-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ netId: savedNetID })
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('[netIdService] Backend Net ID initialized:', data.message);
        return { success: true, netId: savedNetID };
      } else {
        console.warn('[netIdService] Failed to initialize backend Net ID');
        return { success: false };
      }
    } else {
      console.log('[netIdService] No saved Net ID found, using backend default');
      return { success: true, netId: null };
    }
  } catch (err) {
    console.error('[netIdService] Error initializing backend Net ID:', err);
    return { success: false, error: err.message };
  }
}
