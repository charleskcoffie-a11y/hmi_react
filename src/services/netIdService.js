// Service to initialize backend with saved Net ID from config file or localStorage
// Use the contextBridge exposed API
const electron = window.electron || {};

export async function initializeBackendNetId() {
  try {
    let savedNetID = null;
    
    // Try to get Net ID from Electron config first
    if (electron.getNetId) {
      try {
        savedNetID = await electron.getNetId();
        console.log('[netIdService] Loaded Net ID from Electron config:', savedNetID);
      } catch (err) {
        console.warn('[netIdService] Failed to get Net ID from Electron:', err.message);
      }
    }
    
    // Fall back to localStorage
    if (!savedNetID) {
      savedNetID = localStorage.getItem('ams_net_id');
      console.log('[netIdService] Loaded Net ID from localStorage:', savedNetID);
    }
    
    if (savedNetID) {
      console.log('[netIdService] Sending saved Net ID to backend:', savedNetID);
      
      // Retry logic: the backend might not be fully listening yet
      let retries = 3;
      let lastErr = null;
      
      while (retries > 0) {
        try {
          const res = await fetch('http://localhost:3001/set-net-id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ netId: savedNetID })
          });
          
          if (res.ok) {
            const data = await res.json();
            console.log('[netIdService] Backend Net ID initialized:', data.message);
            // Also save to localStorage for backup
            localStorage.setItem('ams_net_id', savedNetID);
            return { success: true, netId: savedNetID };
          } else {
            console.warn('[netIdService] Failed to initialize backend Net ID');
            return { success: false };
          }
        } catch (err) {
          lastErr = err;
          retries--;
          if (retries > 0) {
            console.warn(`[netIdService] Backend not ready, retrying... (${retries} left)`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      console.error('[netIdService] Failed to reach backend after retries:', lastErr?.message);
      return { success: false, error: lastErr?.message };
    } else {
      console.log('[netIdService] No saved Net ID found, using backend default');
      return { success: true, netId: null };
    }
  } catch (err) {
    console.error('[netIdService] Error initializing backend Net ID:', err);
    return { success: false, error: err.message };
  }
}

// Function to save Net ID to both config and localStorage
export async function saveNetId(netId) {
  try {
    // Save to localStorage first (always available)
    localStorage.setItem('ams_net_id', netId);
    
    // Try to save to Electron config
    if (electron.saveNetId) {
      try {
        await electron.saveNetId(netId);
        console.log('[netIdService] Saved Net ID to Electron config:', netId);
      } catch (err) {
        console.warn('[netIdService] Failed to save Net ID to Electron config:', err.message);
      }
    }
    
    return { success: true };
  } catch (err) {
    console.error('[netIdService] Error saving Net ID:', err);
    return { success: false, error: err.message };
  }
}
