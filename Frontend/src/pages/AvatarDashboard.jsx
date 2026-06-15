import React, { useState, useEffect, useRef } from 'react';
import avatarFace from '../assets/avatar_face.png';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : `${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}`;

const AvatarDashboard = ({ homeInfo, socket }) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedMember, setSelectedMember] = useState('Owner');
  const [membersList, setMembersList] = useState([]);
  const [processingCommand, setProcessingCommand] = useState(false);
  const [sessionId, setSessionId] = useState('');
  
  // Avatar Visual States
  const [avatarState, setAvatarState] = useState('Listening'); // Listening, Thinking, Speaking, Explaining, Alerting, Greeting
  const [emotionState, setEmotionState] = useState('Normal'); // Normal, Happy, Alert, Concerned, Greeting, Celebration
  const [currentResponseText, setCurrentResponseText] = useState('Awaiting command. Establishing WebRTC avatar stream...');
  
  // Audio playback and Lip-Sync states (Polly fallback)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioWaves, setAudioWaves] = useState([10, 10, 10, 10, 10, 10, 10]);
  const animationRef = useRef(null);

  // WebRTC / Stream Monitor states
  const [webrtcState, setWebrtcState] = useState('Disconnected');
  const [isMockSession, setIsMockSession] = useState(true);
  const [videoTrackActive, setVideoTrackActive] = useState(false);
  const [audioTrackActive, setAudioTrackActive] = useState(false);
  const [streamHealth, setStreamHealth] = useState('Stable');
  const pcRef = useRef(null);

  // Dialogue memory & metrics
  const [memoryList, setMemoryList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [retrievedSummary, setRetrievedSummary] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [usageAnalytics, setUsageAnalytics] = useState(null);
  const [analyticsSubTab, setAnalyticsSubTab] = useState('engagement');
  const [activeTab, setActiveTab] = useState('interact'); // interact, memory, analytics, scheduler, stream
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Scheduler / Proactive states
  const [scheduledAlerts, setScheduledAlerts] = useState([
    { type: 'water_tank', title: '💧 Water Reservoir Low Alert', desc: 'Runs motor when capacity falls below 15%', priority: 'Medium', interval: '3m' },
    { type: 'security', title: '🚨 Balcony Intrusion Alarm', desc: 'Triggers sirens if motion is detected after hours', priority: 'High', interval: '30s' },
    { type: 'power_failure', title: '⚡ Power Grid Failure Warning', desc: 'Swaps subsystems to inverter battery backups', priority: 'Medium', interval: '3m' },
    { type: 'routine', title: '📅 Daily Study Reminder', desc: 'Warms up study room light before study starts', priority: 'Low', interval: '10m' }
  ]);
  const [triggeredAnnouncements, setTriggeredAnnouncements] = useState([]);

  const recognitionRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchFamilyMembers();
    fetchAvatarMemory();
    fetchAvatarAnalytics();
    fetchUsageAnalytics();
    
    // Initialize WebRTC session
    initializeWebRTCSession(selectedMember);

    return () => {
      cleanupWebRTC();
    };
  }, []);

  // Re-establish session when selected member profile changes (personality voice mapping switches)
  const handleProfileChange = (e) => {
    const newMember = e.target.value;
    setSelectedMember(newMember);
    setCurrentResponseText(`Profile switched to ${newMember}. Re-negotiating HeyGen WebRTC stream...`);
    initializeWebRTCSession(newMember);
  };

  // WebSockets updates for Proactive Alerts & Speech Tasks
  useEffect(() => {
    if (socket) {
      socket.on('avatarAlert', (data) => {
        setAvatarState(data.avatarState || 'Alerting');
        setEmotionState(data.emotionState || 'Alert');
        setCurrentResponseText(data.text);
        
        // Log alert in triggered list
        setTriggeredAnnouncements(prev => [
          { time: new Date().toLocaleTimeString(), type: data.alertType, text: data.text },
          ...prev.slice(0, 9)
        ]);

        if (data.heygenStatus !== 'triggered') {
          // Trigger local waveform lip-sync if HeyGen is not actively streaming speech
          simulateSpeakingWave(6000);
        }
      });

      socket.on('avatarSpeak', (data) => {
        setAvatarState(data.avatarState || 'Speaking');
        setEmotionState(data.emotionState || 'Normal');
        setCurrentResponseText(data.text);
        
        if (data.heygenStatus !== 'triggered') {
          simulateSpeakingWave(5000);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('avatarAlert');
        socket.off('avatarSpeak');
      }
    };
  }, [socket]);

  // Handle local speaking waveform visual simulation (reacts while isPlayingAudio is true)
  useEffect(() => {
    if (isPlayingAudio) {
      const runWaveform = () => {
        setAudioWaves(prev => prev.map(() => Math.floor(Math.random() * 40) + 5));
        animationRef.current = requestAnimationFrame(runWaveform);
      };
      animationRef.current = requestAnimationFrame(runWaveform);
    } else {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setAudioWaves([5, 5, 5, 5, 5, 5, 5]);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlayingAudio]);

  const cleanupWebRTC = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setWebrtcState('Disconnected');
    setVideoTrackActive(false);
    setAudioTrackActive(false);
  };

  const initializeWebRTCSession = async (memberName) => {
    cleanupWebRTC();
    setWebrtcState('Negotiating...');
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/avatar/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          quality: 'medium',
          avatarName: 'Bryan_FitnessCoach_public',
          memberName: memberName
        })
      });

      if (!res.ok) throw new Error('Create session request failed.');
      
      const sessionData = await res.json();
      setSessionId(sessionData.sessionId);
      setIsMockSession(sessionData.isMock);

      if (sessionData.isMock) {
        setWebrtcState('Connected (Simulated)');
        setVideoTrackActive(true);
        setAudioTrackActive(true);
        setStreamHealth('Stable (Offline Mock)');
        setCurrentResponseText(`Simulated HeyGen session established for ${memberName}. Ready.`);
        return;
      }

      // Configure Real WebRTC RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: sessionData.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      // Track connection changes
      pc.oniceconnectionstatechange = () => {
        setWebrtcState(pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected') {
          setStreamHealth('Excellent');
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setStreamHealth('Unstable / Reconnecting');
        }
      };

      // Set up media receiver
      pc.ontrack = (event) => {
        console.log('Received remote media stream track:', event.track.kind);
        if (event.track.kind === 'video') {
          setVideoTrackActive(true);
        } else if (event.track.kind === 'audio') {
          setAudioTrackActive(true);
        }

        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        const videoElement = document.getElementById('heygen-stream-video');
        if (videoElement) {
          videoElement.srcObject = remoteStream;
          videoElement.play().catch(e => console.warn('Autoplay blocked, user interaction required:', e));
        }
      };

      // Set remote SDP offer
      await pc.setRemoteDescription(new RTCSessionDescription(sessionData.sdp));

      // Create and set local answer SDP
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Finalize WebRTC start handshake
      const startRes = await fetch(`${API_BASE}/api/avatar/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          sdp: {
            type: 'answer',
            sdp: answer.sdp
          }
        })
      });

      if (startRes.ok) {
        setWebrtcState('Connected');
        setCurrentResponseText(`HeyGen Streaming Session started for ${memberName}. Ready to chat.`);
      } else {
        throw new Error('Start handshake failed.');
      }

    } catch (err) {
      console.warn('HeyGen WebRTC initiation failed. Reverting to Mock Fallback representation.', err.message);
      setWebrtcState('Fallback Active');
      setIsMockSession(true);
      setVideoTrackActive(true);
      setAudioTrackActive(true);
      setStreamHealth('Stable (Local Fallback)');
      setCurrentResponseText(`HeyGen WebRTC failed. Reverted to Polly Voice Engine Fallback.`);
    }
  };

  const fetchFamilyMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/family/members`, {
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

  const fetchAvatarMemory = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/avatar/memory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMemoryList(data || []);
      }
      setLoadingHistory(false);
    } catch (err) {
      console.error('Error fetching avatar memory:', err);
      setLoadingHistory(false);
    }
  };

  const fetchAvatarAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/avatar/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching avatar analytics:', err);
    }
  };

  const fetchUsageAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/avatar/analytics/usage`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsageAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching usage analytics:', err);
    }
  };

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('token');
      // Request Bedrock-powered memory summarization
      const res = await fetch(`${API_BASE}/api/avatar/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: `summarize memory query: ${searchQuery}`,
          memberName: selectedMember,
          sessionId: sessionId,
          runBedrock: true
        })
      });
      const data = await res.json();
      setRetrievedSummary(data.text);
      setLoadingHistory(false);
    } catch (err) {
      console.error(err);
      setLoadingHistory(false);
    }
  };

  const playVoiceResponse = async (textToSpeak, voice, speedRate) => {
    try {
      setIsPlayingAudio(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/family/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: textToSpeak, voiceProfile: voice, speedRate })
      });

      if (res.ok) {
        const contentType = res.headers.get('Content-Type');
        if (contentType && contentType.includes('audio/mpeg')) {
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audio.onended = () => setIsPlayingAudio(false);
          audio.onerror = () => {
            console.error('Audio synthesis stream play failure. Fallback to local synthesis.');
            playLocalTTSFallback(textToSpeak, speedRate);
          };
          await audio.play();
          return;
        }
      }
      playLocalTTSFallback(textToSpeak, speedRate);
    } catch (err) {
      console.error('TTS endpoint failed, fallback to local voice:', err);
      playLocalTTSFallback(textToSpeak, speedRate);
    }
  };

  const playLocalTTSFallback = (textToSpeak, speedRate) => {
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-IN';
      utterance.rate = speedRate === 'slow' ? 0.75 : 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      synth.speak(utterance);
    } else {
      setIsPlayingAudio(false);
    }
  };

  const simulateSpeakingWave = (durationMs) => {
    setIsPlayingAudio(true);
    setTimeout(() => {
      setIsPlayingAudio(false);
    }, durationMs);
  };

  const handleSendCommand = async (commandText) => {
    if (!commandText.trim()) return;
    try {
      setProcessingCommand(true);
      setAvatarState('Thinking');
      setEmotionState('Normal');
      
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/avatar/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: commandText,
          memberName: selectedMember,
          sessionId: sessionId,
          runBedrock: true
        })
      });

      const data = await res.json();
      setProcessingCommand(false);
      setInputText('');

      if (!res.ok) throw new Error(data.error || 'Failed to communicate with avatar');

      // Update active states
      setAvatarState(data.avatarState);
      setEmotionState(data.emotionState);
      setCurrentResponseText(data.text);
      
      // Update memory & analytics
      fetchAvatarMemory();
      fetchAvatarAnalytics();
      fetchUsageAnalytics();

      // Only play the Polly audio stream if we are in mock mode (prevents echoing on HeyGen streams)
      if (data.heygenStatus !== 'triggered') {
        await playVoiceResponse(data.text, data.voice, data.speedRate);
      }

    } catch (err) {
      alert(`Avatar Error: ${err.message}`);
      setProcessingCommand(false);
      setAvatarState('Listening');
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
      alert("Browser speech recognition not supported. Please type or use Chrome.");
      return;
    }

    setIsRecording(true);
    setAvatarState('Listening');
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

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  };

  const triggerProactiveAlert = async (type) => {
    try {
      setProcessingCommand(true);
      setAvatarState('Thinking');
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/avatar/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: `simulate alert: ${type}`,
          memberName: selectedMember,
          sessionId: sessionId,
          runBedrock: false
        })
      });
      const data = await res.json();
      setProcessingCommand(false);
      
      if (res.ok) {
        setAvatarState(data.avatarState);
        setEmotionState(data.emotionState);
        setCurrentResponseText(data.text);
        fetchAvatarMemory();
        
        // Log alert trigger
        setTriggeredAnnouncements(prev => [
          { time: new Date().toLocaleTimeString(), type: type, text: data.text },
          ...prev.slice(0, 9)
        ]);

        if (data.heygenStatus !== 'triggered') {
          await playVoiceResponse(data.text, 'Aditi', 'medium');
        }
      }
    } catch (err) {
      console.error(err);
      setProcessingCommand(false);
      setAvatarState('Listening');
    }
  };

  // Get glow border coordinates based on active emotion/state
  const getAvatarVisualTheme = () => {
    if (avatarState === 'Thinking') return { border: 'radial-gradient(circle, #F59E0B 0%, rgba(0,0,0,0) 70%)', shadow: 'rgba(245,158,11,0.3)', aura: '#F59E0B' };
    if (avatarState === 'Alerting') return { border: 'radial-gradient(circle, #EF4444 0%, rgba(0,0,0,0) 70%)', shadow: 'rgba(239,68,68,0.5)', aura: '#EF4444' };
    if (avatarState === 'Greeting') return { border: 'radial-gradient(circle, #10B981 0%, rgba(0,0,0,0) 70%)', shadow: 'rgba(16,185,129,0.4)', aura: '#10B981' };
    if (avatarState === 'Explaining') return { border: 'radial-gradient(circle, #A855F7 0%, rgba(0,0,0,0) 70%)', shadow: 'rgba(168,85,247,0.4)', aura: '#A855F7' };
    if (isPlayingAudio) return { border: 'radial-gradient(circle, #10B981 0%, rgba(0,0,0,0) 70%)', shadow: 'rgba(16,185,129,0.4)', aura: '#10B981' };
    return { border: 'radial-gradient(circle, #3B82F6 0%, rgba(0,0,0,0) 70%)', shadow: 'rgba(59,130,246,0.25)', aura: '#3B82F6' };
  };

  const theme = getAvatarVisualTheme();

  return (
    <div className="fade-in" style={{ paddingBottom: '3rem' }}>
      
      {/* Header Panel */}
      <div style={{ 
        background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', 
        border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '1rem'
      }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 5px 0', fontSize: '1.8rem', fontWeight: 800 }}>
            💫 GrihaMitra AI Avatar Engine (Phase 7 Real)
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            Real-time WebRTC HeyGen Talking Avatar streaming system. Backed by semantic memory, priority schedules, and dynamic emotion routing.
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { id: 'interact', label: 'Interact', icon: '🤖' },
            { id: 'memory', label: 'Memory', icon: '🧠' },
            { id: 'analytics', label: 'Analytics', icon: '📊' },
            { id: 'scheduler', label: 'Scheduler', icon: '⏰' },
            { id: 'stream', label: 'Stream Monitor', icon: '📡' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                background: activeTab === t.id ? 'var(--accent-yellow)' : 'transparent',
                color: activeTab === t.id ? '#000' : 'var(--text-secondary)',
                border: 'none', borderRadius: '8px', padding: '8px 12px',
                fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Column: Visual AI Avatar & Dialogue Core */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Avatar live visual frame */}
          <div style={{ 
            background: '#0a0d16', border: '1px solid var(--border-subtle)', 
            borderRadius: '24px', padding: '2rem', display: 'flex', flexDirection: 'column', 
            alignItems: 'center', justifyContent: 'center', height: '440px', position: 'relative',
            boxShadow: `0 15px 40px ${theme.shadow}`, overflow: 'hidden'
          }}>
            
            {/* Ambient Aura Background */}
            <div style={{ 
              position: 'absolute', inset: 0, zIndex: 0,
              background: theme.border, opacity: 0.15, transition: 'all 0.5s ease'
            }} />

            {/* Live Video element for real WebRTC streaming */}
            <div style={{
              width: '240px', height: '240px', borderRadius: '50%',
              border: `3px dashed ${theme.aura}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: '10px', zIndex: 5,
              animation: avatarState === 'Thinking' ? 'spin 8s linear infinite' : avatarState === 'Listening' ? 'pulsate-fast 2s infinite' : 'none',
              transition: 'all 0.5s ease', boxShadow: `0 0 25px ${theme.aura}44`,
              position: 'relative', overflow: 'hidden', background: '#000'
            }}>
              
              {/* WebRTC Video Track element */}
              <video 
                id="heygen-stream-video"
                autoPlay 
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: (!isMockSession && videoTrackActive) ? 'block' : 'none',
                  zIndex: 2
                }}
              />

              {/* Static Avatar fallback image when in mock mode or loading WebRTC */}
              {((isMockSession || !videoTrackActive)) && (
                <img 
                  src={avatarFace} 
                  alt="GrihaMitra Static Fallback Face" 
                  style={{ 
                    width: '100%', height: '100%', borderRadius: '50%', 
                    objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)',
                    zIndex: 1
                  }} 
                />
              )}
            </div>

            {/* Simulated Dynamic Lip-Sync waves */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '40px', marginTop: '15px', zIndex: 5 }}>
              {audioWaves.map((val, idx) => (
                <div 
                  key={idx}
                  style={{
                    width: '4px',
                    height: `${val}px`,
                    background: theme.aura,
                    borderRadius: '2px',
                    transition: 'height 0.08s ease',
                    boxShadow: `0 0 10px ${theme.aura}`
                  }}
                />
              ))}
            </div>

            {/* Metadata Badges */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', zIndex: 5 }}>
              <span style={{ background: 'rgba(255,255,255,0.04)', color: '#FFF', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                State: <strong style={{ color: theme.aura }}>{avatarState}</strong>
              </span>
              <span style={{ background: 'rgba(255,255,255,0.04)', color: '#FFF', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                Emotion: <strong style={{ color: 'var(--accent-yellow)' }}>{emotionState}</strong>
              </span>
              <span style={{ background: 'rgba(255,255,255,0.04)', color: '#FFF', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                Stream: <strong style={{ color: webrtcState.includes('Connected') ? '#10B981' : '#F59E0B' }}>{webrtcState}</strong>
              </span>
            </div>

            {/* Real-time Subtitle/Response spoken bubble */}
            <div style={{ 
              marginTop: '15px', width: '90%', textAlign: 'center', zIndex: 5,
              background: 'rgba(0,0,0,0.4)', padding: '10px 15px', borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.04)'
            }}>
              <p style={{ margin: 0, color: '#E0E0E0', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: 1.4 }}>
                "{currentResponseText}"
              </p>
            </div>
          </div>

          {/* Tab Content Panels */}
          {activeTab === 'interact' && (
            <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                <strong style={{ color: '#FFF', fontSize: '0.95rem' }}>Avatar Communication Console</strong>
                
                {/* Active user role select */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Identify Profile:</span>
                  <select 
                    value={selectedMember} 
                    onChange={handleProfileChange}
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#FFF', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                  >
                    <option value="Owner">Owner (Nikunj)</option>
                    {membersList.map(m => (
                      <option key={m._id} value={m.name}>{m.name} ({m.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mic & Keyboard Input container */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button 
                  onClick={handleToggleRecording}
                  title={isRecording ? "Stop Listening" : "Record Voice"}
                  style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: isRecording ? '#EF4444' : 'rgba(255,255,255,0.05)',
                    color: isRecording ? '#FFF' : 'var(--accent-yellow)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isRecording ? '0 0 15px #EF4444' : 'none', transition: 'all 0.2s'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={isRecording ? '#FFF' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                </button>

                <input 
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendCommand(inputText); }}
                  placeholder="Ask GrihaMitra a question or control home..."
                  disabled={processingCommand || isRecording}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '24px', padding: '10px 18px', color: '#FFF', fontSize: '0.9rem',
                    outline: 'none', transition: 'all 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-yellow)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />

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
                  {processingCommand ? 'Processing...' : 'Ask'}
                </button>
              </div>

              {/* Suggestions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '5px' }}>
                {[
                  "What did you tell me yesterday?",
                  "Why did you turn on the water motor?",
                  "What was my last study room recommendation?",
                  "Turn off all balcony lights",
                  "namaste dadi ji",
                  "Why is the AC active?"
                ].map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendCommand(s)}
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '5px 12px', color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-yellow)'; e.currentTarget.style.color = '#FFF'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700 }}>Avatar Memory & Semantic Recall</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Recall semantic interactions and alert histories using Bedrock AI</span>
                </div>
                <button 
                  onClick={fetchAvatarMemory}
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#FFF', border: 'none', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  🔄 Refresh
                </button>
              </div>

              {/* Semantic search console */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Ask memory: 'What did we talk about yesterday?'"
                  style={{ flex: 1, background: 'rgba(0,0,0,0.2)', color: '#FFF', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
                />
                <button 
                  onClick={handleSemanticSearch}
                  style={{ background: 'var(--accent-yellow)', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Semantic Search
                </button>
              </div>

              {retrievedSummary && (
                <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', padding: '12px', borderRadius: '10px', color: '#FCD34D', fontSize: '0.85rem', lineHeight: 1.4 }}>
                  <strong>🧠 Recalled Summary:</strong> "{retrievedSummary}"
                </div>
              )}

              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                {loadingHistory ? (
                  <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem', fontSize: '0.85rem' }}>Processing memory queries...</div>
                ) : memoryList.length > 0 ? (
                  memoryList.map((m, idx) => (
                    <div key={m._id || idx} style={{ borderLeft: '2px solid var(--border-subtle)', paddingLeft: '12px', marginLeft: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        <span>👤 <strong>{m.user}</strong>: "{m.question}"</span>
                        <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', color: '#E0E0E0', fontSize: '0.85rem', lineHeight: 1.4 }}>
                        🤖 {m.avatarResponse}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(168,85,247,0.1)', color: '#A855F7', padding: '1px 6px', borderRadius: '4px' }}>{m.emotionState}</span>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(59,130,246,0.1)', color: '#3B82F6', padding: '1px 6px', borderRadius: '4px' }}>{m.avatarState}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem', fontSize: '0.85rem' }}>No memory logs compiled.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700 }}>Avatar Analytics & Telemetry</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>long-term user engagement statistics, personality configurations, and distributions</span>
              </div>

              {/* Sub-tabs for analytics types */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                <button
                  onClick={() => setAnalyticsSubTab('engagement')}
                  style={{
                    background: analyticsSubTab === 'engagement' ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: analyticsSubTab === 'engagement' ? 'var(--accent-yellow)' : 'var(--text-secondary)',
                    border: '1px solid ' + (analyticsSubTab === 'engagement' ? 'rgba(245,158,11,0.3)' : 'transparent'),
                    borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold', outline: 'none'
                  }}
                >
                  👥 User Engagement
                </button>
                <button
                  onClick={() => setAnalyticsSubTab('usage')}
                  style={{
                    background: analyticsSubTab === 'usage' ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: analyticsSubTab === 'usage' ? 'var(--accent-yellow)' : 'var(--text-secondary)',
                    border: '1px solid ' + (analyticsSubTab === 'usage' ? 'rgba(245,158,11,0.3)' : 'transparent'),
                    borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold', outline: 'none'
                  }}
                >
                  ⚡ AWS AI Telemetry & Costs
                </button>
              </div>

              {analyticsSubTab === 'engagement' ? (
                analytics ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <strong style={{ display: 'block', fontSize: '1.4rem', color: 'var(--accent-yellow)' }}>{analytics.totalConversations}</strong>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Total Turns</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <strong style={{ display: 'block', fontSize: '1.4rem', color: '#10B981' }}>{analytics.mostActiveUser}</strong>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Most Active User</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <strong style={{ display: 'block', fontSize: '1.4rem', color: '#3B82F6' }}>{analytics.avatarSpeakingTime}s</strong>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Speaking Time</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <strong style={{ display: 'block', fontSize: '1.4rem', color: '#A855F7' }}>{analytics.mostTriggeredEmotion}</strong>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>Top Emotion</span>
                      </div>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>User Engagement Statistics</span>
                      {analytics.conversationsPerUser?.map((u, i) => {
                        const total = analytics.totalConversations || 1;
                        const pct = Math.round((u.count / total) * 100);
                        return (
                          <div key={i} style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                              <span style={{ color: '#FFF' }}>{u.user}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{u.count} turns ({pct}%)</span>
                            </div>
                            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #3B82F6, #10B981)', borderRadius: '2px' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Language Distribution</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {Object.entries(analytics.languageDistribution || {}).map(([lang, count]) => {
                          const total = analytics.totalConversations || 1;
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={lang} style={{ flex: 1, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px', textAlign: 'center' }}>
                              <strong style={{ display: 'block', color: '#FFF', fontSize: '0.85rem' }}>{pct}%</strong>
                              <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>{lang}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-secondary)', padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>Analytics reports compilations pending active dialog loops.</div>
                )
              ) : (
                /* AWS AI Usage Dashboard */
                usageAnalytics ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.62rem', color: '#10B981', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>Total Accrued Cost</span>
                        <strong style={{ display: 'block', fontSize: '1.25rem', color: '#FFF' }}>
                          ${(usageAnalytics.stats.totalCost || 0).toFixed(5)}
                        </strong>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bedrock Requests</span>
                        <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--accent-yellow)' }}>
                          {usageAnalytics.stats.Bedrock?.requests || 0}
                        </strong>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Polly Requests</span>
                        <strong style={{ display: 'block', fontSize: '1.25rem', color: '#3B82F6' }}>
                          {usageAnalytics.stats.Polly?.requests || 0}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Bedrock (Claude Sonnet)</span>
                        <div style={{ fontSize: '0.78rem', color: '#FFF', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Input Tokens:</span>
                            <span style={{ fontWeight: 'bold' }}>{usageAnalytics.stats.Bedrock?.inputTokens || 0}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Output Tokens:</span>
                            <span style={{ fontWeight: 'bold' }}>{usageAnalytics.stats.Bedrock?.outputTokens || 0}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Average Latency:</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{usageAnalytics.stats.Bedrock?.avgLatency || 0}ms</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px', marginTop: '2px' }}>
                            <span>Estimated Cost:</span>
                            <span style={{ fontWeight: 'bold', color: '#10B981' }}>${(usageAnalytics.stats.Bedrock?.cost || 0).toFixed(5)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Polly Neural Speech</span>
                        <div style={{ fontSize: '0.78rem', color: '#FFF', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Characters Synthesized:</span>
                            <span style={{ fontWeight: 'bold' }}>{usageAnalytics.stats.Polly?.characters || 0}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Average Latency:</span>
                            <span style={{ fontWeight: 'bold', color: '#3B82F6' }}>{usageAnalytics.stats.Polly?.avgLatency || 0}ms</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px', marginTop: '16px' }}>
                            <span>Estimated Cost:</span>
                            <span style={{ fontWeight: 'bold', color: '#10B981' }}>${(usageAnalytics.stats.Polly?.cost || 0).toFixed(5)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Recent AI Service Transaction Logs</span>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <th style={{ padding: '8px' }}>Time</th>
                              <th style={{ padding: '8px' }}>Service</th>
                              <th style={{ padding: '8px' }}>Tokens/Chars</th>
                              <th style={{ padding: '8px' }}>Latency</th>
                              <th style={{ padding: '8px' }}>Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageAnalytics.logs && usageAnalytics.logs.length > 0 ? (
                              usageAnalytics.logs.map((log, index) => (
                                <tr key={log._id || index} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                  <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                  </td>
                                  <td style={{ padding: '6px 8px', fontWeight: 'bold', color: log.serviceType === 'Bedrock' ? 'var(--accent-yellow)' : '#3B82F6' }}>
                                    {log.serviceType}
                                  </td>
                                  <td style={{ padding: '6px 8px', color: '#FFF' }}>
                                    {log.serviceType === 'Bedrock' ? `${log.inputTokens}i / ${log.outputTokens}o` : `${log.charactersProcessed} chars`}
                                  </td>
                                  <td style={{ padding: '6px 8px', color: '#FFF' }}>
                                    {log.latencyMs}ms
                                  </td>
                                  <td style={{ padding: '6px 8px', color: '#10B981', fontWeight: 'bold' }}>
                                    ${(log.costEstimation || 0).toFixed(5)}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="5" style={{ padding: '15px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                  No transaction records logged.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-secondary)', padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
                    Loading AI usage telemetry logs...
                  </div>
                )
              )}
            </div>
          )}

          {activeTab === 'scheduler' && (
            <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700 }}>Scheduled Proactive Speaking Panel</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Manage BullMQ prioritisations and smart speech thresholds</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ color: '#FFF', fontSize: '0.8rem', fontWeight: 'bold' }}>Configured Announcement Schedules:</span>
                {scheduledAlerts.map((s, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: '#FFF', fontSize: '0.85rem', display: 'block' }}>{s.title}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{s.desc}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--accent-yellow)', fontWeight: 'bold' }}>{s.priority} Priority</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Throttle: {s.interval}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '10px' }}>
                <span style={{ color: '#FFF', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>History of Triggered Proactive Speaking Tasks:</span>
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                  {triggeredAnnouncements.length > 0 ? (
                    triggeredAnnouncements.map((a, i) => (
                      <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px', marginBottom: '6px', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>[{a.time}] 📢 Type: <strong>{a.type}</strong></span>
                        <p style={{ margin: '2px 0 0 0', color: '#FFF' }}>"{a.text}"</p>
                      </div>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block', textAlign: 'center', padding: '1rem' }}>No proactive announcements triggered yet.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stream' && (
            <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700 }}>WebRTC Stream Monitor Panel</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Live signal checks and connection quality telemetry</span>
                </div>
                <span style={{ background: streamHealth.includes('Mock') || streamHealth.includes('Fallback') ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: streamHealth.includes('Mock') || streamHealth.includes('Fallback') ? 'var(--accent-yellow)' : '#10B981', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                  {streamHealth}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Active Session ID</span>
                  <strong style={{ fontSize: '0.8rem', color: '#FFF', fontFamily: 'monospace', display: 'block', wordBreak: 'break-all', marginTop: '3px' }}>
                    {sessionId || 'No session registered'}
                  </strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Session Connection Mode</span>
                  <strong style={{ fontSize: '0.85rem', color: isMockSession ? 'var(--accent-yellow)' : '#10B981', display: 'block', marginTop: '3px' }}>
                    {isMockSession ? 'Simulated Offline Fallback' : 'Real-time WebRTC Live'}
                  </strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Video Feed State</span>
                  <strong style={{ fontSize: '0.85rem', color: videoTrackActive ? '#10B981' : '#EF4444', display: 'block', marginTop: '3px' }}>
                    {videoTrackActive ? 'ON (VP8 Decode Active)' : 'OFF'}
                  </strong>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>Audio Track Feed</span>
                  <strong style={{ fontSize: '0.85rem', color: audioTrackActive ? '#10B981' : '#EF4444', display: 'block', marginTop: '3px' }}>
                    {audioTrackActive ? 'ON (Speech Channel Active)' : 'OFF'}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  onClick={() => initializeWebRTCSession(selectedMember)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#FFF', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                >
                  🔄 Reconnect Stream
                </button>
                <button
                  onClick={cleanupWebRTC}
                  style={{ flex: 1, background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
                >
                  🛑 Close Connection
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Home Insights, Explanations & Proactive Announcements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Card: Proactive Notification Panel */}
          <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
              Proactive Announcements
            </h3>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Simulate real-time smart home alerts spoken by GrihaMitra</span>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => triggerProactiveAlert('water_tank')}
                style={{ background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>💧 Water Reservoir Low Alert</span>
                <span>Trigger</span>
              </button>
              <button 
                onClick={() => triggerProactiveAlert('security')}
                style={{ background: 'rgba(239,68,68,0.08)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>🚨 Balcony Intrusion Alarm</span>
                <span>Trigger</span>
              </button>
              <button 
                onClick={() => triggerProactiveAlert('power_failure')}
                style={{ background: 'rgba(245,158,11,0.08)', color: '#FDE68A', border: '1px solid rgba(245,158,11,0.2)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span>⚡ Power Grid Failure Warning</span>
                <span>Trigger</span>
              </button>
            </div>
          </div>

          {/* Card: Active predictions */}
          <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
              Active AI Predictions
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {homeInfo?.rooms?.some(r => r.devices.length > 0) ? (
                homeInfo.rooms.flatMap(r => r.devices.slice(0, 1).map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px' }}>
                    <div>
                      <strong style={{ color: '#FFF', fontSize: '0.82rem', display: 'block' }}>Turn ON {d.name}</strong>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Target Room: {r.name}</span>
                    </div>
                    <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      92% Conf
                    </span>
                  </div>
                )))
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>No active predictions parsed.</span>
              )}
            </div>
          </div>

          {/* Card: Active Home Health & Sensors */}
          <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <h3 style={{ margin: 0, color: '#FFF', fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
              Home Subsystems Health
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', display: 'block' }}>Water Reservoir</span>
                <strong style={{ color: 'var(--accent-yellow)', fontSize: '1.1rem' }}>72% Full</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', display: 'block' }}>Energy Rating</span>
                <strong style={{ color: '#10B981', fontSize: '1.1rem' }}>Optimal</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', display: 'block' }}>Ambient Temp</span>
                <strong style={{ color: '#FFF', fontSize: '1.1rem' }}>26.4°C</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', display: 'block' }}>Security Vault</span>
                <strong style={{ color: '#10B981', fontSize: '1.1rem' }}>Locked</strong>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* CSS keyframe animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulsate-fast {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6); transform: scale(1); }
          50% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); transform: scale(1.02); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); transform: scale(1); }
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}} />

    </div>
  );
};

export default AvatarDashboard;
