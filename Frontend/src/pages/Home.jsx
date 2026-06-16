import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const avatarCardRef = useRef(null);
  const [selectedEmotion, setSelectedEmotion] = useState('Normal');
  const [isSimulatingSpeech, setIsSimulatingSpeech] = useState(false);
  const [simulationText, setSimulationText] = useState("Hello! I am GrihaMitra, your smart home AI companion. How can I help you today?");
  
  // Dialogue definitions for simulation playground
  const dialogues = {
    Normal: {
      text: "Namaste! I am GrihaMitra, your smart home companion. All home systems are operating optimally. The Living Room temperature is currently 24°C.",
      avatarColor: "#EAEB72",
      avatarGlow: "rgba(234, 235, 114, 0.3)"
    },
    Concerned: {
      text: "Attention: The agricultural water tank level has fallen below 15%. I have automatically disabled the irrigation pump to protect the hardware.",
      avatarColor: "#F59E0B",
      avatarGlow: "rgba(245, 158, 11, 0.3)"
    },
    Excited: {
      text: "Great news! I have noticed a recurring pattern: you study at 6:00 PM on weekdays. I have generated a comfort automation routine for your study light!",
      avatarColor: "#00FF9C",
      avatarGlow: "rgba(0, 255, 156, 0.3)"
    },
    Thinking: {
      text: "Mining smart home event history database... Random Forest model accuracy is 98.2%. Confidence score for Bedroom AC prediction is 91%.",
      avatarColor: "#9333ea",
      avatarGlow: "rgba(147, 51, 234, 0.3)"
    },
    Alert: {
      text: "Security Alert: Unidentified perimeter movement detected near the backyard zone. Live RTSP WebRTC stream has been broadcasted to the dashboard.",
      avatarColor: "#EF4444",
      avatarGlow: "rgba(239, 68, 68, 0.3)"
    }
  };

  // 1. 3D Canvas Sphere Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Points on a 3D sphere
    const numParticles = 140;
    const particles = [];
    const radius = 280;
    
    for (let i = 0; i < numParticles; i++) {
      // Golden spiral distribution on sphere
      const theta = Math.acos(1 - (2 * i) / numParticles);
      const phi = Math.sqrt(numParticles * Math.PI) * theta;
      
      particles.push({
        x3d: radius * Math.sin(theta) * Math.cos(phi),
        y3d: radius * Math.sin(theta) * Math.sin(phi),
        z3d: radius * Math.cos(theta),
        baseX: radius * Math.sin(theta) * Math.cos(phi),
        baseY: radius * Math.sin(theta) * Math.sin(phi),
        baseZ: radius * Math.cos(theta),
      });
    }

    let angleX = 0.002;
    let angleY = 0.003;
    const perspective = 400;
    const centerX = width / 2;
    const centerY = height / 2;

    // Mouse interactive speed modifiers
    let mouseX = 0;
    let mouseY = 0;
    
    const handleMouseMoveGlobal = (e) => {
      mouseX = (e.clientX - width / 2) / (width / 2);
      mouseY = (e.clientY - height / 2) / (height / 2);
    };

    window.addEventListener('mousemove', handleMouseMoveGlobal);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Update rotation angles dynamically based on mouse position
      const currentAngleX = angleX + mouseY * 0.01;
      const currentAngleY = angleY + mouseX * 0.01;

      const cosX = Math.cos(currentAngleX);
      const sinX = Math.sin(currentAngleX);
      const cosY = Math.cos(currentAngleY);
      const sinY = Math.sin(currentAngleY);

      // Map & project particles
      const projected = [];

      for (let i = 0; i < numParticles; i++) {
        const p = particles[i];

        // Rotate Y
        let x1 = p.x3d * cosY - p.z3d * sinY;
        let z1 = p.z3d * cosY + p.x3d * sinY;

        // Rotate X
        let y2 = p.y3d * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.y3d * sinX;

        // Store back rotated coordinates
        p.x3d = x1;
        p.y3d = y2;
        p.z3d = z2;

        // Perspective projection mapping
        const scale = perspective / (perspective + z2);
        const projX = x1 * scale + centerX;
        const projY = y2 * scale + centerY;

        projected.push({
          x: projX,
          y: projY,
          z: z2,
          scale: scale,
          alpha: Math.max(0.08, Math.min(0.8, (perspective - z2) / (perspective * 2)))
        });
      }

      // Draw wireframe connection lines
      ctx.strokeStyle = 'rgba(234, 235, 114, 0.04)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < numParticles; i++) {
        for (let j = i + 1; j < numParticles; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Connect close neighboring points to draw grid wireframes
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.strokeStyle = `rgba(234, 235, 114, ${0.05 * (1 - dist/100) * projected[i].alpha})`;
            ctx.stroke();
          }
        }
      }

      // Draw particle points
      for (let i = 0; i < numParticles; i++) {
        const p = projected[i];
        
        ctx.beginPath();
        // Dot sizes scaled by depth
        ctx.arc(p.x, p.y, Math.max(1, 2.5 * p.scale), 0, Math.PI * 2);
        
        // Deep particles purple, foreground ones smart yellow
        const colorVal = p.z > 0 ? '147, 51, 234' : '234, 235, 114';
        ctx.fillStyle = `rgba(${colorVal}, ${p.alpha * 1.5})`;
        ctx.fill();
        
        // Halo effect on foreground nodes
        if (p.scale > 1.1) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(4, 6 * p.scale), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${colorVal}, ${p.alpha * 0.3})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 2. Interactive Card 3D Tilt Effect
  const handleCardTilt = (e) => {
    const card = avatarCardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // Mouse position inside card
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = -(y - centerY) / 12; // Modulate angle limits
    const tiltY = (x - centerX) / 12;

    card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(10px)`;
  };

  const handleCardReset = () => {
    const card = avatarCardRef.current;
    if (!card) return;
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
  };

  // 3. Simulator Play/Trigger Controls
  const handleEmotionSelect = (emotion) => {
    setSelectedEmotion(emotion);
    setSimulationText(dialogues[emotion].text);
    setIsSimulatingSpeech(true);

    // Audio text speech synthesis simulation trigger
    const audio = new Audio();
    
    // Auto idle speech signal animation off after 4.5 seconds
    setTimeout(() => {
      setIsSimulatingSpeech(false);
    }, 4500);
  };

  const handleDashboardRedirect = () => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="landing-container">
      {/* 3D Wireframe Canvas */}
      <canvas ref={canvasRef} className="canvas-bg" />

      {/* Decorative Orbs */}
      <div className="glow-orb one" />
      <div className="glow-orb two" />

      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="footer-logo">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="url(#yellowGradientLanding)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 12px rgba(234, 235, 114, 0.6))' }}>
            <defs>
              <linearGradient id="yellowGradientLanding" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#EAEB72" />
              </linearGradient>
            </defs>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span className="brand-text">Sapno Ka Ghar</span>
        </div>
        
        <div className="nav-links">
          <a href="#features" className="nav-link">Features</a>
          <a href="#avatar-spotlight" className="nav-link">AI Companion</a>
          <a href="#architecture" className="nav-link">Architecture</a>
          <button className="nav-btn" onClick={handleDashboardRedirect}>Launch Dashboard</button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content fade-in">
          <div className="hero-tagline">
            <span className="tagline-pulse"></span>
            AI-Driven Smart Home Companion
          </div>
          <h1 className="hero-title">
            Step Into the <br />
            <span className="highlight">Home of Your Dreams</span>
          </h1>
          <p className="hero-description">
            Experience the next level of smart environments. Sapno Ka Ghar (GrihaMitra) unifies deep telemetry automations with a natural, emotive 3D AI Avatar assistant that speaks, reasons, and adapts to your family's daily routines.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={handleDashboardRedirect}>
              Enter System
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <a href="#features" className="btn-secondary">
              Discover Features
            </a>
          </div>
        </div>

        {/* 3D Emotive Companion Card */}
        <div className="avatar-3d-wrapper fade-in" style={{ animationDelay: '0.2s' }}>
          <div 
            ref={avatarCardRef}
            className="avatar-3d-card"
            onMouseMove={handleCardTilt}
            onMouseLeave={handleCardReset}
          >
            <div className="avatar-header">
              <div className="avatar-status">
                <span className="avatar-pulse-circle"></span>
                <span className="avatar-status-text">Companion Live</span>
              </div>
              <span className="avatar-tag">Nova Lite reasoning</span>
            </div>

            <div className="avatar-face-container">
              <div className="avatar-halo"></div>
              <div className="avatar-halo inner"></div>
              <div className="avatar-image-frame" style={{ borderColor: dialogues[selectedEmotion].avatarColor, boxShadow: `0 0 45px ${dialogues[selectedEmotion].avatarGlow}` }}>
                <img src="/avatar_face.png" alt="AI Avatar Companion Face" />
                <div className="avatar-scanline"></div>
              </div>
            </div>

            <div className="avatar-footer">
              <h3 className="avatar-title">GrihaMitra Companion</h3>
              <p className="avatar-subtitle">
                Interactive smart home assistant utilizing WebRTC visual streams, semantic long-term memory, and emotion-classified conversations.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Features Showcase Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <span className="section-subtitle">Cognitive Ecosystem</span>
          <h2 className="section-title">Centralized Intelligence Engines</h2>
        </div>

        <div className="features-grid">
          {/* Feature 1 */}
          <div className="feature-3d-card" onMouseMove={handleCardTilt} onMouseLeave={handleCardReset}>
            <div className="feature-icon-wrapper">🤖</div>
            <h3 className="feature-name">Predictive Auto-Pilot</h3>
            <p className="feature-description">
              Scikit-Learn Random Forest Classifier monitors daily usage behavior to predict actions with distinct confidence checks: automatic execution (&gt;90%), dashboard validation popups (70-90%), and recommendation logs.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="feature-3d-card" onMouseMove={handleCardTilt} onMouseLeave={handleCardReset}>
            <div className="feature-icon-wrapper">⚡</div>
            <h3 className="feature-name">Decoupled Queue Workers</h3>
            <p className="feature-description">
              Asynchronous BullMQ pipelines route computational loads through dedicated Redis queues: SpeechToText (FastAPI Whisper) ➡️ Bedrock Processing (Nova Lite) ➡️ Polly Generation (neural Fallback) ➡️ Voice Analytics.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="feature-3d-card" onMouseMove={handleCardTilt} onMouseLeave={handleCardReset}>
            <div className="feature-icon-wrapper">📹</div>
            <h3 className="feature-name">P2P Camera WebRTC Relays</h3>
            <p className="feature-description">
              Direct peer-to-peer WebRTC stream wrapper. Spawns backend FFmpeg pipelines to decode camera nodes (AMB82 MINI) RTSP inputs and feeds RTP packages directly to client displays.
            </p>
          </div>
        </div>
      </section>

      {/* Emotive Avatar Showcase Simulator */}
      <section id="avatar-spotlight" className="avatar-showcase-section">
        <div className="avatar-showcase-container">
          <div className="showcase-visuals">
            <div className="simulator-window">
              <div className="simulator-screen">
                <div className="simulator-avatar" style={{ borderColor: dialogues[selectedEmotion].avatarColor, boxShadow: `0 0 30px ${dialogues[selectedEmotion].avatarGlow}` }}>
                  <img src="/avatar_face.png" alt="Simulator Avatar Face" />
                </div>
                
                {/* Simulated Audio Soundwave */}
                <div className="avatar-waveform">
                  <div className={`wave-bar ${isSimulatingSpeech ? 'speaking' : ''}`}></div>
                  <div className={`wave-bar ${isSimulatingSpeech ? 'speaking' : ''}`}></div>
                  <div className={`wave-bar ${isSimulatingSpeech ? 'speaking' : ''}`}></div>
                  <div className={`wave-bar ${isSimulatingSpeech ? 'speaking' : ''}`}></div>
                  <div className={`wave-bar ${isSimulatingSpeech ? 'speaking' : ''}`}></div>
                </div>
              </div>

              <div className="simulator-console">
                <div className="console-label">Dialogue Output ({selectedEmotion} Mode)</div>
                <div className="console-output">
                  "{simulationText}"
                </div>

                <div className="console-label">Select Companion Mood Simulator</div>
                <div className="simulator-controls">
                  {Object.keys(dialogues).map((emotion) => (
                    <button
                      key={emotion}
                      className={`control-btn ${selectedEmotion === emotion ? 'active' : ''}`}
                      onClick={() => handleEmotionSelect(emotion)}
                    >
                      {emotion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="showcase-content">
            <span className="section-subtitle">Cognitive Companion</span>
            <h2 className="showcase-title">Human-Avatar Companion Dialogue</h2>
            <p className="showcase-desc">
              GrihaMitra is not a simple command utility. By binding real-time WebRTC sessions with Amazon Bedrock Converse processing, the avatar analyzes conversation histories, updates home layouts, and dynamically personalizes responses.
            </p>

            <div className="features-list">
              <div className="features-list-item">
                <div className="item-check">✓</div>
                <div className="item-text">
                  <h4>Role-Based Personalization profiles</h4>
                  <p>Grandmother mode (Hindi/slow pace/maternal tone), Student mode (Enthusiastic study guidance), Parent mode (Safety parameters, quick dashboard status summary).</p>
                </div>
              </div>

              <div className="features-list-item">
                <div className="item-check">✓</div>
                <div className="item-text">
                  <h4>Proactive Decision alerts</h4>
                  <p>BullMQ triggers schedules that detect water deficiencies or security anomalies, announcing them proactively without voice overlap or system flooding.</p>
                </div>
              </div>

              <div className="features-list-item">
                <div className="item-check">✓</div>
                <div className="item-text">
                  <h4>Cost-Efficient Audio Cache</h4>
                  <p>Translates text to SSML profiles, constructs MD5 hash codes, and loads cached MP3 files from the filesystem before calling Amazon Polly, reducing cloud costs.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Pipeline & Architecture Visualizer */}
      <section id="architecture" className="pipeline-section">
        <div className="section-header">
          <span className="section-subtitle">Data Pipelines</span>
          <h2 className="section-title">End-To-End Cognitive Flow</h2>
        </div>

        <div className="pipeline-flow">
          <div className="pipeline-node">
            <div className="node-num">1</div>
            <div className="node-name">Voice Capture</div>
            <div className="node-desc">Client records base64 speech stream</div>
          </div>

          <div className="pipeline-node">
            <div className="node-num">2</div>
            <div className="node-name">FastAPI Whisper</div>
            <div className="node-desc">Transcribes audio into text commands</div>
          </div>

          <div className="pipeline-node">
            <div className="node-num">3</div>
            <div className="node-name">Bedrock Agent</div>
            <div className="node-desc">Performs multi-turn logic & generates JSON plan</div>
          </div>

          <div className="pipeline-node">
            <div className="node-num">4</div>
            <div className="node-name">IoT Actuation</div>
            <div className="node-desc">Socket.io relays commands to ESP32 switches</div>
          </div>

          <div className="pipeline-node">
            <div className="node-num">5</div>
            <div className="node-name">Polly & HeyGen</div>
            <div className="node-desc">Streams synthesized voice & avatar video back</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-banner">
          <h2 className="cta-title">Ready to Experience GrihaMitra?</h2>
          <p className="cta-desc">
            Deploy smart automation grids, configure custom profile settings, and connect your home hardware with cutting-edge conversational companion avatars today.
          </p>
          <div className="cta-buttons">
            <button className="btn-primary" onClick={handleDashboardRedirect}>
              Get Started Now
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
            <a href="#features" className="btn-secondary">
              Read Documentation
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-copyright">
            © 2026 Sapno Ka Ghar. All rights reserved.
          </div>
          <div className="footer-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#yellowGradientFooter)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 10px rgba(234, 235, 114, 0.5))' }}>
              <defs>
                <linearGradient id="yellowGradientFooter" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#EAEB72" />
                </linearGradient>
              </defs>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span className="footer-logo-text">Sapno Ka Ghar</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
