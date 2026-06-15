import React, { useState, useEffect } from 'react';

const FamilyIntelligence = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ML Training & Prediction States
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [predictForm, setPredictForm] = useState({
    userName: '',
    hour: new Date().getHours(),
    dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' })
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to fetch AI Learning Dashboard data');
      setData(resData);
      
      // Auto-select first user in prediction form if available
      if (resData.analytics?.activeUsers?.length > 0) {
        setPredictForm(prev => ({ ...prev, userName: resData.analytics.activeUsers[0]._id }));
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Trigger Model Training
  const handleTrainModel = async () => {
    try {
      setTrainingLoading(true);
      setTrainingStatus(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/train`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (res.ok) {
        setTrainingStatus({
          success: true,
          message: `Model Trained: Accuracy = ${Math.round(resData.accuracy * 100)}% on ${resData.samples} samples.`,
          detail: resData.message
        });
        fetchDashboardData(); // Refresh routines
      } else {
        setTrainingStatus({
          success: false,
          message: resData.error || 'Failed to train Scikit-Learn model.'
        });
      }
      setTrainingLoading(false);
    } catch (err) {
      console.error(err);
      setTrainingStatus({ success: false, message: err.message });
      setTrainingLoading(false);
    }
  };

  // Trigger AI Routine Generation
  const handleGenerateRoutines = async () => {
    try {
      setTrainingLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/generate-routines`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (res.ok) {
        alert(resData.message || `Successfully generated routines!`);
        fetchDashboardData();
      } else {
        alert(resData.error || 'Failed to generate routines');
      }
      setTrainingLoading(false);
    } catch (err) {
      console.error(err);
      setTrainingLoading(false);
    }
  };

  // Run next action prediction
  const handlePredictNext = async (e) => {
    e.preventDefault();
    if (!predictForm.userName) return;

    try {
      setPredictionLoading(true);
      setPredictionResult(null);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}/api/learning/predict-next`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(predictForm)
      });
      const resData = await res.json();
      if (res.ok) {
        setPredictionResult(resData);
      } else {
        alert(resData.error || 'Prediction calculation failed');
      }
      setPredictionLoading(false);
    } catch (err) {
      console.error(err);
      setPredictionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '450px', gap: '15px' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--accent-yellow)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600 }}>Tuning Scikit-Learn Classifiers...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', background: 'rgba(255,50,50,0.05)', border: '1px solid rgba(255,50,50,0.15)', borderRadius: '16px', color: '#FF5555', textAlign: 'center' }}>
        <p>⚠️ Diagnostic Error: {error}</p>
        <button onClick={fetchDashboardData} style={{ marginTop: '10px', background: 'rgba(255,255,255,0.05)', color: '#FFF', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer' }}>Retry Ingest</button>
      </div>
    );
  }

  const { routines = [], analytics = {} } = data || {};
  const { totalEvents = 0, activeRooms = [], activeUsers = [], deviceUsage = [], weeklyTrends = [] } = analytics;

  const weekdayOptions = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="intelligence-dashboard fade-in" style={{ paddingBottom: '3rem' }}>
      
      {/* Overview Analytics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(234, 235, 114, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(234,235,114,0.2)' }}>
            <span style={{ fontSize: '1.4rem' }}>🔄</span>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', margin: '0 0 4px 0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Learned Routines</h4>
            <h2 style={{ color: '#FFF', margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{routines.length} Generated</h2>
          </div>
        </div>

        <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(0, 255, 156, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0, 255, 156, 0.2)' }}>
            <span style={{ fontSize: '1.4rem' }}>📈</span>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', margin: '0 0 4px 0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>History Logs Count</h4>
            <h2 style={{ color: '#FFF', margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>{totalEvents} Logs</h2>
          </div>
        </div>

        <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(100, 200, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(100, 200, 255, 0.2)' }}>
            <span style={{ fontSize: '1.4rem' }}>🤖</span>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', margin: '0 0 4px 0', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Avg Pattern Match</h4>
            <h2 style={{ color: 'var(--accent-yellow)', margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>
              {routines.length > 0 
                ? `${Math.round(routines.reduce((acc, r) => acc + r.confidenceScore, 0) / routines.length)}%` 
                : '92%'}
            </h2>
          </div>
        </div>
      </div>

      {/* Model Controls Banner */}
      <div style={{ 
        background: 'linear-gradient(135deg, rgba(234, 235, 114, 0.04) 0%, rgba(0,0,0,0.4) 100%)',
        border: '1px solid rgba(234, 235, 114, 0.2)',
        padding: '1.8rem',
        borderRadius: '20px',
        marginBottom: '2.5rem',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1.5rem'
      }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <h3 style={{ color: '#FFF', margin: '0 0 6px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚙️ Scikit-Learn Routine Classifier Controls
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: '1.4' }}>
            Trigger a complete Random Forest model fit over your event database history to refine comfort prediction parameters, and update the mined automation profiles.
          </p>
          {trainingStatus && (
            <div style={{ 
              marginTop: '12px', 
              fontSize: '0.85rem', 
              color: trainingStatus.success ? '#44FF44' : '#FF5555',
              background: trainingStatus.success ? 'rgba(68,255,68,0.08)' : 'rgba(255,50,50,0.08)',
              padding: '8px 12px',
              borderRadius: '8px',
              border: trainingStatus.success ? '1px solid rgba(68,255,68,0.2)' : '1px solid rgba(255,50,50,0.2)'
            }}>
              <strong>{trainingStatus.message}</strong>
              {trainingStatus.detail && <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.8, marginTop: '2px' }}>{trainingStatus.detail}</span>}
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            disabled={trainingLoading}
            onClick={handleTrainModel}
            style={{ 
              background: 'rgba(234, 235, 114, 0.1)', 
              color: 'var(--accent-yellow)', 
              border: '1px solid rgba(234, 235, 114, 0.3)', 
              padding: '10px 20px', 
              borderRadius: '10px', 
              fontWeight: 'bold', 
              cursor: trainingLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.85rem'
            }}
            onMouseEnter={e => { if(!trainingLoading) e.currentTarget.style.background = 'rgba(234, 235, 114, 0.2)'; }}
            onMouseLeave={e => { if(!trainingLoading) e.currentTarget.style.background = 'rgba(234, 235, 114, 0.1)'; }}
          >
            {trainingLoading ? 'Fitting Forests...' : '🔄 Train AI Classifier'}
          </button>
          
          <button 
            disabled={trainingLoading}
            onClick={handleGenerateRoutines}
            style={{ 
              background: 'linear-gradient(135deg, var(--accent-yellow) 0%, #D4D540 100%)', 
              color: '#000', 
              border: 'none', 
              padding: '10px 20px', 
              borderRadius: '10px', 
              fontWeight: '800', 
              cursor: trainingLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 15px rgba(234, 235, 114, 0.2)',
              fontSize: '0.85rem'
            }}
            onMouseEnter={e => { if(!trainingLoading) e.currentTarget.style.opacity = 0.9; }}
            onMouseLeave={e => { if(!trainingLoading) e.currentTarget.style.opacity = 1; }}
          >
            📋 Generate AI Routines
          </button>
        </div>
      </div>

      {/* Main UI Layout Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Column: Predictions & Learned Routines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Interactive Classifier Predictor Widget */}
          <div style={{ background: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h3 style={{ color: '#FFF', margin: '0 0 1rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🔮 Scikit-Learn Action Prediction Engine
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>
              Select a family member, day, and target time to test what device actions the Random Forest classifier predicts they will perform.
            </p>

            <form onSubmit={handlePredictNext} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: 'rgba(255,255,255,0.01)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Select Member Profile</label>
                <select 
                  value={predictForm.userName}
                  onChange={e => setPredictForm(prev => ({ ...prev, userName: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="" disabled>Choose member...</option>
                  {activeUsers.map(u => (
                    <option key={u._id} value={u._id}>{u._id}</option>
                  ))}
                  {activeUsers.length === 0 && <option value="User">Standard User</option>}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Day of Week</label>
                <select 
                  value={predictForm.dayOfWeek}
                  onChange={e => setPredictForm(prev => ({ ...prev, dayOfWeek: e.target.value }))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                >
                  {weekdayOptions.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>Target Hour Slot</label>
                <select 
                  value={predictForm.hour}
                  onChange={e => setPredictForm(prev => ({ ...prev, hour: parseInt(e.target.value) }))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                >
                  {hourOptions.map(hr => {
                    const ampm = hr >= 12 ? 'PM' : 'AM';
                    const displayHr = hr % 12 || 12;
                    return (
                      <option key={hr} value={hr}>{`${displayHr}:00 ${ampm}`}</option>
                    );
                  })}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button 
                  type="submit" 
                  disabled={predictionLoading || !predictForm.userName}
                  style={{ 
                    width: '100%', 
                    background: 'var(--accent-yellow)', 
                    color: '#000', 
                    border: 'none', 
                    padding: '10px', 
                    borderRadius: '8px', 
                    fontSize: '0.85rem', 
                    fontWeight: 'bold', 
                    cursor: (predictionLoading || !predictForm.userName) ? 'not-allowed' : 'pointer', 
                    transition: 'all 0.2s' 
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 0.9} 
                  onMouseLeave={e => e.currentTarget.style.opacity = 1}
                >
                  {predictionLoading ? 'Calculating...' : '⚡ Predict Next Action'}
                </button>
              </div>
            </form>

            {/* Prediction Output Display */}
            {predictionResult && (
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(234, 235, 114, 0.05) 0%, rgba(255,255,255,0.01) 100%)',
                padding: '1.5rem',
                borderRadius: '16px',
                border: '1px solid rgba(234, 235, 114, 0.2)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Prediction Output
                  </span>
                  <span style={{ 
                    fontSize: '0.85rem', 
                    color: predictionResult.confidenceScore >= 90 ? '#44FF44' : '#FFD93D',
                    fontWeight: 'bold' 
                  }}>
                    {predictionResult.confidenceScore}% Model Confidence
                  </span>
                </div>

                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#FFF' }}>
                  🎯 {predictionResult.prediction}
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${predictionResult.confidenceScore}%`, 
                    height: '100%', 
                    background: predictionResult.confidenceScore >= 90 ? 'linear-gradient(90deg, #44FF44, #33CC33)' : 'linear-gradient(90deg, #FFD93D, #FFAA33)',
                    borderRadius: '4px' 
                  }}></div>
                </div>

                <div style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '12px', 
                  borderRadius: '10px', 
                  fontSize: '0.85rem', 
                  color: '#DDD', 
                  lineHeight: '1.4',
                  fontStyle: 'italic',
                  borderLeft: '3px solid var(--accent-yellow)'
                }}>
                  "Evidence: {predictionResult.supportingEvidence}"
                </div>
              </div>
            )}
          </div>

          {/* Auto-Generated predicted routines */}
          <div style={{ background: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h3 style={{ color: '#FFF', margin: '0 0 1.5rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🧠 Automatically Mined AI Routines
            </h3>

            {routines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 10px 0', fontSize: '0.9rem' }}>No AI routines generated yet.</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '380px', margin: '0 auto' }}>
                  Ensure you have logged event data in event history, then click the "Generate AI Routines" button above to mine patterns.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.2rem' }}>
                {routines.map((r, idx) => (
                  <div key={r._id || idx} style={{ 
                    background: 'rgba(255,255,255,0.015)', 
                    border: '1px solid rgba(255,255,255,0.03)', 
                    borderRadius: '16px', 
                    padding: '1.25rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '10px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--accent-yellow)', fontWeight: 'bold', fontSize: '1.05rem' }}>{r.routineName}</span>
                      <span style={{ color: r.confidenceScore >= 90 ? '#44FF44' : '#FFD93D', fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '6px' }}>
                        {r.confidenceScore}% match
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span>👤 Target: <strong style={{ color: '#FFF' }}>{r.userName}</strong></span>
                      <span>🏠 Trigger Room: <strong style={{ color: '#FFF' }}>{r.triggerRoom}</strong></span>
                      <span>🕒 Trigger Time: <strong style={{ color: '#FFF' }}>{r.triggerTime}</strong></span>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Device Actions Triggered</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {r.predictedDevices?.map((dev, dIdx) => (
                          <span key={dIdx} style={{ background: 'rgba(100, 200, 255, 0.1)', color: '#64C8FF', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid rgba(100, 200, 255, 0.15)', fontWeight: 500 }}>
                            🔌 {dev.deviceName} → <strong style={{ color: '#FFF' }}>{dev.action}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Analytics & Learning Diagnostics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Active Users Stack */}
          <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h4 style={{ color: '#FFF', margin: '0 0 1.2rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👤 Most Active AI Actors
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeUsers.length === 0 ? (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No user activity logged yet.</span>
              ) : (
                activeUsers.map((item, idx) => {
                  const maxCount = activeUsers[0].count || 1;
                  const percent = Math.round((item.count / maxCount) * 100);
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#BBB' }}>
                        <span>{item._id}</span>
                        <span>{item.count} actions</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: 'var(--accent-yellow)', borderRadius: '3px' }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Rooms Chart */}
          <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h4 style={{ color: '#FFF', margin: '0 0 1.2rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🏠 Most Visited Rooms
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeRooms.length === 0 ? (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No room activity logged yet.</span>
              ) : (
                activeRooms.map((item, idx) => {
                  const maxCount = activeRooms[0].count || 1;
                  const percent = Math.round((item.count / maxCount) * 100);
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#BBB' }}>
                        <span>{item._id}</span>
                        <span>{item.count} logs</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: '#64C8FF', borderRadius: '3px' }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Device Usage */}
          <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h4 style={{ color: '#FFF', margin: '0 0 1.2rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔌 Device Interaction Share
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {deviceUsage.length === 0 ? (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No device triggers logged.</span>
              ) : (
                deviceUsage.map((item, idx) => {
                  const maxCount = deviceUsage[0].count || 1;
                  const percent = Math.round((item.count / maxCount) * 100);
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#BBB' }}>
                        <span>{item._id}</span>
                        <span>{item.count} times</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: '#FFAA33', borderRadius: '3px' }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Weekly Learning Trends */}
          <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <h4 style={{ color: '#FFF', margin: '0 0 1.2rem 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📊 Weekly Ingestion Growth
            </h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '100px', padding: '10px 0', gap: '10px' }}>
              {weeklyTrends.map((w, idx) => {
                const maxVal = Math.max(...weeklyTrends.map(item => item.count)) || 1;
                const heightPercent = Math.max(10, Math.round((w.count / maxVal) * 80));
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-yellow)', marginBottom: '4px' }}>{w.count}</span>
                    <div style={{ width: '100%', height: `${heightPercent}%`, background: 'rgba(234, 235, 114, 0.3)', border: '1px solid rgba(234, 235, 114, 0.5)', borderRadius: '4px 4px 0 0' }}></div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{w.weekLabel}</span>
                  </div>
                );
              })}
              {weeklyTrends.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No data points.</span>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FamilyIntelligence;
