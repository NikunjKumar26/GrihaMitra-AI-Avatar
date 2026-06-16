import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Admin = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [error, setError] = useState('');
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
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}${endpoint}`, {
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
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}${endpoint}`, {
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
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/reject/${userId}`, {
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
    <>
      <nav className="navbar fade-in">
        <h1>{user.role === 'Admin' ? 'Admin' : 'Owner'} Panel</h1>
        <div className="nav-links">
          <button onClick={() => navigate('/dashboard')} style={{marginRight: '1rem'}}>Dashboard</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '800px' }}>
        <h2>Pending {user.role === 'Admin' ? 'Owners' : 'Members'} Approvals</h2>
        {error && <p style={{ color: 'var(--color-bright-red)' }}>{error}</p>}
        {pendingUsers.length === 0 && <p style={{ marginTop: '1rem' }}>No pending approvals.</p>}
        
        <div className="user-list" style={{ marginTop: '1.5rem' }}>
          {pendingUsers.map(u => (
            <div key={u._id || u.user?._id} className="user-item">
              <div>
                <strong>{u.email || u.user?.email || u.username}</strong> - Role: {u.role || 'Member'}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => approveUser(u.user ? u.user._id : u._id)}
                  style={{ background: '#4caf50' }}
                >
                  ✅ Approve
                </button>
                {user.role === 'Owner' && (
                  <button 
                    onClick={() => rejectUser(u.user ? u.user._id : u._id)}
                    style={{ background: '#FF0000' }}
                  >
                    ❌ Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default Admin;
