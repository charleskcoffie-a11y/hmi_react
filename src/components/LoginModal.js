import React, { useState } from 'react';
import '../styles/LoginModal.css';

export default function LoginModal({ isOpen, onLogin, currentUser, onClose }) {
  const [selectedRole, setSelectedRole] = useState('operator');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Simple password storage - in production, this would be backend validated
  const userPasswords = {
    operator: 'op123',
    setup: 'setup123',
    engineering: 'eng123'
  };

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

  if (!isOpen && !currentUser) return null;

  // If user is logged in, show logout button
  if (currentUser) {
    return (
      <div className="user-info-badge">
        <div className="user-role-display">
          {roles.find(r => r.id === currentUser)?.icon} {roles.find(r => r.id === currentUser)?.name}
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    );
  }

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
            <input
              type="password"
              className="password-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError('');
              }}
              onKeyPress={handleKeyPress}
              autoFocus
            />
            {passwordError && <div className="password-error">{passwordError}</div>}
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
