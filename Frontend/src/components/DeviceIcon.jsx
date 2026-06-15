import React, { useState } from 'react';

const DeviceIcon = ({ device, onToggle }) => {
  const { isOn, type, name } = device;
  const [isHovered, setIsHovered] = useState(false);

  // Icons depending on device
  const renderIcon = () => {
    const iconColor = isOn ? 'var(--accent-yellow)' : 'var(--text-secondary)';
    switch (type.toLowerCase()) {
      case 'light':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill={isOn ? 'var(--accent-yellow)' : 'none'} stroke={iconColor} strokeWidth="2" style={{ transition: '0.3s ease' }}>
            <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"></path>
            <path d="M9 21h6"></path>
          </svg>
        );
      case 'fan':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" style={{ transform: isOn ? 'rotate(360deg)' : 'none', transition: isOn ? 'transform 1s linear infinite' : '0.3s ease', transformOrigin: 'center' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 2v20"></path>
            <path d="M2 12h20"></path>
            <path d="M12 12L4.93 4.93"></path>
            <path d="M12 12l7.07 7.07"></path>
          </svg>
        );
      case 'ac':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
            <rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect>
            <path d="M6 10h12"></path>
            <path d="M6 14h12"></path>
          </svg>
        );
      default:
        return <div style={{ width: 24, height: 24, borderRadius: '50%', background: iconColor }}></div>;
    }
  };

  return (
    <div 
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '110px',
        padding: '1.2rem',
        borderRadius: '16px',
        background: 'var(--bg-panel)',
        cursor: 'pointer',
        border: '1px solid',
        borderColor: isOn ? 'var(--accent-yellow)' : (isHovered ? 'var(--border-subtle)' : 'transparent'),
        transition: '0.3s ease'
      }}
      className="fade-in"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {renderIcon()}
        </div>
        {/* Toggle Indicator imitating the image */}
        <div style={{
          width: '32px',
          height: '18px',
          borderRadius: '10px',
          background: isOn ? 'var(--accent-yellow)' : 'var(--bg-input)',
          position: 'relative',
          transition: '0.3s ease'
        }}>
          <div style={{
            position: 'absolute',
            top: '2px',
            left: isOn ? '16px' : '2px',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: isOn ? 'var(--bg-base)' : 'var(--text-secondary)',
            transition: '0.3s ease'
          }} />
        </div>
      </div>
      
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: isOn ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {name}
        </p>
        {device.roomName && (
          <span style={{ fontSize: '0.7rem', color: isOn ? 'rgba(234, 235, 114, 0.9)' : 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            {device.roomName}
          </span>
        )}
      </div>
    </div>
  );
};

export default DeviceIcon;
