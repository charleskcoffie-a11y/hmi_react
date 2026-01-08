import React, { useState, useEffect } from "react";
import MainHMI from "./MainHMI";
import SplashScreen from "./components/SplashScreen";
import "./styles/App.css";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Splash screen is shown by default, will fade out after 3 seconds
    // The SplashScreen component handles the timing
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
