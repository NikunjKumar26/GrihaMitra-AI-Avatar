import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import avatarFace from '../assets/avatar_face.png';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com';

const GrihaMitra = ({ homeInfo, socket: parentSocket }) => {
  // Master Toggles & Config (cached in localStorage)
  const [isAssistantOn, setIsAssistantOn] = useState(() => {
    return localStorage.getItem('grihamitra_assistant_active') !== 'false';
  });
  const [alwaysListening, setAlwaysListening] = useState(() => {
    return localStorage.getItem('grihamitra_always_listening') === 'true';
  });
  const [speechEnabled, setSpeechEnabled] = useState(() => {
    return localStorage.getItem('grihamitra_speech_enabled') !== 'false';
  });
  const [showAvatarFace, setShowAvatarFace] = useState(() => {
    return localStorage.getItem('grihamitra_show_avatar') !== 'false';
  });

  // UI Expansion
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // States
  const [avatarState, setAvatarState] = useState('Idle'); // Idle, Listening, Thinking, Speaking, Alert
  const [emotionState, setEmotionState] = useState('Normal'); // Normal, Happy, Alert, Concerned, Celebration
  const [currentSubtitle, setCurrentSubtitle] = useState('Awaiting command. Wake me up with "Dost" or "GrihaMitra"');
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Namaste! I am GrihaMitra, your smart family AI companion. Speak or type to interact.', time: new Date() }
  ]);
  const [inputText, setInputText] = useState('');
  const [processingCommand, setProcessingCommand] = useState(false);
  const [selectedMember, setSelectedMember] = useState('Owner');
  const [membersList, setMembersList] = useState([]);

  // WebRTC / Streaming
  const [webrtcState, setWebrtcState] = useState('Disconnected');
  const [sessionId, setSessionId] = useState('');
  const [isMockSession, setIsMockSession] = useState(true);
  const [videoTrackActive, setVideoTrackActive] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioWaves, setAudioWaves] = useState([8, 8, 8, 8, 8, 8, 8, 8]);

  // 30-Second Continuous Session & Diagnostics Upgrades
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0);
  const [lastUserMessages, setLastUserMessages] = useState([]);
  const [lastAssistantResponses, setLastAssistantResponses] = useState([]);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [diagnostics, setDiagnostics] = useState({
    micStatus: 'Inactive',
    speakerStatus: 'Active',
    streamStatus: 'Disconnected',
    wakeWordStatus: 'Inactive'
  });
  const sessionTimerRef = useRef(null);
  const [popBubble, setPopBubble] = useState({ visible: false, sender: 'ai', text: '' });
  const [showHoverMenu, setShowHoverMenu] = useState(false);

  // Refs
  const pcRef = useRef(null);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const waveAnimationRef = useRef(null);
  const activeAudioRef = useRef(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Persistence Cache Updates
  useEffect(() => {
    localStorage.setItem('grihamitra_assistant_active', isAssistantOn);
    if (!isAssistantOn) {
      cleanupWebRTC();
      stopContinuousListening();
    }
  }, [isAssistantOn]);

  useEffect(() => {
    localStorage.setItem('grihamitra_always_listening', alwaysListening);
  }, [alwaysListening]);

  useEffect(() => {
    localStorage.setItem('grihamitra_speech_enabled', speechEnabled);
    if (!speechEnabled) {
      cancelAudioOutput();
    }
  }, [speechEnabled]);

  useEffect(() => {
    localStorage.setItem('grihamitra_show_avatar', showAvatarFace);
  }, [showAvatarFace]);

  // Scroll Chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanupWebRTC();
      stopContinuousListening();
      cancelAudioOutput();
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    };
  }, []);

  // 30-Second Continuous Session Timer Logic
  useEffect(() => {
    if (isSessionActive && sessionTimeLeft > 0) {
      sessionTimerRef.current = setTimeout(() => {
        setSessionTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (sessionTimeLeft === 0 && isSessionActive) {
      setIsSessionActive(false);
      setCurrentSubtitle('Session expired. Wake me up with "Dost"');
    }
    return () => {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    };
  }, [isSessionActive, sessionTimeLeft]);

  // Reset helper for session countdown
  const resetSessionTimer = () => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    setIsSessionActive(true);
    setSessionTimeLeft(30);
  };

  // Real-Time System Diagnostics Calculation
  useEffect(() => {
    let mic = 'Inactive';
    if (avatarState === 'Listening') {
      mic = '🟢 Active (Listening)';
    } else if (isAssistantOn && alwaysListening && !isPlayingAudio && !processingCommand) {
      mic = '🟢 Monitoring';
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' }).then(permissionStatus => {
        if (permissionStatus.state === 'denied') {
          mic = '🔴 Permission Denied';
        }
      }).catch(() => {});
    }

    let speaker = '🟢 Enabled';
    if (!speechEnabled) {
      speaker = '🔴 Muted';
    } else if (isPlayingAudio) {
      speaker = '🔵 Active Response';
    }

    let stream = webrtcState === 'Connected' ? '🟢 Connected' : `🟡 ${webrtcState}`;
    if (webrtcState === 'Connected (Simulated)' || webrtcState === 'Connected (Fallback)') {
      stream = '🟢 Connected (Mock)';
    } else if (webrtcState === 'Disconnected') {
      stream = '⚪ Disconnected';
    }

    let wakeWord = '⚪ Inactive';
    if (isAssistantOn && alwaysListening) {
      if (isSessionActive) {
        wakeWord = `⚡ Session Active (${sessionTimeLeft}s)`;
      } else {
        wakeWord = '👂 Listening for "Dost"';
      }
    }

    setDiagnostics({
      micStatus: mic,
      speakerStatus: speaker,
      streamStatus: stream,
      wakeWordStatus: wakeWord
    });
  }, [avatarState, alwaysListening, isPlayingAudio, processingCommand, speechEnabled, webrtcState, isSessionActive, sessionTimeLeft, isAssistantOn]);

  // Sync Socket Listeners
  useEffect(() => {
    const socket = parentSocket;
    if (socket && isAssistantOn) {
      const handleAlert = (data) => {
        setAvatarState(data.avatarState || 'Alert');
        setEmotionState(data.emotionState || 'Alert');
        setCurrentSubtitle(data.text);
        
        setPopBubble({
          visible: true,
          sender: 'ai',
          text: data.text
        });
        
        setMessages(prev => [...prev, { sender: 'ai', text: `🚨 Notification: ${data.text}`, time: new Date() }]);

        const isSelfTriggered = data.socketId && socket.id && data.socketId === socket.id;

        if (!isSelfTriggered && (data.heygenStatus !== 'triggered' || isMockSession) && speechEnabled) {
          playVoiceResponse(data.text, 'Aditi', 'medium');
        } else if (isSelfTriggered) {
          if (!speechEnabled || (data.heygenStatus === 'triggered' && !isMockSession)) {
            simulateSpeakingWave(6000);
          }
        } else {
          simulateSpeakingWave(6000);
        }
      };

      const handleSpeak = (data) => {
        setAvatarState(data.avatarState || 'Speaking');
        setEmotionState(data.emotionState || 'Normal');
        setCurrentSubtitle(data.text);

        setPopBubble({
          visible: true,
          sender: 'ai',
          text: data.text
        });

        setMessages(prev => [...prev, { sender: 'ai', text: data.text, time: new Date() }]);

        const isSelfTriggered = data.socketId && socket.id && data.socketId === socket.id;

        if (!isSelfTriggered && (data.heygenStatus !== 'triggered' || isMockSession) && speechEnabled) {
          playVoiceResponse(data.text, data.voice, data.speedRate);
        } else if (isSelfTriggered) {
          if (!speechEnabled || (data.heygenStatus === 'triggered' && !isMockSession)) {
            simulateSpeakingWave(5000);
          }
        } else {
          simulateSpeakingWave(5000);
        }
      };

      socket.on('avatarAlert', handleAlert);
      socket.on('avatarSpeak', handleSpeak);

      return () => {
        socket.off('avatarAlert', handleAlert);
        socket.off('avatarSpeak', handleSpeak);
      };
    }
  }, [parentSocket, isAssistantOn, speechEnabled, selectedMember, isMockSession]);

  // WebRTC Session lifecycle trigger
  useEffect(() => {
    if (homeInfo?._id && isAssistantOn) {
      fetchFamilyMembers();
      initializeWebRTCSession(selectedMember);
    } else {
      cleanupWebRTC();
    }
  }, [homeInfo?._id, selectedMember, isAssistantOn]);

  // Always Listening Mode trigger
  useEffect(() => {
    if (isAssistantOn && alwaysListening) {
      startContinuousListening();
    } else {
      stopContinuousListening();
    }
    return () => stopContinuousListening();
  }, [alwaysListening, isAssistantOn, selectedMember]);

  // Simulated Speaking Waveform Animation
  useEffect(() => {
    if (isPlayingAudio) {
      const animateWave = () => {
        setAudioWaves(prev => prev.map(() => Math.floor(Math.random() * 32) + 6));
        waveAnimationRef.current = requestAnimationFrame(animateWave);
      };
      waveAnimationRef.current = requestAnimationFrame(animateWave);
    } else {
      if (waveAnimationRef.current) cancelAnimationFrame(waveAnimationRef.current);
      setAudioWaves([6, 6, 6, 6, 6, 6, 6, 6]);
    }
    return () => {
      if (waveAnimationRef.current) cancelAnimationFrame(waveAnimationRef.current);
    };
  }, [isPlayingAudio]);

  // Load Family Profiles
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
      console.error('[GrihaMitra Widget] Failed to fetch family members:', err.message);
    }
  };

  // WebRTC session setup
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
          quality: 'low',
          avatarName: 'Bryan_FitnessCoach_public',
          memberName: memberName
        })
      });

      if (!res.ok) throw new Error('Create avatar session failed.');

      const sessionData = await res.json();
      setSessionId(sessionData.sessionId);
      setIsMockSession(sessionData.isMock);

      if (sessionData.isMock) {
        setWebrtcState('Connected (Simulated)');
        setVideoTrackActive(true);
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: sessionData.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        setWebrtcState(pc.iceConnectionState);
      };

      pc.ontrack = (event) => {
        if (event.track.kind === 'video') {
          setVideoTrackActive(true);
        }
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        const videoElement = document.getElementById('widget-avatar-video');
        if (videoElement) {
          videoElement.srcObject = remoteStream;
          videoElement.play().catch(err => console.warn('[WebRTC Play Blocked]:', err.message));
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(sessionData.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const startRes = await fetch(`${API_BASE}/api/avatar/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          sdp: { type: 'answer', sdp: answer.sdp }
        })
      });

      if (startRes.ok) {
        setWebrtcState('Connected');
      } else {
        throw new Error('Start handshake failed.');
      }
    } catch (err) {
      console.warn('⚠️ [GrihaMitra WebRTC Fallback]:', err.message);
      setWebrtcState('Connected (Fallback)');
      setIsMockSession(true);
      setVideoTrackActive(true);
    }
  };

  const cleanupWebRTC = () => {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) {}
      pcRef.current = null;
    }
    setWebrtcState('Disconnected');
    setVideoTrackActive(false);
  };

  const cancelAudioOutput = () => {
    if (activeAudioRef.current) {
      try { activeAudioRef.current.pause(); } catch (e) {}
      activeAudioRef.current = null;
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    setIsPlayingAudio(false);
  };

  const triggerWakeWordResponse = async () => {
    const textToSpeak = "Ji Dost, main sun raha hoon.";
    setCurrentSubtitle(textToSpeak);
    setAvatarState('Speaking');
    
    // Add user trigger and AI reply to UI messages
    setMessages(prev => [...prev, 
      { sender: 'user', text: 'Dost', time: new Date() },
      { sender: 'ai', text: textToSpeak, time: new Date() }
    ]);

    setPopBubble({
      visible: true,
      sender: 'ai',
      text: textToSpeak,
      isInterim: false
    });

    if (speechEnabled) {
      await playVoiceResponse(textToSpeak, 'Aditi', 'medium');
    } else {
      simulateSpeakingWave(2000);
    }
  };

  // Always Listening continuous mic logic
  const startContinuousListening = () => {
    stopContinuousListening();
    
    // Safety check: do not start mic if assistant is currently speaking or processing a command
    if (isPlayingAudio || processingCommand || avatarState === 'Speaking' || avatarState === 'Thinking') {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Always Listening] Browser speech recognition not supported.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const WAKE_WORDS = ['dost', 'hey dost', 'suno dost', 'hey grihamitra', 'grihamitra'];

      if (isSessionActive) {
        if (interimTranscript) {
          let displayInterim = interimTranscript.trim();
          const lowerInterim = displayInterim.toLowerCase();
          const matchedWake = WAKE_WORDS.find(word => lowerInterim === word || lowerInterim.startsWith(word + ' '));
          if (matchedWake) {
            displayInterim = displayInterim.substring(matchedWake.length).trim();
          }
          if (displayInterim) {
            setPopBubble({
              visible: true,
              sender: 'user',
              text: displayInterim,
              isInterim: true
            });
          }
        }
        if (finalTranscript) {
          let cleanTranscript = finalTranscript.trim();
          const lowerFinal = cleanTranscript.toLowerCase();
          const matchedWake = WAKE_WORDS.find(word => lowerFinal === word || lowerFinal.startsWith(word + ' '));
          if (matchedWake) {
            cleanTranscript = cleanTranscript.substring(matchedWake.length).trim();
          }

          if (cleanTranscript) {
            setPopBubble({
              visible: true,
              sender: 'user',
              text: cleanTranscript,
              isInterim: false
            });
            resetSessionTimer();
            handleSendCommand(cleanTranscript);
          } else if (matchedWake) {
            setPopBubble({
              visible: true,
              sender: 'user',
              text: matchedWake,
              isInterim: false
            });
            resetSessionTimer();
            triggerWakeWordResponse();
          }
        }
      } else {
        if (finalTranscript) {
          const transcript = finalTranscript.trim();
          const lowerFinal = transcript.toLowerCase();
          const matchedWake = WAKE_WORDS.find(word => lowerFinal === word || lowerFinal.startsWith(word + ' '));

          if (matchedWake) {
            playWakeBeep();
            resetSessionTimer();

            const command = transcript.substring(matchedWake.length).trim();
            if (command) {
              setPopBubble({
                visible: true,
                sender: 'user',
                text: transcript,
                isInterim: false
              });
              handleSendCommand(command);
            } else {
              setPopBubble({
                visible: true,
                sender: 'user',
                text: matchedWake,
                isInterim: false
              });
              triggerWakeWordResponse();
            }
          }
        }
      }
    };

    recognition.onend = () => {
      // Re-trigger loop if continuous listening is still active and not speaking/processing
      if (isAssistantOn && alwaysListening && !isPlayingAudio && !processingCommand) {
        setTimeout(() => {
          if (isAssistantOn && alwaysListening && !isPlayingAudio && !processingCommand) {
            startContinuousListening();
          }
        }, 300);
      }
    };

    recognition.onerror = (e) => {
      // Restart loop on no-speech or other non-critical errors
      if (isAssistantOn && alwaysListening && !isPlayingAudio && !processingCommand) {
        setTimeout(() => {
          if (isAssistantOn && alwaysListening && !isPlayingAudio && !processingCommand) {
            startContinuousListening();
          }
        }, 400);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('[Continuous Speech start fail]:', err.message);
    }
  };

  const stopContinuousListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
  };

  const playWakeBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.14);
    } catch (e) {}
  };

  // Toggle manual microphone interaction
  const handleToggleManualListen = () => {
    if (avatarState === 'Listening') {
      stopContinuousListening();
      setAvatarState('Idle');
      setPopBubble(prev => ({ ...prev, visible: false }));
      if (alwaysListening) startContinuousListening();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Microphone speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    cancelAudioOutput();
    stopContinuousListening();
    setAvatarState('Listening');
    setCurrentSubtitle('Listening...');
    setPopBubble({
      visible: true,
      sender: 'user',
      text: 'Listening...',
      isInterim: true
    });

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-IN';

    rec.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (interimTranscript) {
        setPopBubble({
          visible: true,
          sender: 'user',
          text: interimTranscript,
          isInterim: true
        });
      }

      if (finalTranscript) {
        const transcript = finalTranscript.trim();
        if (transcript) {
          setPopBubble({
            visible: true,
            sender: 'user',
            text: transcript,
            isInterim: false
          });
          handleSendCommand(transcript);
        }
      }
    };

    rec.onend = () => {
      if (!alwaysListening) {
        setAvatarState('Idle');
      } else {
        startContinuousListening();
      }
    };

    rec.onerror = () => {
      setAvatarState('Idle');
      setPopBubble(prev => ({ ...prev, visible: false }));
      if (alwaysListening) startContinuousListening();
    };

    try {
      rec.start();
    } catch (e) {
      console.error(e);
    }
  };

  // Send Command to Voice Pipeline
  const handleSendCommand = async (commandText) => {
    const textToSend = commandText || inputText;
    if (!textToSend.trim() || !isAssistantOn) return;

    // Reset continuous session timer so it extends 30s from the command start
    resetSessionTimer();

    // Duplicate message check
    const normalizedText = textToSend.trim().toLowerCase();
    if (lastUserMessages.includes(normalizedText)) {
      console.warn("Blocked duplicate user message in frontend:", textToSend);
      
      const lastResp = lastAssistantResponses[lastAssistantResponses.length - 1] || "Ji Dost, main ispar pehle hi kaam kar chuka hoon.";
      
      // Update UI with user message & duplicate reply
      setMessages(prev => [
        ...prev,
        { sender: 'user', text: textToSend, time: new Date() },
        { sender: 'ai', text: lastResp, time: new Date() }
      ]);
      setInputText('');
      
      setPopBubble({
        visible: true,
        sender: 'ai',
        text: lastResp,
        isInterim: false
      });

      // Play audio response if speech is enabled
      if (speechEnabled) {
        if (lastResp) {
          playVoiceResponse(lastResp, 'Aditi', 'medium');
        }
      }
      return;
    }

    // Update message cache
    setLastUserMessages(prev => [...prev.slice(-4), normalizedText]);

    try {
      setProcessingCommand(true);
      setAvatarState('Thinking');
      
      // Add user message to chat UI
      setMessages(prev => [...prev, { sender: 'user', text: textToSend, time: new Date() }]);
      setInputText('');

      setPopBubble({
        visible: true,
        sender: 'ai',
        text: 'Thinking...',
        isInterim: true
      });

      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/avatar/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: textToSend,
          memberName: selectedMember,
          sessionId: sessionId,
          runBedrock: true,
          socketId: parentSocket?.id
        })
      });

      const data = await res.json();
      setProcessingCommand(false);

      if (!res.ok) throw new Error(data.error || 'Failed to get AI response.');

      // Update AI visual status & response subtitles
      setAvatarState(data.avatarState || 'Speaking');
      setEmotionState(data.emotionState || 'Normal');
      setCurrentSubtitle(data.text);

      setPopBubble({
        visible: true,
        sender: 'ai',
        text: data.text,
        isInterim: false
      });

      // Add AI response text to chat UI
      setMessages(prev => [...prev, { sender: 'ai', text: data.text, time: new Date() }]);
      
      // Cache assistant response
      setLastAssistantResponses(prev => [...prev.slice(-4), data.text.trim().toLowerCase()]);

      // Play audio response if HeyGen is not actively streaming
      if (speechEnabled) {
        if (data.heygenStatus !== 'triggered' || isMockSession) {
          if (data.audioStreamBase64) {
            playBase64Audio(data.audioStreamBase64, data.speedRate, data.text);
          } else {
            await playVoiceResponse(data.text, data.voice, data.speedRate);
          }
        } else {
          simulateSpeakingWave(5000);
        }
      } else {
        simulateSpeakingWave(5000);
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'ai', text: `Error: ${err.message}`, time: new Date() }]);
      setPopBubble({
        visible: true,
        sender: 'ai',
        text: `Error: ${err.message}`,
        isInterim: false
      });
      setProcessingCommand(false);
      setAvatarState('Idle');
      if (isAssistantOn && alwaysListening) {
        startContinuousListening();
      }
    }
  };

  // Play pre-rendered base64 audio stream directly
  const playBase64Audio = (base64String, speedRate, textToSpeak) => {
    cancelAudioOutput();
    stopContinuousListening();

    try {
      setIsPlayingAudio(true);
      setAvatarState('Speaking');

      const audioUrl = `data:audio/mpeg;base64,${base64String}`;
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      
      const onSpeechEnd = () => {
        setIsPlayingAudio(false);
        setAvatarState('Idle');
        setPopBubble(prev => {
          if (prev.sender === 'ai') {
            return { ...prev, visible: false };
          }
          return prev;
        });
        if (isAssistantOn && alwaysListening) {
          startContinuousListening();
        }
      };

      audio.onended = onSpeechEnd;
      audio.onerror = () => {
        console.error('Base64 audio play failed, falling back to local TTS.');
        playLocalTTSFallback(textToSpeak, speedRate, onSpeechEnd);
      };

      audio.play().catch(e => {
        console.warn('Play blocked:', e.message);
        playLocalTTSFallback(textToSpeak, speedRate, onSpeechEnd);
      });
    } catch (err) {
      console.warn('Play base64 err:', err.message);
      if (isAssistantOn && alwaysListening) startContinuousListening();
    }
  };

  // Play audio response from TTS Polly
  const playVoiceResponse = async (textToSpeak, voice, speedRate) => {
    cancelAudioOutput();
    // Turn off always listening mic while outputting voice
    stopContinuousListening();

    try {
      setIsPlayingAudio(true);
      setAvatarState('Speaking');
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/family/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: textToSpeak, voiceProfile: voice, speedRate })
      });

      const onSpeechEnd = () => {
        setIsPlayingAudio(false);
        setAvatarState('Idle');
        setPopBubble(prev => {
          if (prev.sender === 'ai') {
            return { ...prev, visible: false };
          }
          return prev;
        });
        // Restart continuous listening once speaking ends
        if (isAssistantOn && alwaysListening) {
          startContinuousListening();
        }
      };

      if (res.ok) {
        const contentType = res.headers.get('Content-Type');
        if (contentType && contentType.includes('audio/mpeg')) {
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          activeAudioRef.current = audio;
          audio.onended = onSpeechEnd;
          audio.onerror = () => {
            console.error('MPEG audio play failed, falling back to local TTS.');
            playLocalTTSFallback(textToSpeak, speedRate, onSpeechEnd);
          };
          await audio.play();
          return;
        }
      }
      playLocalTTSFallback(textToSpeak, speedRate, onSpeechEnd);
    } catch (err) {
      console.warn('[Polly Synthesis Error] Falling back to local synthesis:', err.message);
      playLocalTTSFallback(textToSpeak, speedRate, () => {
        setIsPlayingAudio(false);
        setAvatarState('Idle');
        setPopBubble(prev => {
          if (prev.sender === 'ai') {
            return { ...prev, visible: false };
          }
          return prev;
        });
        if (isAssistantOn && alwaysListening) startContinuousListening();
      });
    }
  };

  const playLocalTTSFallback = (textToSpeak, speedRate, onEndCallback) => {
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-IN';
      utterance.rate = speedRate === 'slow' ? 0.8 : 1.0;
      utterance.onend = () => {
        setIsPlayingAudio(false);
        if (onEndCallback) onEndCallback();
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        if (onEndCallback) onEndCallback();
      };
      synth.speak(utterance);
    } else {
      setIsPlayingAudio(false);
      if (onEndCallback) onEndCallback();
    }
  };

  const simulateSpeakingWave = (durationMs) => {
    setIsPlayingAudio(true);
    setTimeout(() => {
      setIsPlayingAudio(false);
      setAvatarState('Idle');
      setPopBubble(prev => {
        if (prev.sender === 'ai') {
          return { ...prev, visible: false };
        }
        return prev;
      });
      if (isAssistantOn && alwaysListening) {
        startContinuousListening();
      }
    }, durationMs);
  };

  // Visual glows based on active states
  const getVisualAuraGlow = () => {
    if (!isAssistantOn) return { shadow: 'rgba(255, 0, 50, 0.2)', color: '#FF0033' };
    if (avatarState === 'Thinking') return { shadow: 'rgba(255, 120, 0, 0.45)', color: '#FF7800' };
    if (avatarState === 'Listening') return { shadow: 'rgba(0, 255, 100, 0.55)', color: '#00FF64' };
    if (avatarState === 'Alert') return { shadow: 'rgba(255, 0, 80, 0.65)', color: '#FF0050' };
    if (avatarState === 'Speaking' || isPlayingAudio) return { shadow: 'rgba(176, 38, 255, 0.5)', color: '#B026FF' };
    return { shadow: 'rgba(0, 210, 255, 0.4)', color: '#00d2ff' }; // Idle/Connected
  };

  const aura = getVisualAuraGlow();

  return (
    <>
      <div
        onMouseEnter={() => setShowHoverMenu(true)}
        onMouseLeave={() => setShowHoverMenu(false)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          pointerEvents: 'none'
        }}
      >
        {/* 1. Speech Bubble (above the avatar) */}
        {popBubble.visible && popBubble.text && (
          <div
            style={{
              pointerEvents: 'auto',
              marginBottom: '16px',
              marginRight: '8px',
              background: 'rgba(8, 12, 24, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: popBubble.sender === 'user' 
                ? '1px solid rgba(0, 255, 100, 0.3)' 
                : '1px solid rgba(0, 210, 255, 0.3)',
              borderRadius: '20px',
              padding: '12px 18px',
              color: '#E2E8F0',
              maxWidth: '320px',
              boxShadow: popBubble.sender === 'user'
                ? '0 8px 32px rgba(0,0,0,0.5), 0 0 10px rgba(0, 255, 100, 0.1)'
                : '0 8px 32px rgba(0,0,0,0.5), 0 0 15px rgba(0, 210, 255, 0.15)',
              fontSize: '0.86rem',
              lineHeight: 1.45,
              position: 'relative',
              animation: 'widgetFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            <strong style={{ 
              display: 'block', 
              fontSize: '0.74rem', 
              color: popBubble.sender === 'user' ? '#10B981' : '#00e5ff',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: 800
            }}>
              {popBubble.sender === 'user' ? '🗣️ You' : '🤖 GrihaMitra'}
            </strong>
            <span style={{ fontStyle: popBubble.isInterim ? 'italic' : 'normal', color: popBubble.isInterim ? '#94A3B8' : '#FFF' }}>
              {popBubble.text}
            </span>
            {/* Bubble Arrow */}
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              right: '34px',
              width: '12px',
              height: '12px',
              background: 'rgba(8, 12, 24, 0.95)',
              borderRight: popBubble.sender === 'user' 
                ? '1px solid rgba(0, 255, 100, 0.3)' 
                : '1px solid rgba(0, 210, 255, 0.3)',
              borderBottom: popBubble.sender === 'user' 
                ? '1px solid rgba(0, 255, 100, 0.3)' 
                : '1px solid rgba(0, 210, 255, 0.3)',
              transform: 'rotate(45deg)',
              zIndex: -1
            }} />
          </div>
        )}

        {/* Row containing Avatar and Slide-out Hover Menu */}
        <div style={{ display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
          
          {/* Hover Settings Pill */}
          <div style={{
            pointerEvents: 'auto',
            marginRight: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(8, 12, 24, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 210, 255, 0.25)',
            padding: '8px 16px',
            borderRadius: '30px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: showHoverMenu ? 1 : 0,
            transform: showHoverMenu ? 'translateX(0) scale(1)' : 'translateX(20px) scale(0.9)',
            visibility: showHoverMenu ? 'visible' : 'hidden'
          }}>
            {/* Always Listening Toggle */}
            <button
              onClick={() => setAlwaysListening(!alwaysListening)}
              title={alwaysListening ? "Continuous Listening: ON" : "Continuous Listening: OFF"}
              style={{
                background: alwaysListening ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                border: alwaysListening ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                color: '#FFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              {alwaysListening ? '👂' : '🔇'}
            </button>

            {/* Speech Mute Toggle */}
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              title={speechEnabled ? "Voice Output: ON" : "Voice Output: OFF"}
              style={{
                background: speechEnabled ? 'rgba(0, 210, 255, 0.2)' : 'rgba(255,255,255,0.05)',
                border: speechEnabled ? '1px solid rgba(0, 210, 255, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                color: '#FFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              {speechEnabled ? '🔊' : '🔕'}
            </button>

            {/* Diagnostics Toggle */}
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              title="Toggle Diagnostics Panel"
              style={{
                background: showDiagnostics ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
                border: showDiagnostics ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                color: '#FFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              {showDiagnostics ? '📊' : '📈'}
            </button>

            {/* Profile Switcher Cycle Button */}
            <button
              onClick={() => {
                const allMembers = ['Owner', ...membersList.map(m => m.name)];
                const currentIdx = allMembers.indexOf(selectedMember);
                const nextIdx = (currentIdx + 1) % allMembers.length;
                setSelectedMember(allMembers[nextIdx]);
              }}
              title={`Profile: ${selectedMember}`}
              style={{
                background: 'rgba(176, 38, 255, 0.15)',
                border: '1px solid rgba(176, 38, 255, 0.4)',
                borderRadius: '20px',
                padding: '0 12px',
                height: '36px',
                color: '#E2E8F0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                transition: 'all 0.2s',
                outline: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              👤 {selectedMember}
            </button>

            {/* Assistant Master Switch */}
            <button
              onClick={() => setIsAssistantOn(!isAssistantOn)}
              title={isAssistantOn ? "Assistant: ON" : "Assistant: OFF"}
              style={{
                background: isAssistantOn ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                border: isAssistantOn ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                color: '#FFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              {isAssistantOn ? '⚡' : '🔌'}
            </button>
          </div>

          {/* Circular Floating Widget Face */}
          <div 
            onClick={handleToggleManualListen}
            style={{
              pointerEvents: 'auto',
              width: '82px',
              height: '82px',
              borderRadius: '50%',
              background: 'rgba(10, 15, 30, 0.85)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `2px solid ${aura.color}`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${aura.shadow}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              animation: avatarState === 'Listening' ? 'widget-pulsate 1.5s infinite' : 'none',
              position: 'relative'
            }}
            className="widget-hover-scale"
          >
            {/* Core Avatar Face */}
            <div style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              overflow: 'hidden',
              background: '#02050a',
              position: 'relative'
            }}>
              <video 
                id="widget-avatar-video"
                autoPlay 
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: (isAssistantOn && !isMockSession && videoTrackActive) ? 'block' : 'none',
                  zIndex: 2
                }}
              />

              {(isMockSession || !videoTrackActive || !isAssistantOn) && (
                <img 
                  src={avatarFace} 
                  alt="GrihaMitra Face"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: isAssistantOn ? 1 : 0.4
                  }}
                />
              )}
            </div>

            {/* Status Indicator Dot */}
            <div style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: aura.color,
              boxShadow: `0 0 10px ${aura.color}`,
              zIndex: 10
            }} />
          </div>
        </div>

        {/* 3. Diagnostics Panel */}
        {isAssistantOn && showDiagnostics && (
          <div style={{
            pointerEvents: 'auto',
            marginTop: '12px',
            marginRight: '8px',
            background: 'rgba(8, 12, 24, 0.95)',
            border: '1px solid rgba(0, 210, 255, 0.2)',
            borderRadius: '16px',
            padding: '12px 18px',
            display: 'grid',
            gridTemplateColumns: '120px 160px',
            gap: '6px 16px',
            fontSize: '0.74rem',
            color: '#CBD5E1',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'widgetFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gridColumn: 'span 2', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', marginBottom: '4px' }}>
              <strong style={{ color: '#00e5ff', fontSize: '0.78rem', fontWeight: 800 }}>🔧 System Diagnostics</strong>
            </div>
            <span style={{ color: '#94A3B8' }}>Mic Status:</span>
            <strong style={{ textAlign: 'right' }}>{diagnostics.micStatus}</strong>
            <span style={{ color: '#94A3B8' }}>Speaker Status:</span>
            <strong style={{ textAlign: 'right' }}>{diagnostics.speakerStatus}</strong>
            <span style={{ color: '#94A3B8' }}>Avatar Stream:</span>
            <strong style={{ textAlign: 'right' }}>{diagnostics.streamStatus}</strong>
            <span style={{ color: '#94A3B8' }}>Wake Word:</span>
            <strong style={{ textAlign: 'right' }}>{diagnostics.wakeWordStatus}</strong>
          </div>
        )}
      </div>

      {/* DYNAMIC STYLES BLOCK */}
      <style>{`
        .widget-hover-scale:hover {
          transform: scale(1.06) translateY(-2px);
        }
        @keyframes widget-pulsate {
          0% { box-shadow: 0 0 0 0 rgba(0, 255, 100, 0.4); transform: scale(1); }
          50% { box-shadow: 0 0 0 15px rgba(0, 255, 100, 0); transform: scale(1.04); }
          100% { box-shadow: 0 0 0 0 rgba(0, 255, 100, 0); transform: scale(1); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes widgetFadeIn {
          from { opacity: 0; transform: translateY(15px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
};

export default GrihaMitra;
