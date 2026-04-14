function ControlPanel({ isApiOnline, autoPoll, setAutoPoll, onManualPoll, isManualPolling }) {
  return (
    <div className="glass-panel controls-group">
      <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Ingestion Controls</h3>
      
      <div className="toggle-container">
        <span className="toggle-label">Live Auto-Sync</span>
        <label className="switch" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={autoPoll} 
            onChange={(e) => setAutoPoll(e.target.checked)} 
            disabled={!isApiOnline}
            style={{ marginRight: '0.5rem', transform: 'scale(1.2)' }}
          />
          <span style={{ fontSize: '0.8rem', color: autoPoll ? 'var(--accent-neon)' : 'var(--text-muted)' }}>
            {autoPoll ? 'ON' : 'OFF'}
          </span>
        </label>
      </div>

      <button 
        className="btn btn-primary" 
        onClick={onManualPoll} 
        disabled={!isApiOnline || isManualPolling || autoPoll}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        {isManualPolling ? 'Ingesting...' : 'Ingest 1 Sample'}
      </button>

      {!isApiOnline && (
        <div style={{ fontSize: '0.8rem', color: 'var(--accent-warn)', textAlign: 'center', marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '4px' }}>
          API connection required. Make sure the Node server is running on port 3001.
        </div>
      )}
    </div>
  );
}

export default ControlPanel;
