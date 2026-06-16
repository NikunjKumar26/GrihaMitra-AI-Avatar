import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const HomeSetup = ({ setHomeInfo }) => {
  const [houseName, setHouseName] = useState('');
  const [roomCount, setRoomCount] = useState(1);
  const [rooms, setRooms] = useState([{ name: 'Bedroom', devices: [{name: 'Main Light', type: 'light'}, {name: 'Ceiling Fan', type: 'fan'}] }]);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRoomCountChange = (count) => {
    setRoomCount(count);
    const newRooms = Array(Number(count)).fill().map((_, i) => ({
      name: `Room ${i + 1}`,
      devices: [{name: 'Main Light', type: 'light'}]
    }));
    setRooms(newRooms);
  };

  const addDevice = (roomIndex, type) => {
    const updated = [...rooms];
    updated[roomIndex].devices.push({ name: `New ${type}`, type });
    setRooms(updated);
  };

  const removeDevice = (roomIndex, deviceIndex) => {
    const updated = [...rooms];
    updated[roomIndex].devices.splice(deviceIndex, 1);
    setRooms(updated);
  };

  const updateRoomName = (roomIndex, name) => {
    const updated = [...rooms];
    updated[roomIndex].name = name;
    setRooms(updated);
  };

  const submitSetup = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ houseName, rooms })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setHomeInfo(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="glass-card fade-in" style={{ width: '100%', maxWidth: '800px', margin: '2rem auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Set Up Your Home</h2>
      {error && <p style={{ color: 'var(--color-bright-red)', textAlign: 'center' }}>{error}</p>}
      
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label>House Name</label>
          <input type="text" value={houseName} onChange={e => setHouseName(e.target.value)} placeholder="e.g. Dream Villa" />
          
          <label>Number of Rooms</label>
          <input type="number" min="1" max="10" value={roomCount} onChange={e => handleRoomCountChange(e.target.value)} />
          
          <button onClick={() => { if(houseName) setStep(2) }}>Next Step - Design Rooms</button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {rooms.map((room, rIdx) => (
            <div key={rIdx} style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-mid-red)' }}>
              <input type="text" value={room.name} onChange={e => updateRoomName(rIdx, e.target.value)} placeholder="Room Name (e.g. Living Room)" style={{ fontWeight: 'bold' }} />
              
              <div style={{ margin: '1rem 0' }}>
                <h4>Devices</h4>
                {room.devices.map((dev, dIdx) => (
                  <div key={dIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.5rem 0', background: 'rgba(0,0,0,0.5)', padding: '0.5rem', borderRadius: '4px' }}>
                    <span>{dev.name} ({dev.type})</span>
                    <button style={{ width: 'auto', margin: 0, padding: '4px 8px', background: 'var(--color-bright-red)' }} onClick={() => removeDevice(rIdx, dIdx)}>X</button>
                  </div>
                ))}
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => addDevice(rIdx, 'light')} style={{ margin: 0, fontSize: '0.8rem' }}>+ Add Light</button>
                <button onClick={() => addDevice(rIdx, 'fan')} style={{ margin: 0, fontSize: '0.8rem' }}>+ Add Fan</button>
                <button onClick={() => addDevice(rIdx, 'ac')} style={{ margin: 0, fontSize: '0.8rem' }}>+ Add AC</button>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setStep(1)} style={{ background: '#555' }}>Back</button>
            <button onClick={submitSetup}>Finish Setup</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeSetup;
