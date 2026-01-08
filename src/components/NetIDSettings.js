import React, { useState, useEffect } from 'react';
import '../styles/NetIDSettings.css';
import PasswordKeypad from './PasswordKeypad';

const NetIDSettings = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState('');
  const [showPasswordKeypad, setShowPasswordKeypad] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [netID, setNetID] = useState('5.34.123.45.1.1');
  const [newNetID, setNewNetID] = useState('');
  const [superUserPassword, setSuperUserPassword] = useState('1927');
  const [newSuperUserPassword, setNewSuperUserPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [editingMode, setEditingMode] = useState('none'); // 'none', 'netid', 'password'

  useEffect(() => {
    // Load settings from localStorage
    const savedNetID = localStorage.getItem('ams_net_id');
    const savedPassword = localStorage.getItem('superuser_password');
    
    if (savedNetID) setNetID(savedNetID);
    if (savedPassword) setSuperUserPassword(savedPassword);
  }, [isOpen]);

  const handlePasswordSubmit = (pwd) => {
    if (pwd === superUserPassword) {
      setIsAuthenticated(true);
      setPassword('');
      setShowPasswordKeypad(false);
      setMessage('Authentication successful');
      setMessageType('success');
      setTimeout(() => setMessage(''), 2000);
    } else {
      setPassword('');
      setMessage('Invalid password');
      setMessageType('error');
      setTimeout(() => setMessage(''), 2000);
    }
  };

  const handleSaveNetID = async () => {
    if (!newNetID.trim()) {
      setMessage('Net ID cannot be empty');
      setMessageType('error');
      return;
    }

    // Validate Net ID format (basic validation)
    if (!/^\d+(\.\d+)*$/.test(newNetID)) {
      setMessage('Invalid Net ID format. Use format like 5.34.123.45.1.1');
      setMessageType('error');
      return;
    }

    try {
      // Save to localStorage
      localStorage.setItem('ams_net_id', newNetID);
      setNetID(newNetID);
      
      // Update backend with new Net ID
      try {
        const res = await fetch('http://localhost:3001/set-net-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ netId: newNetID })
        });
        const data = await res.json();
        if (data.success) {
          console.log('[NetIDSettings] Backend Net ID updated:', data.message);
        } else {
          console.warn('[NetIDSettings] Backend Net ID update warning:', data.error);
        }
      } catch (backendErr) {
        console.error('[NetIDSettings] Failed to update backend Net ID:', backendErr.message);
        // Still count as success since localStorage was saved
      }
      
      setNewNetID('');
      setEditingMode('none');
      setMessage('Net ID saved successfully');
      setMessageType('success');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Failed to save Net ID');
      setMessageType('error');
    }
  };

  const handleSaveSuperUserPassword = () => {
    if (!newSuperUserPassword.trim()) {
      setMessage('Password cannot be empty');
      setMessageType('error');
      return;
    }

    if (newSuperUserPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      return;
    }

    try {
      localStorage.setItem('superuser_password', newSuperUserPassword);
      setSuperUserPassword(newSuperUserPassword);
      setNewSuperUserPassword('');
      setConfirmPassword('');
      setEditingMode('none');
      setMessage('SuperUser password updated successfully');
      setMessageType('success');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Failed to update password');
      setMessageType('error');
    }
  };

  const handleCancel = () => {
    setEditingMode('none');
    setNewNetID('');
    setNewSuperUserPassword('');
    setConfirmPassword('');
    setMessage('');
  };

  const handleClose = () => {
    setIsAuthenticated(false);
    setPassword('');
    setShowPasswordKeypad(false);
    setEditingMode('none');
    setMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="netid-overlay" onClick={handleClose}>
        <div className="netid-modal" onClick={(e) => e.stopPropagation()}>
          <div className="netid-header">
            <h2>⚙️ Network Configuration</h2>
            <button className="netid-close-btn" onClick={handleClose}>✕</button>
          </div>

          {!isAuthenticated ? (
            <div className="netid-auth-section">
              <div className="netid-auth-message">
                <p>SuperUser Authentication Required</p>
                <p className="netid-subtitle">Enter your SuperUser password to access network settings</p>
              </div>

              <div className="netid-password-input-section">
                <input
                  type="password"
                  className="netid-password-input"
                  placeholder="Enter SuperUser Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  readOnly={showPasswordKeypad}
                />
                <button
                  className="netid-keypad-toggle-btn"
                  onClick={() => setShowPasswordKeypad(!showPasswordKeypad)}
                >
                  {showPasswordKeypad ? '🔒 Hide Keypad' : '🔑 Show Keypad'}
                </button>
              </div>

              {showPasswordKeypad && (
                <div className="netid-keypad-container">
                  <PasswordKeypad
                    value={password}
                    onValueChange={setPassword}
                    onEnter={() => handlePasswordSubmit(password)}
                  />
                </div>
              )}

              <div className="netid-submit-section">
                <button
                  className="netid-btn netid-btn-primary"
                  onClick={() => handlePasswordSubmit(password)}
                  disabled={!password.trim()}
                >
                  🔓 Authenticate
                </button>
              </div>

              {message && (
                <div className={`netid-message netid-message-${messageType}`}>
                  {message}
                </div>
              )}
            </div>
          ) : (
            <div className="netid-settings-section">
              {message && (
                <div className={`netid-message netid-message-${messageType}`}>
                  {message}
                </div>
              )}

              {/* Net ID Setting */}
              <div className="netid-setting-card">
                <div className="netid-setting-header">
                  <h3>🌐 AMS Net ID</h3>
                  <span className="netid-current-value">{netID}</span>
                </div>

                {editingMode === 'netid' ? (
                  <div className="netid-edit-section">
                    <input
                      type="text"
                      className="netid-edit-input"
                      placeholder="e.g., 5.34.123.45.1.1"
                      value={newNetID}
                      onChange={(e) => setNewNetID(e.target.value)}
                    />
                    <div className="netid-edit-help">
                      Format: IP address octets separated by dots (e.g., 5.34.123.45.1.1)
                    </div>
                    <div className="netid-edit-buttons">
                      <button
                        className="netid-btn netid-btn-save"
                        onClick={handleSaveNetID}
                      >
                        ✓ Save
                      </button>
                      <button
                        className="netid-btn netid-btn-cancel"
                        onClick={handleCancel}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="netid-view-section">
                    <p className="netid-description">
                      The AMS Net ID is used to identify and communicate with your PLC controller.
                    </p>
                    <button
                      className="netid-btn netid-btn-edit"
                      onClick={() => {
                        setNewNetID(netID);
                        setEditingMode('netid');
                      }}
                    >
                      ✎ Edit Net ID
                    </button>
                  </div>
                )}
              </div>

              {/* SuperUser Password Setting */}
              <div className="netid-setting-card">
                <div className="netid-setting-header">
                  <h3>🔐 SuperUser Password</h3>
                  <span className="netid-current-value">••••••</span>
                </div>

                {editingMode === 'password' ? (
                  <div className="netid-edit-section">
                    <input
                      type="password"
                      className="netid-edit-input"
                      placeholder="New Password"
                      value={newSuperUserPassword}
                      onChange={(e) => setNewSuperUserPassword(e.target.value)}
                    />
                    <input
                      type="password"
                      className="netid-edit-input"
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <div className="netid-edit-help">
                      Use a strong password. Keep it secure and do not share.
                    </div>
                    <div className="netid-edit-buttons">
                      <button
                        className="netid-btn netid-btn-save"
                        onClick={handleSaveSuperUserPassword}
                      >
                        ✓ Save
                      </button>
                      <button
                        className="netid-btn netid-btn-cancel"
                        onClick={handleCancel}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="netid-view-section">
                    <p className="netid-description">
                      Change your SuperUser password. This protects access to network configuration and other admin settings.
                    </p>
                    <button
                      className="netid-btn netid-btn-edit"
                      onClick={() => {
                        setNewSuperUserPassword('');
                        setConfirmPassword('');
                        setEditingMode('password');
                      }}
                    >
                      ✎ Change Password
                    </button>
                  </div>
                )}
              </div>

              <div className="netid-logout-section">
                <button
                  className="netid-btn netid-btn-logout"
                  onClick={() => {
                    setIsAuthenticated(false);
                    setPassword('');
                    setEditingMode('none');
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NetIDSettings;
