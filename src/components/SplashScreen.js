import React, { useState, useEffect } from 'react';
import '../styles/SplashScreen.css';

const SplashScreen = ({ isVisible = true, onComplete }) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 25;
      });
    }, 300);

    // After 3 seconds, complete the splash and fade out
    const fadeTimer = setTimeout(() => {
      setLoadingProgress(100);
      setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 600); // Duration of fade out animation
      }, 200);
    }, 2800);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(fadeTimer);
    };
  }, [isVisible, onComplete]);

  if (!isVisible && fadeOut) return null;

  return (
    <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
      {/* Background with gradient */}
      <div className="splash-background">
        <div className="splash-gradient-overlay"></div>
        <div className="splash-animated-shapes">
          <div className="splash-shape-1"></div>
          <div className="splash-shape-2"></div>
          <div className="splash-shape-3"></div>
        </div>
      </div>

      {/* Content */}
      <div className="splash-content">
        {/* Logo/Icon */}
        <div className="splash-icon">
          <div className="splash-icon-inner">🏭</div>
        </div>

        {/* App Name */}
        <h1 className="splash-title">UFM CNC</h1>
        <p className="splash-subtitle">ENDFORMER CONTROL SYSTEM</p>

        {/* Loading indicator */}
        <div className="splash-loading-section">
          <div className="splash-spinner">
            <div className="splash-spinner-ring"></div>
            <div className="splash-spinner-ring"></div>
            <div className="splash-spinner-ring"></div>
          </div>

          <div className="splash-status-text">Initializing System...</div>

          {/* Progress bar */}
          <div className="splash-progress-container">
            <div className="splash-progress-bar">
              <div
                className="splash-progress-fill"
                style={{ width: `${Math.min(loadingProgress, 100)}%` }}
              ></div>
            </div>
            <span className="splash-progress-percent">
              {Math.round(Math.min(loadingProgress, 100))}%
            </span>
          </div>

          {/* Loading text */}
          <div className="splash-loading-text">
            <span className="splash-dot splash-dot-1">.</span>
            <span className="splash-dot splash-dot-2">.</span>
            <span className="splash-dot splash-dot-3">.</span>
          </div>
        </div>

        {/* Version info */}
        <div className="splash-footer">
          <p className="splash-version">Version 1.0.0</p>
          <p className="splash-info">Advanced CNC Control Interface</p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
