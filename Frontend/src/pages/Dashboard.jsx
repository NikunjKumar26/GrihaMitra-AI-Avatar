import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import HomeSetup from './Owner/HomeSetup';
import OwnerDashboard from './Owner/OwnerDashboard';
import DeviceIcon from '../components/DeviceIcon';
import JoinHome from './Member/JoinHome';
import VoiceAssistant from './Voice/VoiceAssistant';
import GrihaMitra from '../components/GrihaMitra';

const Dashboard = () => {
  const [homeInfo, setHomeInfo] = useState(null);
  const [socket, setSocket] = useState(null);
  const [joinDetails, setJoinDetails] = useState({ uniqueHomeName: '', homeCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [latestNotification, setLatestNotification] = useState(null);
  
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!user.email) {
      navigate('/auth');
      return;
    }
    if (user.role === 'Admin') {
      navigate('/admin');
      return;
    }
    fetchHome();
  }, [navigate]);

  const fetchHome = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      const data = await res.json();
      setLoading(false);
      
      if (!res.ok) {
        if(res.status === 403) {
          if (data.error === 'Blocked by Owner') {
            setHomeInfo('BLOCKED');
          } else {
            setHomeInfo('PENDING');
          }
          return;
        }
        if(res.status === 404) {
          // Normal state for users with no home yet
          return;
        }
        throw new Error(data.error);
      }
      setHomeInfo(data);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Socket setup once home is resolved
  useEffect(() => {
    if (homeInfo && !socket) {
      const newSocket = io(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}`);
      setSocket(newSocket);

      newSocket.emit('joinHome', { homeId: homeInfo._id });

      newSocket.on('deviceUpdate', ({ roomId, deviceId, state }) => {
        setHomeInfo(prev => {
          const newHome = { ...prev };
          if(newHome && newHome.rooms) {
            newHome.rooms = newHome.rooms.map(room => {
              if (room._id === roomId) {
                room.devices = room.devices.map(dev => {
                  if (dev._id === deviceId) dev.isOn = state;
                  return dev;
                });
              }
              return room;
            });
          }
          return newHome;
        });
      });

      newSocket.on('homeUpdated', () => {
        fetchHome(); // Automatically refetch state
      });

      newSocket.on('notification', (notif) => {
        setNotifications(prev => [notif, ...prev].slice(0, 3)); // Keep strictly max 3
        setLatestNotification(notif);

        // Auto-dismiss exact notification after 3 seconds for optimal UX
        setTimeout(() => {
          setNotifications(current => current.filter(n => n.id !== notif.id));
        }, 3000);
      });

      return () => newSocket.close();
    }
  }, [homeInfo?._id]);

  const toggleDevice = (roomId, deviceId, currentState) => {
    if (socket && homeInfo) {
      const newState = !currentState;
      // Optimistic Update
      setHomeInfo(prev => {
        const newHome = { ...prev };
        newHome.rooms = newHome.rooms.map(room => {
          if (room._id === roomId) {
            room.devices = room.devices.map(dev => {
              if (dev._id === deviceId) dev.isOn = newState;
              return dev;
            });
          }
          return room;
        });
        return newHome;
      });
      socket.emit('toggleDevice', { homeId: homeInfo._id, roomId, deviceId, state: newState, userName: user.name, userId: user.id || user._id });
    }
  };

  const handleJoinHome = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(joinDetails)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('Join Request Sent! Waiting for owner approval.');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>Loading...</div>;

  // Render Flows based on User and Home existence
  if (!homeInfo && user.role === 'Owner') {
    return <HomeSetup setHomeInfo={setHomeInfo} />;
  }

  if (homeInfo === 'PENDING' && user.role === 'Member') {
    return (
      <div className="fade-in" style={{ 
        minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808', position: 'relative' 
      }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(circle, rgba(234, 235, 114, 0.05) 0%, rgba(0,0,0,0) 50%)' }}></div>
        <div style={{ 
          position: 'relative', zIndex: 10, background: 'rgba(20, 20, 20, 0.7)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', 
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', padding: '3rem', textAlign: 'center', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.6rem', fontWeight: 600 }}>Approval Pending</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '2rem' }}>
            Your join request has been transmitted securely. The Owner must approve your profile before you can access the interface.
          </p>
          <button 
            onClick={handleLogout} 
            style={{ background: 'rgba(255,50,50,0.1)', color: '#FF5555', padding: '12px 24px', borderRadius: '12px', border: '1px solid rgba(255,50,50,0.3)', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FF4444'; e.currentTarget.style.color = '#FFF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,50,50,0.1)'; e.currentTarget.style.color = '#FF5555'; }}
          >
            Log Out Securely
          </button>
        </div>
      </div>
    );
  }

  if (homeInfo === 'BLOCKED' && user.role === 'Member') {
    return (
      <div className="fade-in" style={{ 
        minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080808', position: 'relative' 
      }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(circle, rgba(255, 50, 50, 0.08) 0%, rgba(0,0,0,0) 50%)' }}></div>
        <div style={{ 
          position: 'relative', zIndex: 10, background: 'rgba(20, 20, 20, 0.7)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', 
          border: '1px solid rgba(255,50,50,0.15)', borderRadius: '24px', padding: '3rem', textAlign: 'center', maxWidth: '400px', boxShadow: '0 20px 40px rgba(255,0,0,0.1)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#FF5555' }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{margin: '0 auto'}}><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
          </div>
          <h2 style={{ color: '#FF5555', marginBottom: '1rem', fontSize: '1.6rem', fontWeight: 600 }}>Access Revoked</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '2rem' }}>
            The system owner has permanently blocked your access to this smart home environment. You cannot reconnect.
          </p>
          <button 
            onClick={handleLogout} 
            style={{ background: 'rgba(255,50,50,0.1)', color: '#FF5555', padding: '12px 24px', borderRadius: '12px', border: '1px solid rgba(255,50,50,0.3)', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FF4444'; e.currentTarget.style.color = '#FFF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,50,50,0.1)'; e.currentTarget.style.color = '#FF5555'; }}
          >
            Log Out Securely
          </button>
        </div>
      </div>
    );
  }

  if (!homeInfo && user.role === 'Member') {
    return <JoinHome />;
  }

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Global Notification Render Block
  const NotificationsUI = () => (
    <div className="notifications-container" style={{ zIndex: 99999, display: 'flex', flexDirection: 'column', pointerEvents: 'none', gap: '10px' }}>
      {notifications.map(n => {
        let borderColor = '#3B82F6'; // Default Info -> Blue
        if (n.message.includes('turned ON')) borderColor = '#00FF9C'; // Success -> Green
        if (n.message.includes('Error') || n.message.includes('failed')) borderColor = '#EF4444'; // Error -> Red
        if (n.message.includes('Warning')) borderColor = '#F59E0B'; // Warning -> Orange
        
        let finalMessage = n.message;
        if(n.actorName === user.name) {
          finalMessage = finalMessage.replace(n.actorName, 'You');
        }

        return (
          <div key={n.id} className="fade-in" style={{ 
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.95)', 
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderLeft: `4px solid ${borderColor}`, 
            padding: '1rem 1.2rem', 
            borderRadius: '12px', 
            color: '#1A1A1A', 
            width: '100%',
            maxWidth: '400px',
            boxShadow: `0 8px 32px rgba(0,0,0,0.15), 0 0 15px ${borderColor}44`,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ 
              minWidth: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: borderColor,
              boxShadow: `0 0 8px ${borderColor}`
            }} />
            <span style={{ fontSize: '0.90rem', letterSpacing: '0.3px', lineHeight: '1.4', fontWeight: '600' }}>{finalMessage}</span>
          </div>
        );
      })}
    </div>
  );

  // We now seamlessly unify the Glassmorphism Interface! 
  // OwnerDashboard contains internal dynamic protection flags so Members safely experience the premium UI without backend overlap.
  return (
    <>
      <OwnerDashboard
        homeInfo={homeInfo}
        NotificationsUI={NotificationsUI}
        toggleDevice={toggleDevice}
        handleLogout={handleLogout}
        user={user}
        latestNotification={latestNotification}
        socket={socket}
      />
      {/* <VoiceAssistant homeInfo={homeInfo} toggleDevice={toggleDevice} /> */}
      <GrihaMitra homeInfo={homeInfo} socket={socket} />
    </>
  );
};

export default Dashboard;
