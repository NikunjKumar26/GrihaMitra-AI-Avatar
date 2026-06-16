import React, { useState, useEffect } from 'react';

const PredictiveAutomation = ({ homeInfo }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    
    // Auto refresh data every 30 seconds to show active evaluations
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/automation-dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to load automation dashboard');
      setData(resData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Handle Approve/Reject Feedback
  const handleFeedback = async (decisionId, response) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/feedback`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ decisionId, response })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to apply feedback');
      
      // Flash message and refresh
      fetchDashboardData();
      setActionLoading(false);
    } catch (err) {
      alert(err.message);
      setActionLoading(false);
    }
  };

  // Trigger Live AI Scan / Evaluation
  const handleForceEvaluate = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/evaluate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Evaluation trigger failed');
      
      alert('AI successfully executed local predictive evaluation scan!');
      fetchDashboardData();
      setActionLoading(false);
    } catch (err) {
      alert(err.message);
      setActionLoading(false);
    }
  };

  // Toggle Room Switch
  const handleToggleRoom = async (roomId, currentStatus) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/toggle-room-automation`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomId, enabled: !currentStatus })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to toggle room automation');
      
      fetchDashboardData();
      setActionLoading(false);
    } catch (err) {
      alert(err.message);
      setActionLoading(false);
    }
  };

  // Toggle Member Switch
  const handleToggleMember = async (memberId, currentStatus) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/toggle-member-automation`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ memberId, enabled: !currentStatus })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to toggle member automation');
      
      fetchDashboardData();
      setActionLoading(false);
    } catch (err) {
      alert(err.message);
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text-secondary)' }}>
        <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeftColor: 'var(--accent-yellow)', width: '40px', height: '40px', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <span style={{ marginLeft: '15px', fontWeight: 600 }}>Loading AI Decision Engine...</span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.2)', padding: '1.5rem', borderRadius: '12px', color: '#FF5555', margin: '1rem 0' }}>
        <strong>Error Loading Decision Engine:</strong> {error}
      </div>
    );
  }

  const { activePredictions, automatedActions, pendingApprovals, rooms, members, statistics } = data || {};

  return (
    <div className="fade-in" style={{ paddingBottom: '3rem' }}>
      
      {/* Header Banner */}
      <div style={{ 
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', 
        marginBottom: '2rem', gap: '1rem', background: 'var(--bg-panel)', padding: '1.5rem', 
        borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
      }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 5px 0', fontSize: '1.8rem', fontWeight: 800 }}>
            🧠 Predictive Automation Engine
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            AI executes decisions automatically above 90% confidence, asks for approval above 70%, and handles manual overrides safely.
          </p>
        </div>
        <button 
          onClick={handleForceEvaluate}
          disabled={actionLoading}
          style={{ 
            background: 'linear-gradient(135deg, var(--accent-yellow) 0%, #d4af37 100%)', 
            color: '#000', 
            border: 'none', 
            padding: '10px 20px', 
            borderRadius: '10px', 
            cursor: actionLoading ? 'not-allowed' : 'pointer', 
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(234,235,114,0.3)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          ⚡ Scan predictions now
        </button>
      </div>

      {/* Stats Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 10px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Automation Success Rate
          </p>
          <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: 'var(--accent-yellow)' }}>
            {statistics?.successRate}%
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Based on successful logs</span>
        </div>
        <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 10px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Decisions Logged
          </p>
          <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: '#FFF' }}>
            {statistics?.totalDecisions || 0}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total predictions executed</span>
        </div>
        <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 10px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Manual Overrides
          </p>
          <h3 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: '#FF5555' }}>
            {statistics?.overrideCount || 0}
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>User contradicted AI actions</span>
        </div>
      </div>

      {/* Grid: Pending Approvals & Live Predictions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* Pending Approvals */}
        <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: '#FFF', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📥 Pending Approvals ({pendingApprovals?.length || 0})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, overflowY: 'auto', maxHeight: '380px', paddingRight: '5px' }}>
            {pendingApprovals && pendingApprovals.length > 0 ? (
              pendingApprovals.map(dec => (
                <div key={dec._id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--accent-yellow)', fontSize: '0.8rem', fontWeight: 700 }}>
                      Confidence: {dec.confidenceScore}%
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {new Date(dec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <strong style={{ color: '#FFF', fontSize: '0.9rem' }}>{dec.predictedAction}</strong>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>{dec.reason}</p>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                    <button 
                      onClick={() => handleFeedback(dec._id, 'Approved')}
                      disabled={actionLoading}
                      style={{ flex: 1, background: '#22C55E', color: '#FFF', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleFeedback(dec._id, 'Rejected')}
                      disabled={actionLoading}
                      style={{ flex: 1, background: '#EF4444', color: '#FFF', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                No actions waiting for approval.
              </div>
            )}
          </div>
        </div>

        {/* Live Predictions */}
        <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: '#FFF', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🔮 Active Predictions (Current Hour)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, overflowY: 'auto', maxHeight: '380px', paddingRight: '5px' }}>
            {activePredictions && activePredictions.length > 0 ? (
              activePredictions.map((pred, i) => (
                <div key={i} style={{ background: 'rgba(234, 235, 114, 0.02)', border: '1px solid rgba(234, 235, 114, 0.08)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ background: 'rgba(255,255,255,0.05)', color: '#FFF', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                      {pred.userName} ({pred.role})
                    </span>
                    <span style={{ color: pred.confidence > 90 ? '#22C55E' : 'var(--accent-yellow)', fontSize: '0.8rem', fontWeight: 700 }}>
                      {pred.confidence}%
                    </span>
                  </div>
                  <strong style={{ color: '#FFF', fontSize: '0.9rem' }}>{pred.prediction}</strong>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>{pred.supportingEvidence}</p>
                </div>
              ))
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                Ensure your family profiles are in "Predictive" mode and automation is enabled to calculate live hourly predictions.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Override Management Matrix */}
      <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', color: '#FFF', fontSize: '1.2rem' }}>
          🛡️ Automation Override Switches
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          
          {/* Room Toggles */}
          <div>
            <h4 style={{ color: 'var(--accent-yellow)', margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 700 }}>
              Disable Automation by Room
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rooms && rooms.length > 0 ? (
                rooms.map(room => (
                  <div key={room.roomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: '#FFF', fontSize: '0.9rem', fontWeight: 600 }}>{room.name}</span>
                    <button 
                      onClick={() => handleToggleRoom(room.roomId, room.automationEnabled)}
                      style={{ 
                        background: room.automationEnabled ? '#22C55E' : 'rgba(255,50,50,0.2)', 
                        color: room.automationEnabled ? '#000' : '#FF5555', 
                        border: 'none', 
                        padding: '5px 12px', 
                        borderRadius: '6px', 
                        cursor: 'pointer', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold' 
                      }}
                    >
                      {room.automationEnabled ? 'ACTIVE' : 'MUTED'}
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No rooms set up.</div>
              )}
            </div>
          </div>

          {/* Member Toggles */}
          <div>
            <h4 style={{ color: 'var(--accent-yellow)', margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 700 }}>
              Disable Automation by Family Member
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {members && members.length > 0 ? (
                members.map(m => (
                  <div key={m.memberId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: '#FFF', fontSize: '0.9rem', fontWeight: 600 }}>{m.name} <small style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>({m.role})</small></span>
                    <button 
                      onClick={() => handleToggleMember(m.memberId, m.automationEnabled)}
                      style={{ 
                        background: m.automationEnabled ? '#22C55E' : 'rgba(255,50,50,0.2)', 
                        color: m.automationEnabled ? '#000' : '#FF5555', 
                        border: 'none', 
                        padding: '5px 12px', 
                        borderRadius: '6px', 
                        cursor: 'pointer', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold' 
                      }}
                    >
                      {m.automationEnabled ? 'ACTIVE' : 'MUTED'}
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No family profiles set up.</div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Audit Decision Log */}
      <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', color: '#FFF', fontSize: '1.2rem' }}>
          📋 Automated Actions Audit Log
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                <th style={{ padding: '10px 5px', color: 'var(--text-secondary)' }}>Timestamp</th>
                <th style={{ padding: '10px 5px', color: 'var(--text-secondary)' }}>User</th>
                <th style={{ padding: '10px 5px', color: 'var(--text-secondary)' }}>Action</th>
                <th style={{ padding: '10px 5px', color: 'var(--text-secondary)' }}>Confidence</th>
                <th style={{ padding: '10px 5px', color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '10px 5px', color: 'var(--text-secondary)' }}>Trigger Reason / Override Details</th>
              </tr>
            </thead>
            <tbody>
              {automatedActions && automatedActions.length > 0 ? (
                automatedActions.map(dec => {
                  const statusColors = {
                    'Success': '#22C55E',
                    'Manual Override': '#FF5555',
                    'Rejected': '#EF4444',
                    'Pending Approval': 'var(--accent-yellow)'
                  };
                  return (
                    <tr key={dec._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(dec.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 5px', fontWeight: 600 }}>{dec.userName}</td>
                      <td style={{ padding: '12px 5px', fontWeight: 'bold' }}>{dec.predictedAction}</td>
                      <td style={{ padding: '12px 5px', color: 'var(--accent-yellow)', fontWeight: 700 }}>
                        {dec.confidenceScore}%
                      </td>
                      <td style={{ padding: '12px 5px', color: statusColors[dec.result] || '#FFF', fontWeight: 'bold' }}>
                        {dec.result}
                      </td>
                      <td style={{ padding: '12px 5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        {dec.isOverride ? dec.reason : dec.reason}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No automated decisions have been executed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default PredictiveAutomation;
