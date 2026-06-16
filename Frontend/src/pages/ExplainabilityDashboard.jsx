import React, { useState, useEffect } from 'react';

const ExplainabilityDashboard = ({ homeInfo }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('decisions');

  // Modal explanation states
  const [selectedDecision, setSelectedDecision] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explanationRecord, setExplanationRecord] = useState(null);

  // Routine & Profile Explanation States
  const [routineExplanations, setRoutineExplanations] = useState({});
  const [profileExplanations, setProfileExplanations] = useState({});

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      // Fetch automation dashboard for decision log lists
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/automation-dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to fetch AI decisions');
      setData(resData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Fetch Action Explanation
  const handleOpenActionExplain = async (decision) => {
    try {
      setSelectedDecision(decision);
      setExplainLoading(true);
      setExplanationRecord(null);

      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/explain/action/${decision._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to generate explanation');

      setExplanationRecord(resData);
      setExplainLoading(false);
    } catch (err) {
      alert(err.message);
      setExplainLoading(false);
      setSelectedDecision(null);
    }
  };

  // Fetch Routine Explanation
  const handleExplainRoutine = async (routineId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/explain/routine/${routineId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (res.ok) {
        setRoutineExplanations(prev => ({ ...prev, [routineId]: resData.explanation }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Profile Update Explanation
  const handleExplainProfile = async (memberId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/explain/profile/${memberId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (res.ok) {
        setProfileExplanations(prev => ({ ...prev, [memberId]: resData.explanation }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text-secondary)' }}>
        <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeftColor: 'var(--accent-yellow)', width: '40px', height: '40px', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <span style={{ marginLeft: '15px', fontWeight: 600 }}>Loading AI Explainability logs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.2)', padding: '1.5rem', borderRadius: '12px', color: '#FF5555', margin: '1rem 0' }}>
        <strong>Error Loading Explainability Engine:</strong> {error}
      </div>
    );
  }

  const { automatedActions, pendingApprovals, members } = data || {};
  const allDecisions = [...(pendingApprovals || []), ...(automatedActions || [])];

  return (
    <div className="fade-in" style={{ paddingBottom: '3rem' }}>
      
      {/* Header Banner */}
      <div style={{ 
        background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', 
        border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        marginBottom: '2rem'
      }}>
        <h2 style={{ color: 'var(--text-primary)', margin: '0 0 5px 0', fontSize: '1.8rem', fontWeight: 800 }}>
          💬 AI Explainability Engine
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
          Audit trace logs, analyze relative Random Forest feature importances, and view human-readable natural language explanations generated by Amazon Bedrock.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
        <button 
          onClick={() => setActiveTab('decisions')}
          style={{
            background: activeTab === 'decisions' ? 'var(--accent-yellow)' : 'transparent',
            color: activeTab === 'decisions' ? '#000' : 'var(--text-secondary)',
            border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          AI Decisions Log
        </button>
        <button 
          onClick={() => setActiveTab('profiles')}
          style={{
            background: activeTab === 'profiles' ? 'var(--accent-yellow)' : 'transparent',
            color: activeTab === 'profiles' ? '#000' : 'var(--text-secondary)',
            border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
          }}
        >
          Profile Adjustments
        </button>
      </div>

      {/* Tab content 1: Decisions */}
      {activeTab === 'decisions' && (
        <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: '#FFF', fontSize: '1.2rem' }}>
            Audit Decision Trace
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allDecisions && allDecisions.length > 0 ? (
              allDecisions.map(dec => (
                <div 
                  key={dec._id} 
                  onClick={() => handleOpenActionExplain(dec)}
                  style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid rgba(255,255,255,0.05)', 
                    borderRadius: '12px', padding: '15px', 
                    cursor: 'pointer', display: 'flex', 
                    justifyContent: 'space-between', alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateX(5px)';
                    e.currentTarget.style.borderColor = 'var(--accent-yellow)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                        {dec.userName}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {new Date(dec.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <strong style={{ color: '#FFF', fontSize: '1rem' }}>{dec.predictedAction}</strong>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '5px 0 0 0' }}>
                      Status: <span style={{ color: dec.result === 'Manual Override' ? '#FF5555' : '#22C55E', fontWeight: 'bold' }}>{dec.result}</span>
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--accent-yellow)', fontWeight: 800, fontSize: '1.2rem' }}>
                      {dec.confidenceScore}%
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Confidence</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>
                No decisions recorded to analyze yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab content 2: Profile Adjustments */}
      {activeTab === 'profiles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
          {members && members.length > 0 ? (
            members.map(m => (
              <div key={m.memberId} style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#FFF', margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                    {m.name}
                  </h3>
                  <span style={{ color: 'var(--accent-yellow)', fontSize: '0.75rem', background: 'rgba(234, 235, 114, 0.1)', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                    {m.role}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                  AI Automation Mode: <strong style={{ color: '#FFF' }}>Active ({m.automationEnabled ? 'Automation ON' : 'Automation OFF'})</strong>
                </p>
                
                {profileExplanations[m.memberId] ? (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px', marginTop: '10px', fontSize: '0.85rem', lineHeight: 1.4, color: 'var(--text-primary)' }}>
                    📖 <strong>AI Explanation:</strong> {profileExplanations[m.memberId]}
                  </div>
                ) : (
                  <button 
                    onClick={() => handleExplainProfile(m.memberId)}
                    style={{ 
                      background: 'rgba(234, 235, 114, 0.1)', 
                      color: 'var(--accent-yellow)', 
                      border: '1px solid rgba(234, 235, 114, 0.2)', 
                      padding: '8px 12px', borderRadius: '8px', 
                      cursor: 'pointer', fontSize: '0.8rem', 
                      fontWeight: 'bold', marginTop: '10px'
                    }}
                  >
                    🔍 Why did AI update this profile?
                  </button>
                )}
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--text-secondary)', padding: '2rem' }}>No family profiles found.</div>
          )}
        </div>
      )}

      {/* Explanation Modal Dialog */}
      {selectedDecision && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', 
          zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '1rem'
        }}>
          <div style={{ 
            background: '#12131C', border: '1px solid var(--border-subtle)', 
            width: '100%', maxWidth: '560px', borderRadius: '24px', 
            padding: '2rem', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}>
            <button 
              onClick={() => setSelectedDecision(null)}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              ✕
            </button>

            <h3 style={{ color: '#FFF', margin: '0 0 10px 0', fontSize: '1.4rem', fontWeight: 800 }}>
              Decision Audit & Explanation
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 1.5rem 0' }}>
              Trace Log ID: {selectedDecision._id}
            </p>

            {explainLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Generating human natural language explanation...
              </div>
            ) : explanationRecord ? (
              <div>
                {/* Natural Language Sentence */}
                <div style={{ background: 'rgba(234, 235, 114, 0.05)', border: '1px solid rgba(234, 235, 114, 0.15)', borderRadius: '16px', padding: '15px', color: '#FFF', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                  💬 "{explanationRecord.evidence}"
                </div>

                {/* Grid: Confidence & Feature Importances */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  
                  {/* Radial Confidence */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '15px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '10px' }}>Confidence Score</span>
                    <div style={{ 
                      width: '90px', height: '90px', borderRadius: '50%', 
                      background: `conic-gradient(var(--accent-yellow) ${explanationRecord.confidence * 3.6}deg, rgba(255,255,255,0.05) 0deg)`, 
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      boxShadow: '0 0 15px rgba(234,235,114,0.2)'
                    }}>
                      <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#12131C', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: '#FFF' }}>
                        {explanationRecord.confidence}%
                      </div>
                    </div>
                  </div>

                  {/* Feature Contributions bar charts */}
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '5px' }}>Feature Contributions</span>
                    
                    {/* User */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                        <span>User Profile</span>
                        <span>{explanationRecord.featureContributions?.user || 20}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                        <div style={{ height: '100%', background: 'var(--accent-yellow)', borderRadius: '3px', width: `${explanationRecord.featureContributions?.user || 20}%` }}></div>
                      </div>
                    </div>

                    {/* Time */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                        <span>Time / Hour</span>
                        <span>{explanationRecord.featureContributions?.time || 20}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                        <div style={{ height: '100%', background: '#22C55E', borderRadius: '3px', width: `${explanationRecord.featureContributions?.time || 20}%` }}></div>
                      </div>
                    </div>

                    {/* Room */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                        <span>Room Context</span>
                        <span>{explanationRecord.featureContributions?.room || 20}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                        <div style={{ height: '100%', background: '#3B82F6', borderRadius: '3px', width: `${explanationRecord.featureContributions?.room || 20}%` }}></div>
                      </div>
                    </div>

                    {/* Device */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                        <span>Device Log</span>
                        <span>{explanationRecord.featureContributions?.device || 20}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                        <div style={{ height: '100%', background: '#A855F7', borderRadius: '3px', width: `${explanationRecord.featureContributions?.device || 20}%` }}></div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Audit details */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Target Room:</span>
                    <strong style={{ color: '#FFF' }}>{explanationRecord.roomName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Target Device:</span>
                    <strong style={{ color: '#FFF' }}>{explanationRecord.deviceName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Action Executed:</span>
                    <strong style={{ color: '#FFF' }}>ON</strong>
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
};

export default ExplainabilityDashboard;
