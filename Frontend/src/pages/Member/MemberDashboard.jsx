import React from 'react';
import DeviceIcon from '../../components/DeviceIcon';

const MemberDashboard = ({ homeInfo, toggleDevice, handleLogout, user }) => {
  return (
    <>
      <nav className="navbar fade-in">
        <h1>{homeInfo?.houseName} - Member Dashboard</h1>
        <div className="nav-links">
          <span style={{marginRight: '1rem'}}>{user.email}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {homeInfo?.rooms.map(room => (
          <div key={room._id} className="glass-card fade-in">
            <h2 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>{room.name}</h2>
            
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              {room.devices.map(device => (
                <DeviceIcon 
                  key={device._id} 
                  device={device} 
                  onToggle={() => toggleDevice(room._id, device._id, device.isOn)} 
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default MemberDashboard;
