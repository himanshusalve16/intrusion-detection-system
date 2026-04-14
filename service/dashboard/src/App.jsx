import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsWidget from './components/StatsWidget';
import ControlPanel from './components/ControlPanel';
import TelemetryFeed from './components/TelemetryFeed';

const API_URL = 'http://127.0.0.1:3001';

function App() {
  const [alerts, setAlerts] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [isApiOnline, setIsApiOnline] = useState(false);
  const [autoPoll, setAutoPoll] = useState(false);
  const [isManualPolling, setIsManualPolling] = useState(false);

  // Fetch /health API
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
        setIsApiOnline(true);
      } else {
        setIsApiOnline(false);
      }
    } catch (err) {
      setIsApiOnline(false);
      setHealthData(null);
    }
  }, []);

  // Fetch /alerts API
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/alerts`);
      if (res.ok) {
        const data = await res.json();
        // The endpoint returns oldest to newest if array is push()ed.
        // We will reverse it so newest is on top.
        setAlerts(data.alerts ? [...data.alerts].reverse() : []);
      }
    } catch (err) {
      console.error("Failed to fetch alerts", err);
    }
  }, []);

  // Poll Once API
  const handleManualPoll = async () => {
    setIsManualPolling(true);
    try {
      const res = await fetch(`${API_URL}/poll-once`, { method: 'POST' });
      if (res.ok) {
        await Promise.all([fetchHealth(), fetchAlerts()]);
      }
    } catch (err) {
      console.error("Failed manual poll", err);
    } finally {
      setIsManualPolling(false);
    }
  };

  // Setup loop for auto-polling frontend states
  // Note: the backend actually does its own auto-polling when started. 
  // But we need to sync our frontend state.
  useEffect(() => {
    // Initial fetch
    fetchHealth();
    fetchAlerts();

    // Setup sync interval
    const interval = setInterval(() => {
      fetchHealth();
      if (autoPoll) {
        fetchAlerts();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [autoPoll, fetchHealth, fetchAlerts]);

  return (
    <div className="app-container">
      <Header isOnline={isApiOnline} />
      
      <main className="dashboard-grid">
        <aside className="sidebar">
          <StatsWidget health={healthData} alerts={alerts} />
          
          <ControlPanel 
            isApiOnline={isApiOnline}
            autoPoll={autoPoll} 
            setAutoPoll={setAutoPoll}
            onManualPoll={handleManualPoll}
            isManualPolling={isManualPolling}
          />
        </aside>

        <section className="main-content">
          <TelemetryFeed alerts={alerts} autoPoll={autoPoll} />
        </section>
      </main>
    </div>
  );
}

export default App;
