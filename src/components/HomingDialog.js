import React, { useState, useEffect } from 'react';
import '../styles/HomingDialog.css';

export default function HomingDialog({ isOpen, onClose, side, timeout = 60 }) {
  const [status, setStatus] = useState('waiting'); // waiting, ready, homing_id, homing_od, homing_both, complete, failed
  const [message, setMessage] = useState('Initializing homing sequence...');
  const [showOkButton, setShowOkButton] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when dialog closes
      console.log('[HomingDialog] Dialog closing, resetting state');
      setStatus('waiting');
      setMessage('Initializing homing sequence...');
      setShowOkButton(false);
      return;
    }

    console.log(`[HomingDialog] Dialog opened for ${side} side`);

    // Poll PLC variables every 300ms to update dialog state
    const pollInterval = setInterval(async () => {
      try {
        const sidePrefix = side === 'left' ? 'GLEFTHEAD' : 'GRIGHTHEAD';
        const sideName = side === 'left' ? 'Left' : 'Right';

        // Read status variables from PLC
        const [homeEnaRes, idHomingRes, odHomingRes, homedRes] = await Promise.all([
          fetch(`http://localhost:3001/read?tag=${sidePrefix}.bHmi${sideName}HomeEna`),
          fetch(`http://localhost:3001/read?tag=${sidePrefix}.b${sideName}IdHoming`),
          fetch(`http://localhost:3001/read?tag=${sidePrefix}.b${sideName}OdHoming`),
          fetch(`http://localhost:3001/read?tag=${sidePrefix}.b${sideName}HeadHomed`)
        ]);

        if (!homeEnaRes.ok || !idHomingRes.ok || !odHomingRes.ok || !homedRes.ok) {
          console.warn('[HomingDialog] Failed to read PLC status');
          return;
        }

        const [homeEna, idHoming, odHoming, homed] = await Promise.all([
          homeEnaRes.json(),
          idHomingRes.json(),
          odHomingRes.json(),
          homedRes.json()
        ]);

        const isHomeEnaActive = homeEna.success && Boolean(homeEna.value);
        const isIdHoming = idHoming.success && Boolean(idHoming.value);
        const isOdHoming = odHoming.success && Boolean(odHoming.value);
        const isHomed = homed.success && Boolean(homed.value);

        // Update status based on PLC feedback
        if (isHomed) {
          console.log(`[HomingDialog] ${sideName} homing complete!`);
          setStatus('complete');
          setMessage(`${sideName} Head Home Complete ✓`);
          setShowOkButton(true);
        } else if (isIdHoming && isOdHoming) {
          setStatus('homing_both');
          setMessage(`${sideName} Head is Homing...`);
          setShowOkButton(false);
        } else if (isIdHoming) {
          setStatus('homing_id');
          setMessage(`${sideName} ID Homing...`);
          setShowOkButton(false);
        } else if (isOdHoming) {
          setStatus('homing_od');
          setMessage(`${sideName} OD Homing...`);
          setShowOkButton(false);
        } else if (isHomeEnaActive) {
          setStatus('ready');
          setMessage('Start homing by activating the foot pedal');
          setShowOkButton(false);
        } else {
          // Still waiting for enable signal
          setStatus('waiting');
          setMessage('Waiting for homing enable...');
          setShowOkButton(false);
        }
      } catch (error) {
        console.error('[HomingDialog] Error polling PLC:', error);
      }
    }, 300);

    // Check for timeout after configured seconds
    const timeoutTimer = setTimeout(() => {
      console.log('[HomingDialog] Homing timeout reached');
      setStatus('failed');
      setMessage('Homing not complete - timeout reached');
      setShowOkButton(true);
    }, timeout * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeoutTimer);
    };
  }, [isOpen, side, timeout]);

  const handleClose = () => {
    console.log('[HomingDialog] OK button clicked, calling onClose()');
    onClose();
  };

  const handleCancel = async () => {
    try {
      // Disable homing for both left and right sides
      console.log('[HomingDialog] Cancel button clicked, disabling homing');
      await Promise.all([
        fetch(`http://localhost:3001/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: 'GLEFTHEAD.bHmiLeftHomeEna', value: false })
        }),
        fetch(`http://localhost:3001/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: 'GRIGHTHEAD.bHmiRightHomeEna', value: false })
        })
      ]);
      console.log('[HomingDialog] Homing cancelled - disabled both sides');
    } catch (error) {
      console.error('[HomingDialog] Error disabling homing:', error);
    }
    onClose();
  };

  if (!isOpen) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'waiting':
        return '⏳';
      case 'ready':
        return '🦶';
      case 'homing_id':
      case 'homing_od':
      case 'homing_both':
        return '🔄';
      case 'complete':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'complete':
        return 'success';
      case 'failed':
        return 'error';
      case 'homing_id':
      case 'homing_od':
      case 'homing_both':
        return 'progress';
      case 'ready':
        return 'ready';
      default:
        return 'waiting';
    }
  };

  return (
    <div className="homing-dialog-overlay" onClick={showOkButton ? handleClose : undefined}>
      <div className="homing-dialog-container" onClick={(e) => e.stopPropagation()}>
        <div className={`homing-dialog-header ${getStatusColor()}`}>
          <div className="homing-icon">{getStatusIcon()}</div>
          <h2 className="homing-title">Homing {side === 'left' ? 'Left' : 'Right'} Head</h2>
        </div>

        <div className="homing-dialog-body">
          <div className={`status-indicator ${getStatusColor()}`}>
            {status === 'homing_id' || status === 'homing_od' || status === 'homing_both' ? (
              <div className="spinner"></div>
            ) : null}
          </div>

          <p className={`homing-message ${getStatusColor()}`}>{message}</p>

          {status === 'ready' && (
            <div className="pedal-instruction">
              <div className="pedal-icon">🦶</div>
              <p>Press foot pedal to begin</p>
            </div>
          )}

          {(status === 'homing_id' || status === 'homing_od' || status === 'homing_both') && (
            <div className="progress-stages">
              <div className={`stage ${status === 'homing_id' || status === 'homing_both' ? 'active' : ''}`}>
                <div className="stage-dot"></div>
                <span>ID Axis</span>
              </div>
              <div className={`stage ${status === 'homing_od' || status === 'homing_both' ? 'active' : ''}`}>
                <div className="stage-dot"></div>
                <span>OD Axis</span>
              </div>
            </div>
          )}
        </div>

        <div className="homing-dialog-footer">
          {!showOkButton && (
            <button className="cancel-btn" onClick={handleCancel}>
              Cancel
            </button>
          )}
          {showOkButton && (
            <button className={`ok-btn ${getStatusColor()}`} onClick={handleClose}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
