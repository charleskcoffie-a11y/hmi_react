import React, { useState, useEffect } from "react";
import MainHMI from "./MainHMI";
import SplashScreen from "./components/SplashScreen";
import "./styles/App.css";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Initialize saved Net ID with backend on app load
    const initializeNetID = async () => {
      try {
        const savedNetID = localStorage.getItem('ams_net_id');
        if (savedNetID) {
          console.log('[App] Restoring saved Net ID:', savedNetID);
          const res = await fetch('http://localhost:3001/set-net-id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ netId: savedNetID })
          });
          const data = await res.json();
          if (data.success) {
            console.log('[App] Backend Net ID restored:', data.message);
          } else {
            console.warn('[App] Failed to restore Net ID:', data.error);
          }
        }
      } catch (err) {
        console.warn('[App] Could not initialize Net ID:', err.message);
        // Non-blocking - app continues even if this fails
      }
    };
    
    initializeNetID();
  }, []);

  return (
    <div className="app-container">
      <SplashScreen 
        isVisible={showSplash} 
        onComplete={() => setShowSplash(false)} 
      />
      {!showSplash && <MainHMI />}
    </div>
  );
}
