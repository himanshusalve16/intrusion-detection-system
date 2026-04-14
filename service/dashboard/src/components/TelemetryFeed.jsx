function TelemetryFeed({ alerts, autoPoll }) {
  if (alerts.length === 0) {
    return (
      <div className="glass-panel" style={{ height: '100%' }}>
        <div className="feed-header">
          <div className="feed-title">
            <div className={`status-indicator online ${autoPoll ? 'pulse' : ''}`}></div>
            Live Alert Telemetry
          </div>
        </div>
        <div className="empty-state">
          <svg className="empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No Anomalies Detected</h3>
            <p>The feed is quiet. Waiting for incoming alert telemetry.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="feed-header">
        <div className="feed-title">
          <div className={`status-indicator ${autoPoll ? 'online pulse' : 'offline'}`}></div>
          Live Alert Telemetry
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Showing latest {alerts.length} threats
        </div>
      </div>

      <div className="feed-container">
        {alerts.map((alert, idx) => {
          const confPercent = (alert.confidence * 100).toFixed(1);
          const isCritical = alert.confidence >= 0.90;
          
          return (
            <div key={`${alert.sampleIndex}-${idx}`} className={`alert-row ${isCritical ? 'critical' : ''}`}>
              <div className="alert-time">
                {new Date(alert.detectedAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="alert-type">
                [{alert.prediction}]
              </div>
              <div className="alert-confidence">
                <span style={{ fontSize: '0.8rem', minWidth: '40px' }}>{confPercent}%</span>
                <div className="confidence-bar">
                  <div className="confidence-fill" style={{ width: `${confPercent}%` }}></div>
                </div>
              </div>
              <div className="alert-index">
                #idx:{alert.sampleIndex}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TelemetryFeed;
