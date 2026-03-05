import React, { useState, useEffect } from "react";
import MainHMI from "./MainHMI";
import SplashScreen from "./components/SplashScreen";
import { initializeBackendNetId } from './services/netIdService';
import "./styles/App.css";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Initialize saved Net ID with backend on app load
    // Uses netIdService which checks Electron config file first, then localStorage
    const initializeNetID = async () => {
      try {
        const result = await initializeBackendNetId();
        if (result.success && result.netId) {
          console.log('[App] Backend Net ID initialized:', result.netId);
        } else {
          console.log('[App] No saved Net ID found, using backend default');
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
