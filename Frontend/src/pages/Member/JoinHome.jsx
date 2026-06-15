import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const JoinHome = () => {
  const [joinDetails, setJoinDetails] = useState({ uniqueHomeName: '', homeCode: '' });
  const navigate = useNavigate();

  const handleJoinHome = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(joinDetails)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Instantly physically reload the application environment so the global Dashboard router naturally intercepts the new Pending API response.
      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  return (
    <div className="app-container">
      <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '400px', margin: '20vh auto' }}>
        <h2 style={{ textAlign: 'center' }}>Join a Home</h2>
        <p style={{ textAlign: 'center', fontSize: '0.9rem', marginBottom: '1rem', color: '#ccc' }}>
          Enter the Home Name <b>OR</b> the 4-Digit Code
        </p>
        <input type="text" placeholder="Unique Home Name (Optional)" onChange={e => setJoinDetails({...joinDetails, uniqueHomeName: e.target.value})} />
        <input type="text" placeholder="4-Digit Code (Optional)" onChange={e => setJoinDetails({...joinDetails, homeCode: e.target.value})} />
        <button onClick={handleJoinHome}>Send Join Request</button>
        <button onClick={handleLogout} style={{ background: '#555' }}>Logout</button>
      </div>
    </div>
  );
};

export default JoinHome;
