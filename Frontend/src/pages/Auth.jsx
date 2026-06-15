import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : `${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}`;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Owner');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleModeSwitch = () => {
    setIsLogin(!isLogin);
    setError('');
    setMsg('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    // Pre-flight Validations
    if (!isLogin && name.trim().length < 2) {
      return setError('Please provide a valid full name.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return setError('Ensure your email is correctly formatted.');
    }
    if (password.length < 6) {
      return setError('Security requires a password of at least 6 characters.');
    }

    setIsLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isLogin ? { email, password } : { name, email, password, role }
        )
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection rejected by host.');

      if (isLogin) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        if (data.user.role === 'Admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        setMsg(data.message);
        setIsLogin(true); // Switch automatically to login on success
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', width: '100%', overflowX: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', background: '#050505'
    }}>
      {/* Dynamic Background */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1558036117-15d82a90b9b1?w=1600&q=80)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(12px) saturate(0.3)', opacity: 0.15 }}></div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'linear-gradient(135deg, rgba(5,5,5,0.85) 0%, rgba(5,5,5,1) 100%)' }}></div>
      <div style={{ position: 'absolute', top: '0', right: '0', width: '60vw', height: '60vh', background: 'radial-gradient(ellipse at top right, rgba(234, 235, 114, 0.1) 0%, rgba(0,0,0,0) 70%)', zIndex: 1, pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', bottom: '0', left: '0', width: '60vw', height: '60vh', background: 'radial-gradient(ellipse at bottom left, rgba(234, 235, 114, 0.05) 0%, rgba(0,0,0,0) 70%)', zIndex: 1, pointerEvents: 'none' }}></div>

      {/* Main Glass Context Container */}
      <div className="fade-in" style={{ 
        position: 'relative', zIndex: 10, width: '100%', maxWidth: '440px', background: 'rgba(20, 20, 20, 0.65)', backdropFilter: 'blur(25px)', WebkitBackdropFilter: 'blur(25px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '24px', padding: 'clamp(2rem, 5vw, 3.5rem) clamp(1.5rem, 4vw, 3rem)', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column'
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: '56px', height: '56px', background: 'var(--accent-yellow)', borderRadius: '14px', margin: '0 auto 1.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 25px rgba(234, 235, 114, 0.3)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
          </div>
          <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 1.8rem)', fontWeight: 700, color: '#FFF', letterSpacing: '-0.5px' }}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: '0.5rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
            {isLogin ? 'Enter your credentials to securely access your home ecosystem.' : 'Join the household and connect your devices instantly.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {error && (
            <div className="fade-in" style={{ background: 'rgba(255, 50, 50, 0.1)', border: '1px solid rgba(255, 50, 50, 0.2)', padding: '1rem', borderRadius: '12px', color: '#FF5555', fontSize: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink: 0, marginTop: '2px'}}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>{error}</span>
            </div>
          )}

          {msg && (
            <div className="fade-in" style={{ background: 'rgba(68, 255, 68, 0.1)', border: '1px solid rgba(68, 255, 68, 0.2)', padding: '1rem', borderRadius: '12px', color: '#44FF44', fontSize: '0.9rem', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.4 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink: 0, marginTop: '2px'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              <span>{msg}</span>
            </div>
          )}

          {!isLogin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600 }}>Full Name</label>
              <input type="text" placeholder="e.g. John Doe" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', padding: '14px 16px', borderRadius: '12px', fontSize: '1rem', color: '#FFF', transition: '0.3s', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--accent-yellow)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}/>
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600 }}>Email Address</label>
            <input type="email" placeholder="you@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', padding: '14px 16px', borderRadius: '12px', fontSize: '1rem', color: '#FFF', transition: '0.3s', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--accent-yellow)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}/>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600 }}>Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', padding: '14px 16px', borderRadius: '12px', fontSize: '1rem', color: '#FFF', transition: '0.3s', letterSpacing: '2px', outline: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--accent-yellow)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}/>
          </div>
          
          {!isLogin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600 }}>System Profile Tier</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', padding: '14px 16px', borderRadius: '12px', fontSize: '1rem', color: '#FFF', transition: '0.3s', cursor: 'pointer', outline: 'none', appearance: 'none' }} onFocus={e => e.target.style.borderColor = 'var(--accent-yellow)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}>
                <option value="Owner" style={{color: '#000'}}>Owner (Full Access)</option>
                <option value="Member" style={{color: '#000'}}>Member (Limited Access)</option>
                {/* <option value="Admin" style={{color: '#000'}}> Admin</option> */}
              </select>
            </div>
          )}

          <button type="submit" disabled={isLoading} style={{ 
            marginTop: '1rem', background: isLoading ? 'rgba(234, 235, 114, 0.5)' : 'var(--accent-yellow)', color: '#000', padding: '16px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 800, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: isLoading ? 'none' : '0 8px 25px rgba(234, 235, 114, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
          onMouseEnter={e => { if(!isLoading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(234, 235, 114, 0.3)'; } }}
          onMouseLeave={e => { if(!isLoading) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(234, 235, 114, 0.2)'; } }}>
            {isLoading ? (
              <>
                <svg className="spinner" viewBox="0 0 50 50" style={{width: '20px', height: '20px', animation: 'rotate 1s linear infinite'}}>
                  <circle cx="25" cy="25" r="20" fill="none" strokeWidth="5" stroke="#000" strokeDasharray="31.4 31.4" strokeLinecap="round"></circle>
                </svg>
                Processing...
              </>
            ) : (
              isLogin ? 'Secure Login' : 'Create Account'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <span style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
          </span>
          <span 
            style={{ color: '#FFF', cursor: 'pointer', fontWeight: 600, display: 'inline-block', transition: '0.2s', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '2px', marginLeft: '6px' }}
            onClick={handleModeSwitch}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-yellow)'; e.currentTarget.style.borderColor = 'var(--accent-yellow)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#FFF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
          >
            {isLogin ? 'Register Here' : 'Login Here'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Auth;

