import React, { useState, useEffect } from 'react';
import ModernDialog from './ModernDialog';
import NumericKeypad from './NumericKeypad';
import '../styles/LubePage.css';

export default function LubePage({ isOpen, onClose }) {
  const [selectedSide, setSelectedSide] = useState(null); // 'left' or 'right'
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadField, setKeypadField] = useState(null);
  const [pulsing, setPulsing] = useState(false);

  // Lube settings per side
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('lubeSettings');
    return saved ? JSON.parse(saved) : {
      left: { noOfShots: 3, pulseDelay: 500, cycleCountToLube: 100 },
      right: { noOfShots: 3, pulseDelay: 500, cycleCountToLube: 100 }
    };
  });

  // Cycles since last lube (read from localStorage)
  const [cyclesSinceLastLube, setCyclesSinceLastLube] = useState({ right: 0, left: 0 });

  // Update cycles counter from localStorage periodically
  useEffect(() => {
    if (!isOpen) return;
    
    const updateCycles = () => {
      const right = parseInt(localStorage.getItem('cyclesSinceLastLube_right') || '0', 10);
      const left = parseInt(localStorage.getItem('cyclesSinceLastLube_left') || '0', 10);
      setCyclesSinceLastLube({
        right: Number.isNaN(right) ? 0 : right,
        left: Number.isNaN(left) ? 0 : left
      });
    };
    
    updateCycles();
    const interval = setInterval(updateCycles, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('lubeSettings', JSON.stringify(settings));
  }, [settings]);

  const handlePulseLubeHead = async (side) => {
    if (pulsing) return;
    
    const tag = side === 'right' ? 'GIO.bLubeHead' : 'GIO.bLubeHeadSelected';
    const { noOfShots, pulseDelay } = settings[side];

    setPulsing(true);
    
    try {
      for (let i = 0; i < noOfShots; i++) {
        console.log(`[LubePage] Pulsing ${tag} - shot ${i + 1}/${noOfShots}`);
        
        // Pulse the button
        const response = await fetch('http://localhost:3001/io/pulse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag, duration: 200 })
        });

        if (!response.ok) {
          console.error(`[LubePage] Failed to pulse ${tag}`);
          break;
        }

        // Wait for pulse delay before next shot (except on last shot)
        if (i < noOfShots - 1) {
          await new Promise(resolve => setTimeout(resolve, pulseDelay));
        }
      }
    } catch (error) {
      console.error('[LubePage] Pulse error:', error);
    } finally {
      setPulsing(false);
    }
  };

  const handleFieldClick = (side, field) => {
    console.log('[LubePage] Opening keypad for', side, field);
    setSelectedSide(side);
    setKeypadField(field);
    setKeypadOpen(true);
  };

  const handleKeypadConfirm = (value) => {
    console.log('[LubePage] handleKeypadConfirm called with:', value, 'side:', selectedSide, 'field:', keypadField);
    if (selectedSide && keypadField) {
      const numValue = parseInt(value, 10);
      console.log('[LubePage] Parsed value:', numValue);
      setSettings(prev => {
        const updated = {
          ...prev,
          [selectedSide]: {
            ...prev[selectedSide],
            [keypadField]: numValue
          }
        };
        console.log('[LubePage] Updated settings:', updated);
        return updated;
      });
    }
    console.log('[LubePage] Closing keypad');
    setKeypadOpen(false);
    setKeypadField(null);
    setSelectedSide(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <ModernDialog isOpen={isOpen} onClose={onClose} onConfirm={onClose} title="Lubrication Control">
        <div className="lube-page">
          <div className="lube-heads-container">
            {/* Right Head */}
            <div className="lube-head-section">
              <h3 className="lube-head-title">Right Head</h3>
              
              <div className="lube-status-group">
                <label>Cycles Since Last Lube</label>
                <div className="lube-status-display">
                  <span className="cycles-current">{cyclesSinceLastLube.right}</span>
                  <span className="cycles-separator">/</span>
                  <span className="cycles-threshold">{settings.right.cycleCountToLube}</span>
                </div>
              </div>

              <div className="lube-field-group">
                <label>No of Shots</label>
                <input
                  type="text"
                  readOnly
                  value={settings.right.noOfShots}
                  onClick={() => handleFieldClick('right', 'noOfShots')}
                  className="lube-input"
                />
              </div>

              <div className="lube-field-group">
                <label>Pulse Delay (ms)</label>
                <input
                  type="text"
                  readOnly
                  value={settings.right.pulseDelay}
                  onClick={() => handleFieldClick('right', 'pulseDelay')}
                  className="lube-input"
                />
              </div>

              <div className="lube-field-group">
                <label>Cycle Count to Lube</label>
                <input
                  type="text"
                  readOnly
                  value={settings.right.cycleCountToLube}
                  onClick={() => handleFieldClick('right', 'cycleCountToLube')}
                  className="lube-input"
                />
              </div>

              <button
                className="lube-pulse-btn right-pulse"
                onClick={() => handlePulseLubeHead('right')}
                disabled={pulsing}
                title="Pulse right head lubrication"
              >
                {pulsing ? 'Pulsing...' : '💧 Lube Right Head'}
              </button>
            </div>

            {/* Left Head */}
            <div className="lube-head-section">
              <h3 className="lube-head-title">Left Head</h3>
              
              <div className="lube-status-group">
                <label>Cycles Since Last Lube</label>
                <div className="lube-status-display">
                  <span className="cycles-current">{cyclesSinceLastLube.left}</span>
                  <span className="cycles-separator">/</span>
                  <span className="cycles-threshold">{settings.left.cycleCountToLube}</span>
                </div>
              </div>
              
              <div className="lube-field-group">
                <label>No of Shots</label>
                <input
                  type="text"
                  readOnly
                  value={settings.left.noOfShots}
                  onClick={() => handleFieldClick('left', 'noOfShots')}
                  className="lube-input"
                />
              </div>

              <div className="lube-field-group">
                <label>Pulse Delay (ms)</label>
                <input
                  type="text"
                  readOnly
                  value={settings.left.pulseDelay}
                  onClick={() => handleFieldClick('left', 'pulseDelay')}
                  className="lube-input"
                />
              </div>

              <div className="lube-field-group">
                <label>Cycle Count to Lube</label>
                <input
                  type="text"
                  readOnly
                  value={settings.left.cycleCountToLube}
                  onClick={() => handleFieldClick('left', 'cycleCountToLube')}
                  className="lube-input"
                />
              </div>

              <button
                className="lube-pulse-btn left-pulse"
                onClick={() => handlePulseLubeHead('left')}
                disabled={pulsing}
                title="Pulse left head lubrication"
              >
                {pulsing ? 'Pulsing...' : '💧 Lube Left Head'}
              </button>
            </div>
          </div>
        </div>
      </ModernDialog>

      {keypadOpen && (
        <NumericKeypad
          isOpen={keypadOpen}
          title={`Enter ${keypadField === 'noOfShots' ? 'Number of Shots' : keypadField === 'pulseDelay' ? 'Pulse Delay (ms)' : 'Cycle Count to Lube'}`}
          initialValue={settings[selectedSide]?.[keypadField] || 0}
          decimals={0}
          min={1}
          onSubmit={handleKeypadConfirm}
          onCancel={() => {
            console.log('[LubePage] Keypad cancelled');
            setKeypadOpen(false);
            setKeypadField(null);
            setSelectedSide(null);
          }}
        />
      )}
    </>
  );
}
