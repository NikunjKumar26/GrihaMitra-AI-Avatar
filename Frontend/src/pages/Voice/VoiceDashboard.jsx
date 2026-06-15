import React, { useState, useEffect, useRef } from 'react';

const VoiceDashboard = ({ homeInfo }) => {
  const [history, setHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyticsTab, setAnalyticsTab] = useState('speaker');
  
  // Controls
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedMember, setSelectedMember] = useState('Owner');
  const [membersList, setMembersList] = useState([]);
  const [processingCommand, setProcessingCommand] = useState(false);
  const [sessionId, setSessionId] = useState('');

  // Audio Playback
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  // Refs
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    // Retrieve or initialize conversation session ID
    let sid = localStorage.getItem('voice_session_id');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('voice_session_id', sid);
    }
    setSessionId(sid);

    fetchDashboardData();
    fetchFamilyMembers();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/voice-dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch voice dashboard');
      
      setHistory(data.history || []);
      setAnalytics(data.analytics || null);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchFamilyMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembersList(data || []);
      }
    } catch (err) {
      console.error('Error fetching family members:', err);
    }
  };

  const resetSession = () => {
    const newSid = 'session_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('voice_session_id', newSid);
    setSessionId(newSid);
    alert('Conversation memory session reset.');
  };

  const playVoiceResponse = async (textToSpeak) => {
    try {
      setIsPlayingAudio(true);
      const token = localStorage.getItem('token');
      const voiceProfile = getVoiceProfileForMember(selectedMember);

      // Determine speaking parameters ( Grandmother speaks slower)
      const speakingRole = getRoleForMember(selectedMember);
      const speedRate = speakingRole === 'Grandmother' ? 'slow' : 'medium';

      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: textToSpeak, voiceProfile, speedRate })
      });

      if (res.ok) {
        const contentType = res.headers.get('Content-Type');
        if (contentType && contentType.includes('audio/mpeg')) {
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audio.onended = () => setIsPlayingAudio(false);
          audio.onerror = () => {
            console.error('Audio stream play failure. Fallback to web TTS.');
            playLocalTTSFallback(textToSpeak, speedRate);
          };
          await audio.play();
          return;
        } else {
          const data = await res.json();
          if (data.fallback) {
            playLocalTTSFallback(textToSpeak, speedRate);
            return;
          }
        }
      }
      playLocalTTSFallback(textToSpeak, speedRate);
    } catch (err) {
      console.error('Polly API failed. Fallback to web TTS:', err);
      playLocalTTSFallback(textToSpeak);
    }
  };

  const playLocalTTSFallback = (textToSpeak, speedRate) => {
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-IN';
      
      // Speed adjustments
      if (speedRate === 'slow') {
        utterance.rate = 0.75;
      } else {
        utterance.rate = 1.0;
      }
      
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      synth.speak(utterance);
    } else {
      setIsPlayingAudio(false);
    }
  };

  const getVoiceProfileForMember = (name) => {
    const found = membersList.find(m => m.name === name);
    return found ? found.voiceProfile : 'Aditi';
  };

  const getRoleForMember = (name) => {
    const found = membersList.find(m => m.name === name);
    return found ? found.role : 'Owner';
  };

  const getAvatarForUser = (username) => {
    const role = getRoleForMember(username);
    if (role === 'Father') return '👨';
    if (role === 'Mother') return '👩';
    if (role === 'Grandmother') return '👵';
    if (role === 'Student') return '🧑‍🎓';
    return '👤';
  };

  const handleSendCommand = async (commandText) => {
    if (!commandText.trim()) return;
    try {
      setProcessingCommand(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/voice-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          text: commandText, 
          memberName: selectedMember,
          sessionId: sessionId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute voice command');

      // Add to list and update stats
      if (data.voiceLog) {
        setHistory(prev => [data.voiceLog, ...prev]);
      }
      
      setInputText('');
      setProcessingCommand(false);

      // Refresh dashboard analytics in the background
      fetchDashboardData();

      // Play Polly response
      if (data.response) {
        await playVoiceResponse(data.response);
      }
    } catch (err) {
      alert(`Command Error: ${err.message}`);
      setProcessingCommand(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser. Please type or use Chrome.");
      return;
    }

    setIsRecording(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        handleSendCommand(transcript);
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech recognition error', e.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error('Failed to start speech engine:', err);
      setIsRecording(false);
    }
  };

  if (loading && !analytics) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text-secondary)' }}>
        <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderLeftColor: 'var(--accent-yellow)', width: '40px', height: '40px', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <span style={{ marginLeft: '15px', fontWeight: 600 }}>Connecting to Production Voice Engine...</span>
      </div>
    );
  }

  // Expanded analytics values
  const total = analytics?.totalCommands || 0;
  const conversations = analytics?.totalConversations || 0;
  const avgSessionLen = analytics?.averageSessionLength || 0;
  const voiceSuccessRate = analytics?.voiceSuccessRate || 100;
  const intents = analytics?.intentDistribution || {};
  const hourlyActivity = analytics?.hourlyActivity || Array(24).fill(0);
  const deviceCounts = analytics?.deviceCounts || {};
  const languages = analytics?.languageDistribution || { English: 0, Hindi: 0, Mixed: 0 };
  const activeUsers = analytics?.mostActiveUsers || [];
  const maxHourlyVal = Math.max(...hourlyActivity, 1);
  const avgLatency = history.length > 0 ? Math.round(history.reduce((sum, item) => sum + (item.processingTime || 0), 0) / history.length) : 0;

  return (
    <div className="fade-in" style={{ paddingBottom: '3rem' }}>
      
      {/* Header Panel */}
      <div style={{ 
        background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', 
        border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 5px 0', fontSize: '1.8rem', fontWeight: 800 }}>
            🎙️ Production Voice Engine (Pre-Phase 7)
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            Asynchronous task queue flow via BullMQ + Redis, multi-turn memory caching, Whisper STT, and neural Polly TTS.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Redis Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Redis:</span>
            <span style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '5px', 
              background: analytics?.redisStatus === 'online' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', 
              color: analytics?.redisStatus === 'online' ? '#22C55E' : '#EF4444', 
              padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold', 
              border: analytics?.redisStatus === 'online' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(239,68,68,0.3)'
            }}>
              <span style={{ 
                width: '6px', height: '6px', borderRadius: '50%', 
                background: analytics?.redisStatus === 'online' ? '#22C55E' : '#EF4444',
                boxShadow: analytics?.redisStatus === 'online' ? '0 0 6px #22C55E' : '0 0 6px #EF4444' 
              }}></span>
              {analytics?.redisStatus === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>

          <button 
            onClick={resetSession}
            style={{ background: 'rgba(255,50,50,0.1)', color: '#FF5555', border: '1px solid rgba(255,50,50,0.2)', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 'bold', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,50,50,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,50,50,0.1)'}
          >
            Reset Memory Session
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Column: Conversational Console */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ 
            background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', 
            borderRadius: '16px', padding: '1.5rem', height: '520px', 
            display: 'flex', flexDirection: 'column', justifyItems: 'space-between',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            
            {/* Console Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isRecording ? '#FF3333' : '#22C55E', boxShadow: isRecording ? '0 0 10px #FF3333' : 'none' }}></div>
                <strong style={{ color: '#FFF', fontSize: '0.95rem' }}>GrihaMitra Dialogue Terminal</strong>
              </div>

              {/* Profile Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Speak as:</span>
                <select 
                  value={selectedMember} 
                  onChange={(e) => setSelectedMember(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#FFF', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                >
                  <option value="Owner">Owner (Nikunj)</option>
                  {membersList.map(m => (
                    <option key={m._id} value={m.name}>{m.name} ({m.role})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conversation Feed */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', gap: '15px', paddingRight: '5px', marginBottom: '15px' }}>
              <div ref={chatEndRef} />
              
              {history.length > 0 ? (
                history.map((log) => (
                  <div key={log._id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* User Transcript */}
                    <div style={{ alignSelf: 'flex-end', background: 'rgba(234, 235, 114, 0.08)', border: '1px solid rgba(234, 235, 114, 0.15)', borderRadius: '14px 14px 0 14px', padding: '10px 14px', maxWidth: '80%', alignSelf: 'flex-end' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-yellow)', fontWeight: 'bold' }}>{log.user} ({log.language || 'English'})</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <span style={{ color: '#FFF', fontSize: '0.88rem' }}>"{log.transcript}"</span>
                    </div>

                    {/* AI Response */}
                    <div style={{ alignSelf: 'flex-start', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px 14px 14px 0', padding: '10px 14px', maxWidth: '80%', alignSelf: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', color: '#22C55E', fontWeight: 'bold' }}>🤖 GrihaMitra</span>
                        <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                          {log.intent?.replace('_', ' ')}
                        </span>
                        
                        {/* Upgraded Confidence & Processing Metadata */}
                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>
                          Confidence: {Math.round(((log.speechConfidence || 100) + (log.intentConfidence || 100)) / 2)}% | {log.processingTime || 0}ms
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>{log.response}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>
                  No voice session logs yet. Tap the microphone or type below to start!
                </div>
              )}
            </div>

            {/* Input Bar & Recording Waveform */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}>
              
              {/* Record Waveform animation */}
              {isRecording && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', height: '24px', marginBottom: '5px' }}>
                  <div style={{ width: '3px', height: '12px', background: 'var(--accent-yellow)', borderRadius: '2px', animation: 'quiet 1.2s ease-in-out infinite' }}></div>
                  <div style={{ width: '3px', height: '20px', background: 'var(--accent-yellow)', borderRadius: '2px', animation: 'loud 1.2s ease-in-out infinite' }}></div>
                  <div style={{ width: '3px', height: '14px', background: 'var(--accent-yellow)', borderRadius: '2px', animation: 'quiet 1.2s ease-in-out infinite' }}></div>
                  <span style={{ color: 'var(--accent-yellow)', fontSize: '0.75rem', fontWeight: 600, marginLeft: '6px' }}>Recording locally via Whisper... Speak now</span>
                </div>
              )}

              {/* TextInput / Record Row */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                
                {/* Glowing Mic button */}
                <button 
                  onClick={handleToggleRecording}
                  title={isRecording ? "Stop Listening" : "Start Voice Recording"}
                  style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: isRecording ? '#FF3333' : 'rgba(255,255,255,0.05)',
                    color: isRecording ? '#FFF' : 'var(--accent-yellow)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isRecording ? '0 0 15px #FF3333' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={isRecording ? '#FFF' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </button>

                {/* Keyboard command entry */}
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendCommand(inputText); }}
                  placeholder="Ask a question or type home command..."
                  disabled={processingCommand || isRecording}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '24px', padding: '10px 18px', color: '#FFF', fontSize: '0.9rem',
                    outline: 'none', transition: 'all 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent-yellow)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />

                {/* Send Button */}
                <button 
                  onClick={() => handleSendCommand(inputText)}
                  disabled={!inputText.trim() || processingCommand || isRecording}
                  style={{
                    padding: '10px 20px', borderRadius: '24px',
                    background: 'var(--accent-yellow)', color: '#000',
                    border: 'none', fontWeight: 'bold', cursor: 'pointer',
                    opacity: (!inputText.trim() || processingCommand || isRecording) ? 0.5 : 1
                  }}
                >
                  {processingCommand ? 'Thinking...' : 'Send'}
                </button>
              </div>

            </div>

          </div>

          {/* Quick command buttons suggestions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', alignSelf: 'center', marginRight: '5px' }}>Suggestions:</span>
            {[
              "Turn on the Bedroom AC",
              "Bedroom",
              "Why did you turn on the motor?",
              "What is the water tank level?",
              "What routines have you learned?",
              "What will happen next?"
            ].map((cmd, i) => (
              <button 
                key={i} 
                onClick={() => handleSendCommand(cmd)}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-yellow)'; e.currentTarget.style.color = '#FFF'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                {cmd}
              </button>
            ))}
          </div>

        </div>

        {/* Right Column: Upgraded Voice Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Card: Audio status */}
          <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <div style={{ 
              width: '50px', height: '50px', borderRadius: '50%', 
              background: isPlayingAudio ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.02)',
              border: isPlayingAudio ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isPlayingAudio ? '#22C55E' : 'var(--text-secondary)'
            }}>
              {isPlayingAudio ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spin-slow">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              )}
            </div>
            <div>
              <strong style={{ display: 'block', color: '#FFF', fontSize: '0.9rem' }}>Audio Synthesis Status</strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {isPlayingAudio ? 'Polly Neural Audio active (playing speech)' : 'Idle (ready for command)'}
              </span>
            </div>
          </div>

          {/* Sub-panels Navigation Tabs */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.02)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', gap: '6px' }}>
            {[
              { id: 'speaker', label: 'Speaker', icon: '👤' },
              { id: 'session', label: 'Session', icon: '💬' },
              { id: 'queue', label: 'Queue', icon: '⚙️' },
              { id: 'speech', label: 'Speech', icon: '🎙️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAnalyticsTab(tab.id)}
                style={{
                  flex: 1,
                  background: analyticsTab === tab.id ? 'var(--accent-yellow)' : 'transparent',
                  color: analyticsTab === tab.id ? '#000' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Sub-panel Content */}
          {analyticsTab === 'speaker' && (
            <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700 }}>Speaker Personalization Layer</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Voice print identification & speaker mapping</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-yellow)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {analytics?.speakerAnalytics?.mostActiveUser || 'Owner'}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Primary Speaker</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 800, color: '#10B981' }}>
                    {analytics?.speakerAnalytics?.conversationsPerUser?.length || 0}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Active Profiles</span>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '10px' }}>User Dialogue Distribution</span>
                {analytics?.speakerAnalytics?.conversationsPerUser && analytics.speakerAnalytics.conversationsPerUser.length > 0 ? (
                  analytics.speakerAnalytics.conversationsPerUser.map((user, idx) => {
                    const totalCommands = total || 1;
                    const pct = Math.round((user.count / totalCommands) * 100);
                    return (
                      <div key={idx} style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                          <span style={{ color: '#FFF', fontWeight: 600 }}>{user.name} ({getRoleForMember(user.name)})</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{user.count} commands ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #F59E0B, #10B981)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>No speaker activity recorded yet.</span>
                )}
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Biometric Verification Logs</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analytics?.speakerAnalytics?.speakerConfidenceTrends && analytics.speakerAnalytics.speakerConfidenceTrends.length > 0 ? (
                    analytics.speakerAnalytics.speakerConfidenceTrends.slice(0, 4).map((trend, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem' }}>{getAvatarForUser(trend.label)}</span>
                          <div>
                            <strong style={{ color: '#FFF', fontSize: '0.8rem', display: 'block' }}>{trend.label}</strong>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{new Date(trend.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ color: (trend.value || 100) >= 90 ? '#10B981' : 'var(--accent-yellow)', fontWeight: 'bold', fontSize: '0.8rem' }}>
                            {trend.value || 100}% Match
                          </span>
                          <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Speaker Profile Verified</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'center', padding: '10px' }}>No verification logs yet</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {analyticsTab === 'session' && (
            <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700 }}>Dialogue Session Analytics</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Multi-turn conversation window & memory state</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-yellow)' }}>
                    {analytics?.sessionAnalytics?.averageSessionLength || 0} turns
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Avg Session Length</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: '#3B82F6' }}>
                    {analytics?.sessionAnalytics?.longestSession || 0} turns
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Longest Dialogue</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '1.4rem', fontWeight: 800, color: '#10B981' }}>
                    {analytics?.sessionAnalytics?.averageConfidence || 0}%
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Dialogue Confidence</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#A855F7', padding: '5px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {analytics?.sessionAnalytics?.mostUsedIntent?.replace('_', ' ') || 'general_chat'}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Most Used Intent</span>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Dialogue Intent Distribution</span>
                {analytics?.mostCommonIntents && analytics.mostCommonIntents.length > 0 ? (
                  analytics.mostCommonIntents.slice(0, 4).map((entry, idx) => {
                    const totalIntents = Object.values(intents).reduce((a, b) => a + b, 0) || 1;
                    const pct = Math.round((entry.count / totalIntents) * 100);
                    return (
                      <div key={idx} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{entry.intent.replace('_', ' ')}</span>
                          <span style={{ color: '#FFF', fontWeight: 600 }}>{entry.count} ({pct}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-yellow)', borderRadius: '2px' }}></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>No intent analytics compiled yet.</span>
                )}
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Common Voice Queries</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {analytics?.mostAskedQuestions && analytics.mostAskedQuestions.length > 0 ? (
                    analytics.mostAskedQuestions.slice(0, 3).map((q, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem', color: '#FFF', width: '100%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        💬 "{q}"
                      </div>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>No dialogue queries loaded.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {analyticsTab === 'queue' && (
            <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700 }}>Queue Observability & Telemetry</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>BullMQ task pipelines & job status</span>
                </div>
                <span style={{ 
                  background: analytics?.redisStatus === 'online' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', 
                  color: analytics?.redisStatus === 'online' ? '#22C55E' : '#EF4444', 
                  padding: '3px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 'bold'
                }}>
                  Redis: {analytics?.redisStatus === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 4px', color: '#FFF' }}>Queue</th>
                      <th style={{ padding: '6px 4px', color: '#FFF', textAlign: 'center' }}>Health</th>
                      <th style={{ padding: '6px 4px', color: '#FFF', textAlign: 'center' }}>Success</th>
                      <th style={{ padding: '6px 4px', color: '#FFF', textAlign: 'center' }}>Jobs (P/F)</th>
                      <th style={{ padding: '6px 4px', color: '#FFF', textAlign: 'center' }}>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['SpeechToText', 'BedrockProcessing', 'PollyGeneration', 'VoiceAnalytics', 'FutureAvatar'].map(qName => {
                      const qMetric = analytics?.queueMetrics?.find(m => m.queue === qName) || {
                        jobsProcessed: 0,
                        failedJobs: 0,
                        averageProcessingTime: 0,
                        queueLength: 0,
                        queueHealthScore: 100,
                        successRate: 100,
                        retryCounts: 0
                      };
                      
                      let healthColor = '#10B981';
                      if (qMetric.queueHealthScore < 70) healthColor = '#EF4444';
                      else if (qMetric.queueHealthScore < 90) healthColor = '#F59E0B';

                      return (
                        <React.Fragment key={qName}>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '10px 4px', color: '#FFF', fontWeight: 600 }}>
                              {qName.replace('Processing', '').replace('Generation', '')}
                            </td>
                            <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                              <span style={{ color: healthColor, fontWeight: 'bold' }}>
                                {Math.round(qMetric.queueHealthScore)}%
                              </span>
                            </td>
                            <td style={{ padding: '10px 4px', textAlign: 'center', color: qMetric.successRate >= 90 ? '#10B981' : '#F59E0B' }}>
                              {Math.round(qMetric.successRate)}%
                            </td>
                            <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                              {qMetric.jobsProcessed} / <span style={{ color: qMetric.failedJobs > 0 ? '#EF4444' : 'var(--text-secondary)' }}>{qMetric.failedJobs}</span>
                            </td>
                            <td style={{ padding: '10px 4px', textAlign: 'center', color: 'var(--accent-yellow)' }}>
                              {qMetric.averageProcessingTime}ms
                            </td>
                          </tr>
                          {qMetric.lastFailureReason && (
                            <tr key={`${qName}-err`}>
                              <td colSpan="5" style={{ padding: '4px 8px 8px 8px' }}>
                                <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '6px', fontSize: '0.7rem', color: '#FCA5A5' }}>
                                  <strong>Last Error:</strong> {qMetric.lastFailureReason} 
                                  <span style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.65rem' }}>
                                    Failed at: {new Date(qMetric.lastFailureAt).toLocaleString()}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {analyticsTab === 'speech' && (
            <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700 }}>Speech Engine Analytics</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Offline transcription models & performance details</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Whisper Inference Model Selection</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '15px' }}>
                  {Object.entries(analytics?.speechAnalytics?.modelUsage || { tiny: 0, base: 0, small: 0 }).map(([model, count]) => (
                    <div key={model} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px 5px', borderRadius: '8px', textAlign: 'center' }}>
                      <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--accent-yellow)' }}>{count}</strong>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{model} size</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Language Recognition Share</span>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem' }}>
                  {Object.entries(analytics?.speechAnalytics?.languageDetectionDistribution || languages).map(([lang, count]) => {
                    const totalLangs = Object.values(analytics?.speechAnalytics?.languageDetectionDistribution || languages).reduce((a, b) => a + b, 0) || 1;
                    const pct = Math.round((count / totalLangs) * 100);
                    return (
                      <div key={lang} style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                        <span style={{ color: '#FFF', display: 'block', fontWeight: 'bold' }}>{pct}%</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>{lang}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Speech Confidence Trends (Last 5)</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {analytics?.speechAnalytics?.confidenceTrends && analytics.speechAnalytics.confidenceTrends.length > 0 ? (
                    analytics.speechAnalytics.confidenceTrends.slice(0, 5).map((pt, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{pt.label}</span>
                        <strong style={{ color: pt.value >= 90 ? '#10B981' : 'var(--accent-yellow)' }}>{pt.value}% Confidence</strong>
                      </div>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>No confidence stats.</span>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Inference Latency Timeline (Last 5)</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {analytics?.speechAnalytics?.latencyTrends && analytics.speechAnalytics.latencyTrends.length > 0 ? (
                    analytics.speechAnalytics.latencyTrends.slice(0, 5).map((pt, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{pt.label}</span>
                        <strong style={{ color: 'var(--accent-yellow)' }}>{pt.value} ms</strong>
                      </div>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>No latency logs.</span>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Styled Micro-animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes quiet {
          0%, 100% { transform: scaleY(0.6); }
          50% { transform: scaleY(1); }
        }
        @keyframes loud {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.8); }
        }
        .spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}} />

    </div>
  );
};

export default VoiceDashboard;
