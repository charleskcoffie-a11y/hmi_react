import React, { useState } from 'react';
import PasswordKeypad from './PasswordKeypad';
import '../styles/LoginModal.css';

export default function LoginModal({ isOpen, onLogin, currentUser, onClose, userPasswords = { operator: '1234', setup: '5678', engineering: '9999' } }) {
  const [selectedRole, setSelectedRole] = useState('operator');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const roles = [
    { id: 'operator', name: 'Operator', description: 'Home & Run only', icon: '▶️' },
    { id: 'setup', name: 'Setup', description: 'Auto Teach & Recipe', icon: '⚙️' },
    { id: 'engineering', name: 'Engineering', description: 'Full Access', icon: '🔧' }
  ];

  const handleRoleSelect = () => {
    setShowPasswordInput(true);
    setPassword('');
    setPasswordError('');
  };

  const handleLogin = () => {
    if (password === userPasswords[selectedRole]) {
      setPasswordError('');
      setPassword('');
      setShowPasswordInput(false);
      onLogin(selectedRole);
    } else {
      setPasswordError('Incorrect password');
    }
  };

  const handleLogout = () => {
    setPassword('');
    setPasswordError('');
    setShowPasswordInput(false);
    onLogin(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  if (!isOpen) return null;

  // Login modal
  return (
    <div className="login-overlay" onClick={() => {}}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="login-header">
          <h2>Select User Role</h2>
        </div>

        {!showPasswordInput ? (
          <>
            <div className="roles-container">
              {roles.map(role => (
                <div
                  key={role.id}
                  className={`role-card ${selectedRole === role.id ? 'selected' : ''}`}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <div className="role-icon">{role.icon}</div>
                  <div className="role-name">{role.name}</div>
                  <div className="role-description">{role.description}</div>
                </div>
              ))}
            </div>

            <div className="login-actions">
              <button className="login-btn" onClick={handleRoleSelect}>
                Login as {roles.find(r => r.id === selectedRole)?.name}
              </button>
            </div>
          </>
        ) : (
          <div className="password-section">
            <p className="password-prompt">Enter password for {roles.find(r => r.id === selectedRole)?.name}</p>
            <div className="password-display">
              {password.split('').map((_, i) => (
                <span key={i} className="password-dot">●</span>
              ))}
            </div>
            {passwordError && <div className="password-error">{passwordError}</div>}
            <PasswordKeypad
              value={password}
              onValueChange={(newVal) => {
                setPassword(newVal);
                setPasswordError('');
              }}
              onEnter={handleLogin}
              maxLength={6}
            />
            <div className="password-actions">
              <button className="password-submit-btn" onClick={handleLogin}>
                Login
              </button>
              <button className="password-back-btn" onClick={() => {
                setShowPasswordInput(false);
                setPassword('');
                setPasswordError('');
              }}>
                Back
              </button>
              <button className="password-cancel-btn" onClick={() => {
                setShowPasswordInput(false);
                setPassword('');
                setPasswordError('');
                if (onClose) onClose();
              }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
