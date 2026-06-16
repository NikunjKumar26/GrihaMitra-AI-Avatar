import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ManageOwners = ({ error, setError }) => {
  const [owners, setOwners] = useState([]);

  useEffect(() => {
    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/auth/owners`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOwners(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const traverseBlock = async (ownerId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/auth/block/${ownerId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to toggle block status');
      fetchOwners(); // refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fade-in" style={{ width: '100%', maxWidth: '1000px', marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.8rem', color: '#FFF', margin: 0, fontWeight: 600, letterSpacing: '-0.5px' }}>Manage Active Owners</h2>
        <span style={{ background: 'rgba(234, 235, 114, 0.1)', border: '1px solid rgba(234, 235, 114, 0.3)', color: 'var(--accent-yellow)', padding: '6px 16px', borderRadius: '12px', fontWeight: 'bold' }}>
          {owners.length} Registered
        </span>
      </div>

      {owners.length === 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', padding: '4rem', textAlign: 'center', borderRadius: '16px' }}>
           <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No Active Owners registered on the platform.</p>
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.5rem' }}>
        {owners.map(o => (
          <div key={o._id} style={{
            background: 'var(--bg-panel)',
            border: o.isBlocked ? '1px solid rgba(255,50,50,0.3)' : '1px solid var(--border-subtle)',
            borderRadius: '16px', padding: '1.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
            transition: 'transform 0.3s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            
            {/* Status Ribbon Strip */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: o.isBlocked ? '#FF4444' : 'var(--accent-yellow)' }} />

            {/* Profile Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingLeft: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                 <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: o.isBlocked ? 'rgba(255,50,50,0.1)' : 'rgba(234, 235, 114, 0.1)', border: o.isBlocked ? '1px solid rgba(255,50,50,0.2)' : '1px solid rgba(234, 235, 114, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                   {o.isBlocked ? '🚫' : '👑'}
                 </div>
                 <div>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}>{o.name || o.email.split('@')[0]}</h3>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{o.email}</span>
                 </div>
              </div>
              
              <span style={{ 
                background: o.isBlocked ? 'rgba(255,50,50,0.1)' : 'rgba(68,255,68,0.1)', 
                color: o.isBlocked ? '#FF5555' : '#44FF44', 
                border: o.isBlocked ? '1px solid rgba(255,50,50,0.2)' : '1px solid rgba(68,255,68,0.2)',
                padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' 
              }}>
                {o.isBlocked ? 'Suspended' : 'Active'}
              </span>
            </div>

            {/* Stats Grid */}
            <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '1.2rem', marginTop: '1.5rem', marginLeft: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Smart Home</span>
                <span style={{ color: '#FFF', fontWeight: 600, fontSize: '0.95rem' }}>🏠 {o.houseName || 'Not Set'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Users Linked</span>
                <span style={{ color: '#FFF', fontWeight: 600, fontSize: '0.95rem' }}>👥 {o.memberCount} Linked</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Hardware</span>
                <span style={{ color: '#FFF', fontWeight: 600, fontSize: '0.95rem' }}>🔌 {o.deviceCount} Nodes</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Zones / Rooms</span>
                <span style={{ color: '#FFF', fontWeight: 600, fontSize: '0.95rem' }}>🚪 {o.roomCount} Sectors</span>
              </div>
            </div>

            {/* Action Banner */}
            <button 
              onClick={() => traverseBlock(o._id)}
              style={{ 
                marginTop: '1.5rem', marginLeft: '10px', width: 'calc(100% - 10px)',
                background: o.isBlocked ? 'rgba(68,255,68,0.1)' : 'rgba(255,50,50,0.1)', 
                color: o.isBlocked ? '#44FF44' : '#FF5555',
                border: o.isBlocked ? '1px solid rgba(68,255,68,0.3)' : '1px solid rgba(255,50,50,0.3)',
                fontWeight: 'bold', padding: '14px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '1.5px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = o.isBlocked ? '#44FF44' : '#FF4444';
                e.currentTarget.style.color = '#000';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = o.isBlocked ? 'rgba(68,255,68,0.1)' : 'rgba(255,50,50,0.1)';
                e.currentTarget.style.color = o.isBlocked ? '#44FF44' : '#FF5555';
              }}
            >
              {o.isBlocked ? 'Restore Network Access' : 'Suspend Home Network'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ManageOwners;
