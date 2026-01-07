import React, { useState, useEffect } from 'react';
import '../styles/ConnectionStatus.css';

export default function ConnectionStatus({ isOpen, onClose }) {
  const [connectionInfo, setConnectionInfo] = useState({
    amsNetId: 'Unknown',
    connected: false,
    lastChecked: null
  });
  
  const [disconnectedTags, setDisconnectedTags] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  const checkConnection = async () => {
    setLoading(true);
    try {
      // Check connection status from backend
      const res = await fetch('http://localhost:3001/status');
      if (res.ok) {
        const data = await res.json();
        setConnectionInfo({
          amsNetId: data.amsNetId || 'Unknown',
          connected: data.connected || false,
          lastChecked: new Date()
        });
        setDisconnectedTags(data.disconnectedTags || []);
      } else {
        setConnectionInfo({
          amsNetId: 'Unknown',
          connected: false,
          lastChecked: new Date()
        });
        setDisconnectedTags([]);
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionInfo({
        amsNetId: 'Error',
        connected: false,
        lastChecked: new Date()
      });
      setDisconnectedTags([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="connection-status-overlay" onClick={onClose}>
      <div className="connection-status-modal" onClick={(e) => e.stopPropagation()}>
        <div className="connection-header">
          <h2>🔌 Connection Diagnostics</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="connection-content">
          {/* AMS Net ID Status Banner */}
          <div className={`connection-banner ${connectionInfo.connected ? 'connected' : 'disconnected'}`}>
            <div className="banner-icon">
              {connectionInfo.connected ? '✓' : '✗'}
            </div>
            <div className="banner-info">
              <div className="banner-title">
                {connectionInfo.connected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="banner-subtitle">
                AMS Net ID: <strong>{connectionInfo.amsNetId}</strong>
              </div>
              {connectionInfo.lastChecked && (
                <div className="banner-time">
                  Last checked: {connectionInfo.lastChecked.toLocaleTimeString()}
                </div>
              )}
            </div>
            <button className="refresh-btn" onClick={checkConnection} disabled={loading}>
              {loading ? '⟳' : '↻'} Refresh
            </button>
          </div>

          {/* Disconnected Tags Section */}
          {!connectionInfo.connected && (
            <div className="disconnected-section">
              <h3>⚠ Connection Issues</h3>
              <div className="issue-box">
                <p className="issue-title">Unable to connect to PLC</p>
                <p className="issue-desc">The HMI cannot establish communication with the TwinCAT PLC.</p>
              </div>
            </div>
          )}

          {connectionInfo.connected && disconnectedTags.length > 0 && (
            <div className="disconnected-section">
              <h3>⚠ Disconnected Tags ({disconnectedTags.length})</h3>
              <div className="tags-list">
                {disconnectedTags.map((tag, index) => (
                  <div key={index} className="tag-item">
                    <div className="tag-icon">⚠</div>
                    <div className="tag-info">
                      <div className="tag-name">{tag.name || `Tag ${index + 1}`}</div>
                      <div className="tag-path">{tag.path || 'Path unknown'}</div>
                      <div className="tag-error">{tag.error || 'Connection lost'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {connectionInfo.connected && disconnectedTags.length === 0 && (
            <div className="all-good-section">
              <div className="all-good-icon">✓</div>
              <div className="all-good-title">All Tags Connected</div>
              <div className="all-good-desc">All PLC tags are responding normally.</div>
            </div>
          )}

          {/* Troubleshooting Help Section */}
          <div className="help-section">
            <h3>🛠 Troubleshooting Guide</h3>
            
            <div className="help-item">
              <div className="help-number">1</div>
              <div className="help-content">
                <div className="help-title">Check TwinCAT Runtime</div>
                <div className="help-desc">Ensure TwinCAT is running in RUN mode on the target PLC.</div>
                <div className="help-command">
                  System Manager → Right-click → Activate Configuration → Restart TwinCAT
                </div>
              </div>
            </div>

            <div className="help-item">
              <div className="help-number">2</div>
              <div className="help-content">
                <div className="help-title">Verify AMS Net ID</div>
                <div className="help-desc">Confirm the AMS Net ID matches your PLC configuration.</div>
                <div className="help-command">
                  TwinCAT → Router → Edit Routes → Check Target Net ID
                </div>
              </div>
            </div>

            <div className="help-item">
              <div className="help-number">3</div>
              <div className="help-content">
                <div className="help-title">Network Connectivity</div>
                <div className="help-desc">Verify network connection between HMI and PLC.</div>
                <div className="help-command">
                  Command Prompt → ping [PLC_IP_ADDRESS]
                </div>
              </div>
            </div>

            <div className="help-item">
              <div className="help-number">4</div>
              <div className="help-content">
                <div className="help-title">Add Route to PLC</div>
                <div className="help-desc">Ensure this HMI PC is registered in the PLC's route table.</div>
                <div className="help-command">
                  TwinCAT Router → Add Route → Enter HMI PC Name and IP
                </div>
              </div>
            </div>

            <div className="help-item">
              <div className="help-number">5</div>
              <div className="help-content">
                <div className="help-title">Check Backend Service</div>
                <div className="help-desc">Verify the Node.js ADS backend is running on port 3001.</div>
                <div className="help-command">
                  Terminal → node plc-ads-server.js
                </div>
              </div>
            </div>

            <div className="help-item">
              <div className="help-number">6</div>
              <div className="help-content">
                <div className="help-title">Variable Names</div>
                <div className="help-desc">Confirm PLC variable names match those in the HMI configuration.</div>
                <div className="help-command">
                  Check TwinCAT PLC Project → Variables must be GLOBAL and published
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="connection-footer">
          <button className="close-footer-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
