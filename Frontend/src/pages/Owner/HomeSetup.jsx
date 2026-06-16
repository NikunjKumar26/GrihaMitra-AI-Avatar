import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const HomeSetup = ({ setHomeInfo }) => {
  const [houseName, setHouseName] = useState('');
  const [roomCount, setRoomCount] = useState(1);
  const [rooms, setRooms] = useState([{ name: 'Living Room', devices: [{name: 'Main Light', type: 'light'}, {name: 'Ceiling Fan', type: 'fan'}] }]);
  const [step, setStep] = useState(1);
  const [activeRoomIndex, setActiveRoomIndex] = useState(0);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  // Handle Step 1 Room Count Math Programmatically
  const adjustRoomCount = (delta) => {
    const newCount = Math.max(1, Math.min(10, roomCount + delta));
    setRoomCount(newCount);
    
    setRooms(prev => {
      const newRooms = [...prev];
      if (newRooms.length < newCount) {
        for(let i = newRooms.length; i < newCount; i++) {
          newRooms.push({ name: `Room ${i + 1}`, devices: [{name: 'Main Light', type: 'light'}] });
        }
      } else if (newRooms.length > newCount) {
        newRooms.splice(newCount, newRooms.length - newCount);
      }
      return newRooms;
    });
  };

  const addDeviceToActiveRoom = (type) => {
    let devName = 'Device';
    if(type === 'light') devName = 'Smart Light';
    if(type === 'fan') devName = 'Ceiling Fan';
    if(type === 'ac') devName = 'Air Conditioner';
    if(type === 'tv') devName = 'Smart TV';
    if(type === 'fridge') devName = 'Refrigerator';

    // Intelligently auto-number devices based on active load count
    const updated = [...rooms];
    const internalDevices = updated[activeRoomIndex].devices;
    const sameTypeCount = internalDevices.filter(d => d.type === type).length;
    internalDevices.push({ name: sameTypeCount === 0 ? devName : `${devName} ${sameTypeCount + 1}`, type });
    setRooms(updated);
  };

  const removeDeviceByType = (type) => {
    const updated = [...rooms];
    const devices = updated[activeRoomIndex].devices;
    for (let i = devices.length - 1; i >= 0; i--) {
      if (devices[i].type === type) {
        devices.splice(i, 1);
        break;
      }
    }
    setRooms(updated);
  };

  const removeDevice = (deviceIndex) => {
    const updated = [...rooms];
    updated[activeRoomIndex].devices.splice(deviceIndex, 1);
    setRooms(updated);
  };

  const updateRoomName = (name) => {
    const updated = [...rooms];
    updated[activeRoomIndex].name = name;
    setRooms(updated);
  };

  const submitSetup = async () => {
    try {
      setIsSubmitting(true);
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
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(circle at 50% -20%, rgba(234, 235, 114, 0.15), rgba(8,8,8,1) 50%)' }}></div>
      
      <div className="glass-card fade-in" style={{ 
        width: '100%', maxWidth: step === 1 ? '550px' : '900px', padding: '3rem', position: 'relative', zIndex: 10,
        background: 'rgba(20, 20, 20, 0.65)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        
        {error && <div style={{ background: 'rgba(255,0,0,0.1)', color: '#FF5555', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', textAlign: 'center', border: '1px solid rgba(255,0,0,0.2)' }}>{error}</div>}

        {step === 1 && (
          <div style={{ textAlign: 'center' }} className="fade-in">
            <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#FFF' }}>Initialize Your Space</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', fontSize: '1.1rem' }}>Define the core framework of your Smart Home before integrating hardware subsystems.</p>
            
            <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#AAA', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>House Name</label>
              <input 
                type="text" 
                value={houseName} 
                onChange={e => setHouseName(e.target.value)} 
                placeholder="e.g. Dream Villa" 
                style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#FFF', fontSize: '1.2rem', marginBottom: '2rem', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)', outline: 'none', transition: 'border 0.2s' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-yellow)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              
              <label style={{ display: 'block', marginBottom: '8px', color: '#AAA', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Total Rooms to Configure</label>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '8px', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' }}>
                <button onClick={() => adjustRoomCount(-1)} style={{ width: '50px', height: '50px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#FFF', fontSize: '1.5rem', margin: 0, border: 'none', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.05)'}>-</button>
                <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-yellow)', textShadow: '0 0 15px rgba(234, 235, 114, 0.3)' }}>{roomCount}</span>
                <button onClick={() => adjustRoomCount(1)} style={{ width: '50px', height: '50px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#FFF', fontSize: '1.5rem', margin: 0, border: 'none', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.05)'}>+</button>
              </div>

              <button 
                onClick={() => { if(houseName.trim()) setStep(2) }} 
                disabled={!houseName.trim()}
                style={{ width: '100%', padding: '18px', marginTop: '3rem', borderRadius: '12px', fontSize: '1.1rem', background: houseName.trim() ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.1)', color: houseName.trim() ? '#000' : '#888', fontWeight: 'bold', transition: '0.3s', border: 'none', cursor: houseName.trim() ? 'pointer' : 'not-allowed', boxShadow: houseName.trim() ? '0 10px 20px rgba(234, 235, 114, 0.2)' : 'none' }}
              >
                Proceed to Blueprint ➔
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '2.2rem', margin: 0, color: '#FFF', letterSpacing: '-0.5px' }}>Blueprint Designer</h2>
                <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0', fontSize: '1.1rem' }}>Configure appliances for <strong style={{ color: 'var(--accent-yellow)' }}>{houseName}</strong></p>
              </div>
              <button 
                onClick={() => setStep(1)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '10px', color: '#FFF', cursor: 'pointer', transition: '0.2s' }}
                onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.05)'}
              >
                ← Return
              </button>
            </div>

            <div style={{ display: 'flex', gap: '2rem', height: '500px' }}>
              
              {/* Left Column: Room Tabs */}
              <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '10px' }}>
                {rooms.map((room, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setActiveRoomIndex(idx)}
                    style={{ 
                      padding: '16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: activeRoomIndex === idx ? 'linear-gradient(135deg, rgba(234, 235, 114, 0.2) 0%, rgba(200,200,0,0.05) 100%)' : 'rgba(255,255,255,0.02)',
                      color: activeRoomIndex === idx ? 'var(--accent-yellow)' : 'var(--text-secondary)',
                      border: `1px solid ${activeRoomIndex === idx ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)'}`,
                      transform: activeRoomIndex === idx ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: activeRoomIndex === idx ? '0 10px 20px rgba(0,0,0,0.2)' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Zone {idx + 1}</div>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: activeRoomIndex === idx ? 'bold' : 'normal', fontSize: '1.1rem', color: activeRoomIndex === idx ? '#FFF' : 'inherit' }}>{room.name}</div>
                  </div>
                ))}
              </div>

              {/* Right Column: Active Room Configuration */}
              <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '2.5rem', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.04)', boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)' }}>
                
                <input 
                  type="text" 
                  value={rooms[activeRoomIndex].name} 
                  onChange={e => updateRoomName(e.target.value)} 
                  placeholder="Room Name" 
                  style={{ background: 'transparent', border: 'none', borderBottom: '2px solid rgba(255,255,255,0.1)', fontSize: '2.2rem', color: '#FFF', paddingBottom: '10px', marginBottom: '2rem', outline: 'none', fontWeight: 'bold', width: '100%', transition: 'border 0.3s' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-yellow)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />

                <p style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem', marginBottom: '12px', fontWeight: 600 }}>Deploy Hardware ({rooms[activeRoomIndex].devices.length} Installed)</p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
                  {[
                    { type: 'light', label: 'Smart Light', icon: '💡', color: 'var(--accent-yellow)', bg: 'rgba(234, 235, 114, 0.15)' },
                    { type: 'fan', label: 'Ceiling Fan', icon: '🌀', color: '#64C8FF', bg: 'rgba(100, 200, 255, 0.15)' },
                    { type: 'ac', label: 'A/C Unit', icon: '❄️', color: '#FF9696', bg: 'rgba(255, 150, 150, 0.15)' },
                    { type: 'tv', label: 'Smart TV', icon: '📺', color: '#96FF96', bg: 'rgba(150, 255, 150, 0.15)' },
                    { type: 'fridge', label: 'Refrigerator', icon: '🧊', color: '#C896FF', bg: 'rgba(200, 150, 255, 0.15)' },
                  ].map(devConf => {
                     const count = rooms[activeRoomIndex].devices.filter(d => d.type === devConf.type).length;
                     return (
                        <div key={devConf.type} className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '16px 20px', borderRadius: '16px', border: count > 0 ? `1px solid ${devConf.bg}` : '1px solid rgba(255,255,255,0.05)', boxShadow: count > 0 ? `0 4px 20px ${devConf.bg}` : 'none', transition: 'all 0.3s' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                             <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: devConf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>{devConf.icon}</div>
                             <span style={{ color: count > 0 ? '#FFF' : '#AAA', fontSize: '1.2rem', fontWeight: 600, transition: '0.3s' }}>{devConf.label}</span>
                           </div>
                           
                           <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(0,0,0,0.5)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                             <button onClick={() => removeDeviceByType(devConf.type)} disabled={count === 0} style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'transparent', border: 'none', color: count === 0 ? '#555' : '#FFF', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: count === 0 ? 'not-allowed' : 'pointer', transition: '0.2s' }} onMouseEnter={e=>{if(count>0) e.currentTarget.style.background='rgba(255,255,255,0.1)'}} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>−</button>
                             <span style={{ width: '30px', textAlign: 'center', fontSize: '1.3rem', fontWeight: 'bold', color: count > 0 ? devConf.color : '#666' }}>{count}</span>
                             <button onClick={() => addDeviceToActiveRoom(devConf.type)} style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.1)'}>+</button>
                           </div>
                        </div>
                     )
                  })}
                </div>

              </div>
            </div>

            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem' }}>
              <button 
                onClick={submitSetup} 
                disabled={isSubmitting}
                style={{ padding: '16px 40px', borderRadius: '12px', fontSize: '1.2rem', background: 'var(--accent-yellow)', color: '#000', fontWeight: 'bold', boxShadow: '0 10px 30px rgba(234, 235, 114, 0.25)', border: 'none', cursor: 'pointer', transition: '0.3s' }}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}
              >
                {isSubmitting ? 'Synchronizing Home Array...' : 'Finalize & Boot System ➔'}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default HomeSetup;
