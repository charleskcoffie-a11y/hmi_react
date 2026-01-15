import React, { useState, useEffect } from 'react';
import '../styles/DebugPanel.css';

export default function DebugPanel({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState({});
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [autoTest, setAutoTest] = useState(false);
  const [heartbeatDiag, setHeartbeatDiag] = useState(null);
  const [heartbeatInput, setHeartbeatInput] = useState('Main.iHeartBeat');

  useEffect(() => {
    if (isOpen && autoTest) {
      const interval = setInterval(async () => {
        await checkStatus();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, autoTest]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-99), { message, type, timestamp }]);
  };

  const checkStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/status');
      const data = await res.json();
      setConnectionStatus(data);
      addLog(`Status: connected=${data.connected}, heartbeat=${data.heartbeat}`, 'info');
    } catch (err) {
      addLog(`Status check failed: ${err.message}`, 'error');
    }
  };

  const testTag = async () => {
    if (!testInput.trim()) return;
    try {
      addLog(`Testing tag: ${testInput}`, 'info');
      const res = await fetch('http://localhost:3001/test-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: [testInput.trim()] })
      });
      const data = await res.json();
      if (data.results && data.results[0]) {
        const result = data.results[0];
        setTestResult(result);
        if (result.status === 'ok') {
          addLog(`✓ ${result.tag}: ${result.value}`, 'success');
        } else {
          addLog(`✗ ${result.tag}: ${result.error}`, 'error');
        }
      }
    } catch (err) {
      addLog(`Test failed: ${err.message}`, 'error');
    }
  };

  const runHeartbeatDiag = async () => {
    try {
      const tag = heartbeatInput.trim();
      addLog(`Running heartbeat diagnostics${tag ? ' for ' + tag : ''}...`, 'info');
      const url = tag ? `http://localhost:3001/heartbeat-debug?tag=${encodeURIComponent(tag)}` : 'http://localhost:3001/heartbeat-debug';
      const res = await fetch(url);
      const data = await res.json();
      setHeartbeatDiag(data);
      addLog(`HB diag: connected=${data.connected}, hasReadValue=${data.hasReadValue}`, 'info');
    } catch (err) {
      addLog(`Heartbeat diag failed: ${err.message}`, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="debug-overlay" onClick={onClose}>
      <div className="debug-modal" onClick={(e) => e.stopPropagation()}>
        <div className="debug-header">
          <h2>🔧 Debug Panel</h2>
          <button className="debug-close" onClick={onClose}>✕</button>
        </div>

        <div className="debug-content">
          {/* Status Section */}
          <div className="debug-section">
            <h3>Connection Status</h3>
            <div className="debug-box">
              <button onClick={checkStatus} className="debug-btn">Check Status</button>
              <label className="debug-checkbox">
                <input type="checkbox" checked={autoTest} onChange={(e) => setAutoTest(e.target.checked)} />
                Auto-refresh every 2s
              </label>
              <pre className="debug-json">{JSON.stringify(connectionStatus, null, 2)}</pre>
            </div>
          </div>

          {/* Heartbeat Diagnostics */}
          <div className="debug-section">
            <h3>Heartbeat Diagnostics</h3>
            <div className="debug-box">
              <div className="debug-input-group">
                <input
                  type="text"
                  value={heartbeatInput}
                  onChange={(e) => setHeartbeatInput(e.target.value)}
                  placeholder="e.g., Main.iHeartBeat"
                  className="debug-input"
                  onKeyPress={(e) => e.key === 'Enter' && runHeartbeatDiag()}
                />
                <button onClick={runHeartbeatDiag} className="debug-btn">Run Diagnostics</button>
              </div>
              {heartbeatDiag && (
                <pre className="debug-json">{JSON.stringify(heartbeatDiag, null, 2)}</pre>
              )}
            </div>
          </div>

          {/* Tag Tester Section */}
          <div className="debug-section">
            <h3>Test Tag</h3>
            <div className="debug-box">
              <div className="debug-input-group">
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="e.g., MAIN.iHeartbeat or GPersistant.lAxis1ActPos"
                  className="debug-input"
                  onKeyPress={(e) => e.key === 'Enter' && testTag()}
                />
                <button onClick={testTag} className="debug-btn">Test</button>
              </div>
              {testResult && (
                <div className={`debug-result ${testResult.status}`}>
                  <strong>{testResult.tag}</strong>
                  {testResult.status === 'ok' ? (
                    <div>✓ Value: <code>{testResult.value}</code></div>
                  ) : (
                    <div>✗ Error: {testResult.error}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Logs Section */}
          <div className="debug-section">
            <h3>Log Output ({logs.length})</h3>
            <button onClick={() => setLogs([])} className="debug-btn-small">Clear</button>
            <div className="debug-logs">
              {logs.map((log, i) => (
                <div key={i} className={`log-line log-${log.type}`}>
                  <span className="log-time">{log.timestamp}</span>
                  <span className="log-msg">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
