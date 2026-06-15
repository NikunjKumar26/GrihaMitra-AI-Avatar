import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ManageOwners from './ManageOwners';

const AdminDashboard = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'owners'
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    if (!user.email || (user.role !== 'Admin' && user.role !== 'Owner')) {
      navigate('/dashboard');
      return;
    }
    fetchPendingUsers();
  }, [navigate]);

  const fetchPendingUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = user.role === 'Admin' ? '/api/auth/pending' : '/api/home/pending';
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingUsers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const approveUser = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = user.role === 'Admin' ? `/api/auth/verify/${userId}` : `/api/home/approve/${userId}`;
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}${endpoint}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to approve');
      fetchPendingUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const rejectUser = async (userId) => {
    try {
      if (user.role === 'Admin') return; // Only Owners reject explicitly here
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/reject/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to reject');
      fetchPendingUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  return (
    <div className="dashboard-layout fade-in">
      {/* Sidebar matching the theme! */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-brand">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="url(#yellowGradientAdmin)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 12px rgba(234, 235, 114, 0.6))', marginTop: '-4px' }}>
              <defs>
                <linearGradient id="yellowGradientAdmin" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#EAEB72" />
                </linearGradient>
              </defs>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span className="brand-text">Sapno Ka Ghar</span>
          </h2>
        </div>
        <div className="sidebar-menu">
          <p className="menu-label">System Control</p>
          <div className={`menu-item ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
            <span style={{ marginLeft: '10px' }}>Pending Approvals</span>
          </div>
          {user.role === 'Admin' && (
            <div className={`menu-item ${activeTab === 'owners' ? 'active' : ''}`} onClick={() => setActiveTab('owners')}>
              <span style={{ marginLeft: '10px' }}>Manage Owners</span>
            </div>
          )}
          
          <p className="menu-label" style={{ marginTop: 'auto' }}>Actions</p>
          {user.role === 'Owner' && (
            <div className="menu-item" onClick={() => navigate('/dashboard')}>
              <span style={{ marginLeft: '10px' }}>Go To Dashboard</span>
            </div>
          )}
          <div className="menu-item" onClick={handleLogout}>
            <span style={{ marginLeft: '10px' }}>Log out</span>
          </div>
        </div>
      </div>

      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <header className="top-header" style={{ width: '100%', maxWidth: '800px', marginBottom: '1rem' }}>
          <div className="user-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <h1 style={{ margin: 0 }}>{user.role === 'Admin' ? 'Admin Gateway' : 'Home Access Management'}</h1>
              <span style={{ 
                background: user.role === 'Admin' ? 'rgba(255, 100, 100, 0.15)' : 'rgba(234, 235, 114, 0.15)', 
                color: user.role === 'Admin' ? '#FF6464' : 'var(--accent-yellow)', 
                padding: '4px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
                border: user.role === 'Admin' ? '1px solid rgba(255, 100, 100, 0.3)' : '1px solid rgba(234, 235, 114, 0.3)'
              }}>
                {user.role}
              </span>
            </div>
          </div>
        </header>

        {error && <p style={{ color: '#FF0000', fontWeight: 'bold' }}>{error}</p>}
        {error && setTimeout(() => setError(''), 5000) && null}

        {activeTab === 'pending' ? (
          <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '800px' }}>
            <h2>Pending {user.role === 'Admin' ? 'Owners' : 'Members'}</h2>
            {pendingUsers.length === 0 && <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>No pending approvals exist right now.</p>}
            
            <div className="user-list" style={{ marginTop: '1.5rem' }}>
              {pendingUsers.map(u => (
                <div key={u._id || u.user?._id} className="user-item">
                  <div>
                    <strong>{u.email || u.user?.email || u.username}</strong> - Role: {u.role || 'Member'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => approveUser(u.user ? u.user._id : u._id)}
                      style={{ background: 'var(--accent-yellow)', color: 'var(--text-dark)' }}
                    >
                      ✅ Approve
                    </button>
                    {user.role === 'Owner' && (
                      <button 
                        onClick={() => rejectUser(u.user ? u.user._id : u._id)}
                        style={{ background: 'transparent', border: '1px solid #FF0000', color: '#FF0000' }}
                      >
                        ❌ Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ManageOwners error={error} setError={setError} />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
