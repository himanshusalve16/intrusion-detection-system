function Header({ isOnline }) {
  return (
    <header className="header-container">
      <div className="brand">
        <h1 className="brand-title">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent-cyan)" }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <path d="M8 11h8"></path>
          </svg>
          Intrusion Detection System
        </h1>
        <div className="brand-subtitle">Live Threat Telemetry</div>
      </div>
      
      <div className="status-badge">
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'} ${isOnline ? 'pulse' : ''}`}></div>
        <span>{isOnline ? 'API Connected' : 'API Disconnected'}</span>
      </div>
    </header>
  );
}

export default Header;
