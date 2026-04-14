function StatsWidget({ health, alerts }) {
  const processed = health?.processedSamples || 0;
  const dbCursor = health?.cursor || 0;
  
  // Calculate average confidence from currently loaded alerts
  let avgConfidence = 0;
  let countCritical = 0;
  
  if (alerts.length > 0) {
    const totalConf = alerts.reduce((acc, a) => acc + (a.confidence || 0), 0);
    avgConfidence = ((totalConf / alerts.length) * 100).toFixed(1);
    
    countCritical = alerts.filter(a => a.confidence >= 0.9).length;
  }

  return (
    <div className="sidebar" style={{ gap: '1rem' }}>
      <div className="glass-panel stat-box">
        <div className="stat-label">Processed Samples</div>
        <div className="stat-value">{processed.toLocaleString()}</div>
      </div>
      
      <div className="glass-panel stat-box">
        <div className="stat-label">Critical Alerts (Conf &ge; 90%)</div>
        <div className={`stat-value ${countCritical > 0 ? 'highlight' : ''}`}>
          {countCritical}
        </div>
      </div>

      <div className="glass-panel stat-box">
        <div className="stat-label">Avg Threat Confidence</div>
        <div className="stat-value">
          {alerts.length > 0 ? `${avgConfidence}%` : '---'}
        </div>
      </div>

      <div className="glass-panel stat-box">
        <div className="stat-label">DB Cursor Position</div>
        <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>
          Line {dbCursor}
        </div>
      </div>
    </div>
  );
}

export default StatsWidget;
