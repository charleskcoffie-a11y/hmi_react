import React, { useState, useEffect } from 'react';
import '../styles/ConnectionStatus.css';

export default function ConnectionStatus({ isOpen, onClose }) {
  const [connectionInfo, setConnectionInfo] = useState({
    amsNetId: 'Unknown',
    connected: false,
    lastChecked: null,
    heartbeat: null,
    heartbeatTag: null
  });
  
  const [disconnectedTags, setDisconnectedTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tagTestResults, setTagTestResults] = useState(null);
  const [testingTags, setTestingTags] = useState(false);
  const [tagInput, setTagInput] = useState('GVL.Axis1Position\nGVL.Axis2Position\nGVL.Status\nMAIN.Speed\nMAIN.Temperature');
  const [heartbeatTagInput, setHeartbeatTagInput] = useState('');
  const [testingHeartbeat, setTestingHeartbeat] = useState(false);
  const [heartbeatTestResult, setHeartbeatTestResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      checkConnection();
      // Auto-refresh every 1 second to show live heartbeat
      const interval = setInterval(checkConnection, 1000);
      return () => clearInterval(interval);
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
          lastChecked: new Date(),
          heartbeat: data.heartbeat !== null && data.heartbeat !== undefined ? data.heartbeat : null,
          heartbeatTag: data.heartbeatTag || null
        });
        setDisconnectedTags(data.disconnectedTags || []);
      } else {
        setConnectionInfo({
          amsNetId: 'Unknown',
          connected: false,
          lastChecked: new Date(),
          heartbeat: null
        });
        setDisconnectedTags([]);
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setConnectionInfo({
        amsNetId: 'Error',
        connected: false,
        lastChecked: new Date(),
        heartbeat: null
      });
      setDisconnectedTags([]);
    } finally {
      setLoading(false);
    }
  };

  const testTags = async () => {
    setTestingTags(true);
    try {
      // Parse tags from textarea (one per line, filter empty lines)
      const tagsToTest = tagInput
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      if (tagsToTest.length === 0) {
        setTagTestResults([]);
        setTestingTags(false);
        return;
      }

      const res = await fetch('http://localhost:3001/test-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: tagsToTest })
      });
      if (res.ok) {
        const data = await res.json();
        setTagTestResults(data.results || []);
      } else {
        setTagTestResults([]);
      }
    } catch (error) {
      console.error('Tag test failed:', error);
      setTagTestResults([]);
    } finally {
      setTestingTags(false);
    }
  };

  const testHeartbeatTag = async () => {
    if (!heartbeatTagInput.trim()) return;
    setTestingHeartbeat(true);
    setHeartbeatTestResult(null);
    try {
      const res = await fetch('http://localhost:3001/test-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: [heartbeatTagInput.trim()] })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results[0]) {
          setHeartbeatTestResult(data.results[0]);
        }
      }
    } catch (error) {
      console.error('Heartbeat test failed:', error);
      setHeartbeatTestResult({ status: 'error', error: error.message });
    } finally {
      setTestingHeartbeat(false);
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
              {connectionInfo.connected && (
                <div className="banner-heartbeat">
                  PLC Heartbeat: <strong>{connectionInfo.heartbeat !== null ? connectionInfo.heartbeat : 'N/A'}</strong>
                </div>
              )}
              {connectionInfo.heartbeatTag && (
                <div className="banner-tag" style={{fontSize: '10px', color: '#444'}}>
                  HB Tag: <strong>{connectionInfo.heartbeatTag}</strong>
                </div>
              )}
              <div style={{fontSize: '10px', color: '#666', marginTop: '4px'}}>
                Debug: {JSON.stringify(connectionInfo)}
              </div>
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

          {/* Manual Heartbeat Tag Test */}
          {connectionInfo.connected && connectionInfo.heartbeat === null && (
            <div className="tag-test-section" style={{marginBottom: '20px', background: '#fff3cd', border: '1px solid #ffc107', padding: '12px', borderRadius: '8px'}}>
              <h3 style={{margin: '0 0 8px 0', fontSize: '14px', color: '#856404'}}>⚠ Heartbeat Not Found</h3>
              <p style={{margin: '0 0 8px 0', fontSize: '12px', color: '#856404'}}>
                Test the exact tag path from TwinCAT:
              </p>
              <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                <input
                  type="text"
                  value={heartbeatTagInput}
                  onChange={(e) => setHeartbeatTagInput(e.target.value)}
                  placeholder="e.g., MAIN.iHeartbeat or GVL.iHeartbeat"
                  style={{flex: 1, padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '12px'}}
                  onKeyPress={(e) => e.key === 'Enter' && testHeartbeatTag()}
                />
                <button 
                  onClick={testHeartbeatTag}
                  disabled={testingHeartbeat || !heartbeatTagInput.trim()}
                  style={{padding: '6px 12px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'}}
                >
                  {testingHeartbeat ? 'Testing...' : 'Test'}
                </button>
              </div>
              {heartbeatTestResult && (
                <div style={{marginTop: '8px', padding: '8px', background: heartbeatTestResult.status === 'ok' ? '#d4edda' : '#f8d7da', border: `1px solid ${heartbeatTestResult.status === 'ok' ? '#c3e6cb' : '#f5c6cb'}`, borderRadius: '4px', fontSize: '12px'}}>
                  {heartbeatTestResult.status === 'ok' ? (
                    <div style={{color: '#155724'}}>
                      ✓ Success! Value: <strong>{heartbeatTestResult.value}</strong><br/>
                      Tag: <code>{heartbeatTestResult.tag}</code>
                    </div>
                  ) : (
                    <div style={{color: '#721c24'}}>
                      ✗ Failed: {heartbeatTestResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tag Test Section */}
          <div className="tag-test-section">
            <div className="tag-test-header">
              <h3>🔍 Test PLC Tags</h3>
              <button 
                className="test-tags-btn" 
                onClick={testTags} 
                disabled={testingTags}
              >
                {testingTags ? '⟳ Testing...' : '▶ Test Tags'}
              </button>
            </div>

            <div className="tag-input-container">
              <label className="tag-input-label">
                Tag Names (one per line):
              </label>
              <textarea
                className="tag-input-textarea"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Paste your PLC tag names here, one per line&#10;Example:&#10;GVL.Axis1Position&#10;MAIN.Speed&#10;MAIN.Temperature"
                rows={8}
              />
              <div className="tag-input-hint">
                💡 Paste all your tag names from TwinCAT—one per line. Click "Test Tags" to check them all at once.
              </div>
            </div>

            {tagTestResults && tagTestResults.length > 0 && (
              <div className="tag-test-results">
                <table className="tag-results-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Tag Name</th>
                      <th>Value</th>
                      <th>Error Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tagTestResults.map((result, index) => (
                      <tr key={index} className={`tag-row ${result.status}`}>
                        <td className="tag-status">
                          {result.status === 'ok' ? (
                            <span className="status-ok">✓</span>
                          ) : (
                            <span className="status-error">✗</span>
                          )}
                        </td>
                        <td className="tag-name">{result.tag}</td>
                        <td className="tag-value">
                          {result.value !== null ? String(result.value) : '—'}
                        </td>
                        <td className="tag-error">
                          {result.error || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tagTestResults && tagTestResults.length === 0 && (
              <div className="no-results">No tags configured for testing.</div>
            )}
          </div>

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
