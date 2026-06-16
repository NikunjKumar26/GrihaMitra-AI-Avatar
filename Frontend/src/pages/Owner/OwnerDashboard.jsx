import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DeviceIcon from '../../components/DeviceIcon';
import HomeChat from '../../components/HomeChat';
import FamilyIntelligence from '../FamilyIntelligence';
import PredictiveAutomation from '../PredictiveAutomation';
import ExplainabilityDashboard from '../ExplainabilityDashboard';
import VoiceDashboard from '../Voice/VoiceDashboard';
import AvatarDashboard from '../AvatarDashboard';

const OwnerDashboard = ({ homeInfo, NotificationsUI, toggleDevice, handleLogout, user, latestNotification, socket }) => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('architecture');
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const activeRoom = homeInfo?.rooms?.find(r => r._id === currentRoomId);
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [expandedMemberDetails, setExpandedMemberDetails] = useState(null);
  const [tempAccessibleRooms, setTempAccessibleRooms] = useState([]);
  const [roomTemp, setRoomTemp] = useState(null);

  const [expandedMenus, setExpandedMenus] = useState({
    companion: false,
    intelligence: false,
    logs: false,
    manage: false
  });

  const toggleSubmenu = (menu) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menu]: !prev[menu]
    }));
  };

  useEffect(() => {
    if (['avatar_dashboard', 'voice_dashboard', 'chat'].includes(activeTab)) {
      setExpandedMenus(prev => ({ ...prev, companion: true }));
    } else if (['family_intel', 'automation', 'explainability'].includes(activeTab)) {
      setExpandedMenus(prev => ({ ...prev, intelligence: true }));
    } else if (['notifications', 'event_history'].includes(activeTab)) {
      setExpandedMenus(prev => ({ ...prev, logs: true }));
    } else if (['members', 'join_requests', 'add_room'].includes(activeTab)) {
      setExpandedMenus(prev => ({ ...prev, manage: true }));
    }
  }, [activeTab]);


  // Phase 1 - AI Event History & Analytics States
  const [eventHistory, setEventHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [histRoomId, setHistRoomId] = useState('');
  const [histDeviceId, setHistDeviceId] = useState('');
  const [histUserId, setHistUserId] = useState('');
  const [histStartDate, setHistStartDate] = useState('');
  const [histEndDate, setHistEndDate] = useState('');
  const [histPage, setHistPage] = useState(1);
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [histLoading, setHistLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Phase 2 - Family Context Engine States
  const [selectedMemberContext, setSelectedMemberContext] = useState(null);
  const [selectedMemberSummary, setSelectedMemberSummary] = useState('');
  const [selectedMemberSummaryLoading, setSelectedMemberSummaryLoading] = useState(false);

  const fetchMemberContext = async (memberId) => {
    if (!memberId) return;
    try {
      setSelectedMemberContext(null);
      setSelectedMemberSummary('');
      setSelectedMemberSummaryLoading(true);
      const token = localStorage.getItem('token');
      
      const contextRes = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/context/profile/${memberId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const contextData = await contextRes.json();
      if (contextRes.ok) {
        setSelectedMemberContext(contextData);
      }

      const summaryRes = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/context/summary/${memberId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const summaryData = await summaryRes.json();
      if (summaryRes.ok) {
        setSelectedMemberSummary(summaryData.summary || 'No summary available.');
      }
      setSelectedMemberSummaryLoading(false);
    } catch (err) {
      console.error('Error fetching member context:', err);
      setSelectedMemberSummaryLoading(false);
    }
  };

  const fetchEventHistory = async () => {
    if (!homeInfo?._id) return;
    try {
      setHistLoading(true);
      const token = localStorage.getItem('token');
      let url = `${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/history/home/${homeInfo._id}?page=${histPage}&limit=10`;
      if (histRoomId) url += `&roomId=${histRoomId}`;
      if (histDeviceId) url += `&deviceId=${histDeviceId}`;
      if (histUserId) url += `&userId=${histUserId}`;
      if (histStartDate) url += `&startDate=${histStartDate}`;
      if (histEndDate) url += `&endDate=${histEndDate}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setEventHistory(data.events || []);
        setHistTotalPages(data.totalPages || 1);
      }
      setHistLoading(false);
    } catch (err) {
      console.error('Error fetching event history:', err);
      setHistLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!homeInfo?._id) return;
    try {
      setAnalyticsLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/history/analytics/${homeInfo._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAnalytics(data);
      }
      setAnalyticsLoading(false);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'event_history') {
      fetchEventHistory();
    }
  }, [activeTab, histPage, histRoomId, histDeviceId, histUserId, histStartDate, histEndDate, homeInfo?._id]);

  useEffect(() => {
    if (activeTab === 'event_history') {
      fetchAnalytics();
    }
  }, [activeTab, homeInfo?._id]);

  useEffect(() => {
    if (latestNotification && activeTab === 'event_history') {
      fetchEventHistory();
      fetchAnalytics();
    }
  }, [latestNotification, activeTab]);

  const handleRoomFilterChange = (e) => {
    setHistRoomId(e.target.value);
    setHistDeviceId('');
    setHistPage(1);
  };
  const handleDeviceFilterChange = (e) => {
    setHistDeviceId(e.target.value);
    setHistPage(1);
  };
  const handleUserFilterChange = (e) => {
    setHistUserId(e.target.value);
    setHistPage(1);
  };
  const handleStartDateChange = (e) => {
    setHistStartDate(e.target.value);
    setHistPage(1);
  };
  const handleEndDateChange = (e) => {
    setHistEndDate(e.target.value);
    setHistPage(1);
  };

  const [familyMembers, setFamilyMembers] = useState([]);
  const [profileModal, setProfileModal] = useState({
    isOpen: false,
    type: 'create_offline', // 'create_offline', 'setup_ai', 'edit', 'approve'
    userId: null,
    memberId: null,
    name: '',
    role: 'Father',
    age: '',
    preferredLanguage: 'English',
    voiceProfile: 'Aditi',
    routineProfile: 'Office Routine',
    preferences: {
      tempPreference: 24,
      lightingStyle: 'Warm White',
      extraNotes: ''
    }
  });

  const fetchFamilyMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if(res.ok) setFamilyMembers(data);
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFamilyMembers();
  }, []);

  const handleRoleChange = (role) => {
    let routine = 'Dynamic Routine';
    if (role === 'Father') routine = 'Office Routine';
    else if (role === 'Mother') routine = 'Cooking Routine';
    else if (role === 'Grandmother') routine = 'Pooja Routine';
    else if (role === 'Student') routine = 'Study Routine';

    setProfileModal(prev => ({
      ...prev,
      role,
      routineProfile: routine
    }));
  };

  const handleSaveFamilyMember = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!profileModal.name.trim() || !profileModal.role) return;

    if (profileModal.type === 'approve') {
      await handleApprove(profileModal.userId, {
        name: profileModal.name,
        role: profileModal.role,
        age: profileModal.age,
        preferredLanguage: profileModal.preferredLanguage,
        voiceProfile: profileModal.voiceProfile,
        routineProfile: profileModal.routineProfile,
        preferences: profileModal.preferences
      });
      setProfileModal(prev => ({ ...prev, isOpen: false }));
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const method = profileModal.type === 'edit' ? 'PUT' : 'POST';
      const url = profileModal.type === 'edit' 
        ? `${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/members/${profileModal.memberId}`
        : `${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/members`;

      const bodyData = {
        name: profileModal.name,
        role: profileModal.role,
        age: profileModal.age ? parseInt(profileModal.age) : undefined,
        preferredLanguage: profileModal.preferredLanguage,
        voiceProfile: profileModal.voiceProfile,
        routineProfile: profileModal.routineProfile,
        preferences: profileModal.preferences,
        user: profileModal.userId || undefined
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();
      if (res.ok) {
        setProfileModal(prev => ({ ...prev, isOpen: false }));
        fetchFamilyMembers();
      } else {
        alert(data.error || 'Failed to save member');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditMemberClick = (member) => {
    setProfileModal({
      isOpen: true,
      type: 'edit',
      userId: member.user || null,
      memberId: member._id,
      name: member.name,
      role: member.role,
      age: member.age || '',
      preferredLanguage: member.preferredLanguage || 'English',
      voiceProfile: member.voiceProfile || 'Aditi',
      routineProfile: member.routineProfile || 'Office Routine',
      preferences: {
        tempPreference: member.preferences?.tempPreference || 24,
        lightingStyle: member.preferences?.lightingStyle || 'Warm White',
        extraNotes: member.preferences?.extraNotes || ''
      }
    });
  };

  const handleDeleteMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to delete this family member profile?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchFamilyMembers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete member');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveMemberRooms = async (memberId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/member/${memberId}/rooms`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ roomIds: tempAccessibleRooms })
      });
      if (res.ok) {
        setExpandedMemberDetails(null);
      } else {
        let errData;
        try { errData = await res.json(); } catch(e){}
        alert(`Failed to save access: ${errData ? errData.error : res.statusText}`);
      }
    } catch(err) {
      console.error(err);
      alert(`Network error: ${err.message}`);
    }
  };

  // Keep pending requests synced dynamically or via reload
  useEffect(() => {
    setPendingRequestsCount(homeInfo?.members?.filter(m => m.status === 'pending').length || 0);
  }, [homeInfo]);

  // Real-time tracking and WebSockets
  useEffect(() => {
    if (!socket) return;
    const handleChat = (msg) => {
      if (activeTab !== 'chat') {
        const myId = String(user.id || user._id);
        if (String(msg.senderId) !== myId) {
          setUnreadChatCount(prev => prev + 1);
        }
      }
    };
    
    // Clear unread count automatically when the chat gets cleared by owner
    const handleChatCleared = () => {
      setUnreadChatCount(0);
    };

    // Handle incoming join requests dynamically
    const handleNewRequest = () => {
      // Push the count up instantly when anyone requests
      setPendingRequestsCount(prev => prev + 1);
    };

    const handleTemperatureUpdate = (data) => {
      if (data && data.temperature != null) {
        setRoomTemp(data.temperature);
      }
    };

    socket.on('receiveChatMessage', handleChat);
    socket.on('chatCleared', handleChatCleared);
    socket.on('newJoinRequest', handleNewRequest);
    socket.on('temperatureUpdate', handleTemperatureUpdate);

    return () => {
      socket.off('receiveChatMessage', handleChat);
      socket.off('chatCleared', handleChatCleared);
      socket.off('newJoinRequest', handleNewRequest);
      socket.off('temperatureUpdate', handleTemperatureUpdate);
    };
  }, [socket, activeTab, user]);

  // New Room Creation States
  const [newRoom, setNewRoom] = useState({ name: '', devices: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const addDeviceToNewRoom = (type) => {
    let devName = 'Device';
    if(type === 'light') devName = 'Smart Light';
    if(type === 'fan') devName = 'Ceiling Fan';
    if(type === 'ac') devName = 'A/C Unit';
    if(type === 'tv') devName = 'Smart TV';
    if(type === 'fridge') devName = 'Refrigerator';

    const currentCount = newRoom.devices.filter(d => d.type === type).length;
    setNewRoom(prev => ({ 
      ...prev, 
      devices: [...prev.devices, { name: currentCount === 0 ? devName : `${devName} ${currentCount + 1}`, type }] 
    }));
  };

  const removeDeviceFromNewRoom = (type) => {
    setNewRoom(prev => {
      const devices = [...prev.devices];
      for (let i = devices.length - 1; i >= 0; i--) {
        if (devices[i].type === type) {
          devices.splice(i, 1);
          break;
        }
      }
      return { ...prev, devices };
    });
  };

  const submitNewRoom = async () => {
    if(!newRoom.name.trim()) return;
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newRoom)
      });
      if(res.ok) {
        setNewRoom({ name: '', devices: [] });
        setActiveTab('dashboard');
      }
    } catch(err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []); // Note: Might want to depend on socket events natively but simple fetch on mount works to populate historic data

  useEffect(() => {
    if(latestNotification) {
      setHistory(prev => {
        // Prevent duplicate appending if component strict-mode fires
        if(prev.find(n => n._id === latestNotification._id)) return prev;
        return [latestNotification, ...prev];
      });
    }
  }, [latestNotification]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if(res.ok) setHistory(data);
    } catch(err) {
      console.error(err);
    }
  };

  const activeMembers = homeInfo?.members?.filter(m => m.status === 'approved') || [];
  const pendingMembers = homeInfo?.members?.filter(m => m.status === 'pending') || [];

  const handleClearNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/notifications/clear`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if(res.ok) setHistory([]);
    } catch(err) {
      console.error(err);
    }
  };

  const handleApprove = async (userId, profileData) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/approve/${userId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(profileData || {})
      });
      if (res.ok) {
        fetchFamilyMembers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to approve member');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/reject/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Backend will emit 'homeUpdated' socket event to refresh State
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromote = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/promote/${userId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Backend will emit 'homeUpdated' socket event to refresh State
    } catch (err) {
      console.error(err);
    }
  };

  const handleDemote = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/demote/${userId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Backend will emit 'homeUpdated' socket event to refresh State
    } catch (err) {
      console.error(err);
    }
  };

  const getWattage = (type) => {
    const t = type.toLowerCase();
    if(t.includes('ac')) return 1500;
    if(t.includes('freeze') || t.includes('fridge')) return 250;
    if(t.includes('tv')) return 150;
    if(t.includes('fan')) return 60;
    if(t.includes('light')) return 15;
    return 50; 
  };

  const calculatePower = () => {
    let power = 0;
    homeInfo?.rooms?.forEach(room => {
      room.devices.forEach(dev => {
        if(dev.isOn) power += getWattage(dev.type);
      });
    });
    return power;
  };

  const turnOffAll = () => {
    homeInfo?.rooms?.forEach(room => {
      room.devices.forEach(dev => {
        if(dev.isOn) {
          toggleDevice(room._id, dev._id, true); 
        }
      });
    });
  };

  const getRoomImage = (name) => {
    const n = name.toLowerCase();
    if(n.includes('kitchen')) return 'https://images.unsplash.com/photo-1556910103-1c02745a828?w=500&q=80';
    if(n.includes('bed')) return 'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=500&q=80';
    if(n.includes('living')) return 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=500&q=80';
    if(n.includes('bath')) return 'https://images.unsplash.com/photo-1584622650111-993d426fbf0a?w=500&q=80';
    return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&q=80'; // generic modern house
  };

  const mainDevices = [];
  homeInfo?.rooms?.forEach(room => {
    room.devices.forEach(dev => {
      const t = dev.type.toLowerCase();
      if(t.includes('ac') || t.includes('tv') || t.includes('freeze') || t.includes('fridge') || t.includes('washing')) {
        mainDevices.push({ ...dev, roomId: room._id, roomName: room.name });
      }
    });
  });

  return (
    <div className="dashboard-layout fade-in">
      <NotificationsUI />
      
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-brand">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="url(#yellowGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 12px rgba(234, 235, 114, 0.6))', marginTop: '-4px' }}>
              <defs>
                <linearGradient id="yellowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#EAEB72" />
                </linearGradient>
              </defs>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span className="brand-text">Sapno Ka Ghar</span>
          </h2>
          <button className="mobile-logout-btn" onClick={handleLogout} title="Log Out">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
        <div className="sidebar-menu">
          <p className="menu-label">Main Menu</p>
          <div className={`menu-item ${activeTab === 'architecture' ? 'active' : ''}`} onClick={() => setActiveTab('architecture')}>
            <span style={{ marginLeft: '10px' }}>System Architecture</span>
          </div>
          <div className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <span style={{ marginLeft: '10px' }}>Dashboard</span>
          </div>

          {/* AI Companion Submenu */}
          <div className="submenu-container">
            <div className="submenu-header" onClick={() => toggleSubmenu('companion')}>
              <span className="submenu-header-text">🤖 AI Companion</span>
              <span className={`submenu-arrow ${expandedMenus.companion ? 'open' : ''}`}>▶</span>
            </div>
            {expandedMenus.companion && (
              <div className="submenu-items">
                <div className={`submenu-item ${activeTab === 'avatar_dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('avatar_dashboard')}>
                  <span>GrihaMitra AI Avatar</span>
                </div>
                <div className={`submenu-item ${activeTab === 'voice_dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('voice_dashboard')}>
                  <span>AI Voice Assistant</span>
                </div>
                <div className={`submenu-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => { setActiveTab('chat'); setUnreadChatCount(0); }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Home Chat
                    {unreadChatCount > 0 && (
                      <span style={{ background: '#FF3333', color: '#FFF', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold', boxShadow: '0 0 10px rgba(255,50,50,0.5)' }}>
                        {unreadChatCount}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* AI Intelligence Submenu */}
          <div className="submenu-container">
            <div className="submenu-header" onClick={() => toggleSubmenu('intelligence')}>
              <span className="submenu-header-text">🧠 AI Intelligence</span>
              <span className={`submenu-arrow ${expandedMenus.intelligence ? 'open' : ''}`}>▶</span>
            </div>
            {expandedMenus.intelligence && (
              <div className="submenu-items">
                <div className={`submenu-item ${activeTab === 'family_intel' ? 'active' : ''}`} onClick={() => setActiveTab('family_intel')}>
                  <span>Intelligence Profiles</span>
                </div>
                <div className={`submenu-item ${activeTab === 'automation' ? 'active' : ''}`} onClick={() => setActiveTab('automation')}>
                  <span>Predictive Automation</span>
                </div>
                <div className={`submenu-item ${activeTab === 'explainability' ? 'active' : ''}`} onClick={() => setActiveTab('explainability')}>
                  <span>Explainability Dashboard</span>
                </div>
              </div>
            )}
          </div>

          {/* Activity & Event Logs Submenu */}
          <div className="submenu-container">
            <div className="submenu-header" onClick={() => toggleSubmenu('logs')}>
              <span className="submenu-header-text">📊 Logs & History</span>
              <span className={`submenu-arrow ${expandedMenus.logs ? 'open' : ''}`}>▶</span>
            </div>
            {expandedMenus.logs && (
              <div className="submenu-items">
                <div className={`submenu-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
                  <span>Activity Log</span>
                </div>
                <div className={`submenu-item ${activeTab === 'event_history' ? 'active' : ''}`} onClick={() => setActiveTab('event_history')}>
                  <span>AI Event History</span>
                </div>
              </div>
            )}
          </div>

          {/* Manage Space Submenu */}
          <div className="submenu-container">
            <div className="submenu-header" onClick={() => toggleSubmenu('manage')}>
              <span className="submenu-header-text">⚙️ Manage Space</span>
              <span className={`submenu-arrow ${expandedMenus.manage ? 'open' : ''}`}>▶</span>
            </div>
            {expandedMenus.manage && (
              <div className="submenu-items">
                <div className={`submenu-item ${activeTab === 'members' ? 'active' : ''}`} onClick={() => { setActiveTab('members'); fetchFamilyMembers(); }}>
                  <span>Household Members</span>
                </div>
                {user.role === 'Owner' && (
                  <>
                    <div className={`submenu-item ${activeTab === 'join_requests' ? 'active' : ''}`} onClick={() => setActiveTab('join_requests')}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Join Requests
                        {pendingRequestsCount > 0 && (
                          <span style={{ background: '#44FF44', color: '#000', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold', boxShadow: '0 0 10px rgba(68,255,68,0.5)' }}>
                            {pendingRequestsCount}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={`submenu-item ${activeTab === 'add_room' ? 'active' : ''}`} onClick={() => setActiveTab('add_room')}>
                      <span>Set Up New Room</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          <p className="menu-label" style={{ marginTop: 'auto' }}>System</p>
          <div className="menu-item logout-menu-item" onClick={handleLogout}>
            <span style={{ marginLeft: '10px' }}>Log out</span>
          </div>
        </div>
      </div>

      {/* Main Layout Screen */}
      <div className="main-content">
        <header className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div className="user-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <h1 style={{ fontWeight: 600, letterSpacing: '-0.5px', margin: 0 }}>Welcome <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{user.email.split('@')[0]}</span></h1>
              <span style={{ 
                background: user.role === 'Owner' ? 'rgba(234, 235, 114, 0.15)' : 'rgba(100, 200, 255, 0.15)', 
                color: user.role === 'Owner' ? 'var(--accent-yellow)' : '#64C8FF', 
                padding: '4px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
                border: user.role === 'Owner' ? '1px solid rgba(234, 235, 114, 0.3)' : '1px solid rgba(100, 200, 255, 0.3)'
              }}>
                {user.role}
              </span>
            </div>
            {user.role === 'Owner' && (
              <div 
                onClick={() => setShowAccessCode(!showAccessCode)}
                title="Click to Reveal Code"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '6px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', width: 'max-content', marginTop: '12px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)', transition: '0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showAccessCode ? (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </>
                  ) : (
                    <>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </>
                  )}
                </svg>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600 }}>Access Code</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', letterSpacing: '2px', fontFamily: 'monospace', fontSize: '1.1rem', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '10px' }}>
                  {showAccessCode ? `${homeInfo.uniqueHomeName} - ${homeInfo.homeCode}` : '••••••••••••••••'}
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px', fontWeight: 600, whiteSpace: 'nowrap' }}>Room Temp</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', whiteSpace: 'nowrap' }}>
                <h2 style={{ color: 'var(--accent-yellow)', margin: 0, fontSize: '2.4rem', fontWeight: '800', lineHeight: '1', textShadow: '0 0 20px rgba(234, 235, 114, 0.4)' }}>{roomTemp !== null ? roomTemp.toFixed(1) : '--'}</h2>
                <span style={{ color: 'var(--accent-yellow)', fontSize: '1rem', fontWeight: 'bold', opacity: 0.8 }}>°C</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px', fontWeight: 600, whiteSpace: 'nowrap' }}>Live Power Draw</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', whiteSpace: 'nowrap' }}>
                <h2 style={{ color: 'var(--accent-yellow)', margin: 0, fontSize: '2.4rem', fontWeight: '800', lineHeight: '1', textShadow: '0 0 20px rgba(234, 235, 114, 0.4)' }}>{calculatePower()}</h2>
                <span style={{ color: 'var(--accent-yellow)', fontSize: '1rem', fontWeight: 'bold', opacity: 0.8 }}>W</span>
              </div>
            </div>

            <button 
              onClick={turnOffAll}
              style={{
                background: 'linear-gradient(135deg, rgba(200,30,30,0.15) 0%, rgba(150,0,0,0.2) 100%)',
                color: '#FF5555',
                fontWeight: '600',
                padding: '0.8rem 1.8rem',
                borderRadius: '12px',
                border: '1px solid rgba(255,68,68,0.3)',
                boxShadow: '0 8px 25px rgba(255,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,50,50,0.25) 0%, rgba(200,0,0,0.4) 100%)'; 
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(255,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)';
                e.currentTarget.style.color = '#FFF';
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200,30,30,0.15) 0%, rgba(150,0,0,0.2) 100%)'; 
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(255,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)';
                e.currentTarget.style.color = '#FF5555';
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                <line x1="12" y1="2" x2="12" y2="12"></line>
              </svg>
              SYSTEM OFF
            </button>
          </div>
        </header>

        {activeTab === 'architecture' && (
          <div className="fade-in" style={{ paddingBottom: '3rem' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem', background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' 
            }}>
              <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(234, 235, 114, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(234, 235, 114, 0.2)', fontSize: '1.4rem' }}>
                🏛️
              </div>
              <div>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.5px', margin: 0 }}>
                  System Architecture Dashboard
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Interactive integration topology of the smart home agentic core</p>
              </div>
            </div>

            {/* Architecture Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
              <div style={{ background: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ color: '#FFF', fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--accent-yellow)' }}>💻</span> React Web Application
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  Powers the responsive smart UI. Integrates WebSockets client for immediate state updates, WebRTC clients for direct peer-to-peer HeyGen virtual companion audio-video streaming, and live AMB82 smart camera relays.
                </p>
              </div>

              <div style={{ background: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ color: '#FFF', fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--accent-yellow)' }}>⚙️</span> Node.js API Backend
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  Central server routing REST endpoints and Socket.io events. Drives asynchronous processing by offloading voice reasoning jobs to BullMQ queues backed by Redis, and stores schemas in MongoDB Atlas.
                </p>
              </div>

              <div style={{ background: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ color: '#FFF', fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--accent-yellow)' }}>🧠</span> Central Agent Layer
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  Central cognitive orchestrator integrating 11 engines: Context Engine, Memory Engine, Routine Learning, Predictive Automation, Explainability, Polly speech, HeyGen avatar, and Proactive Decision schedulers.
                </p>
              </div>

              <div style={{ background: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ color: '#FFF', fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--accent-yellow)' }}>🌱</span> IoT & Hardware Gates
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  Manages physical ESP32 nodes via WebSockets/Socket.io, soil moisture and pump relay commands via Mosquitto MQTT broker, and live camera streaming via FFmpeg RTSP-to-WebRTC UDP socket transcoding.
                </p>
              </div>
            </div>

            {/* Stepper Cognitive Pipeline */}
            <div style={{ background: 'var(--bg-panel)', padding: '2.5rem', borderRadius: '24px', border: '1px solid var(--border-subtle)', marginBottom: '3rem' }}>
              <h4 style={{ color: '#FFF', fontSize: '1.3rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>⚡</span> Decoupled Cognitive Process Stepper (Asynchronous Pipeline)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', position: 'relative' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold', margin: '0 auto 1rem auto' }}>1</div>
                  <h5 style={{ color: '#FFF', fontSize: '0.95rem', marginBottom: '6px' }}>Speech Capturing</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.4' }}>Client records and transmits base64 audio stream</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold', margin: '0 auto 1rem auto' }}>2</div>
                  <h5 style={{ color: '#FFF', fontSize: '0.95rem', marginBottom: '6px' }}>Whisper STT</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.4' }}>FastAPI model transcribes speech with language classification</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold', margin: '0 auto 1rem auto' }}>3</div>
                  <h5 style={{ color: '#FFF', fontSize: '0.95rem', marginBottom: '6px' }}>Bedrock Converse</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.4' }}>Processes context/memory, determines intent, returns action plan</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold', margin: '0 auto 1rem auto' }}>4</div>
                  <h5 style={{ color: '#FFF', fontSize: '0.95rem', marginBottom: '6px' }}>IoT Actuation</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.4' }}>Socket.io relays commands instantly to ESP32 switches</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold', margin: '0 auto 1rem auto' }}>5</div>
                  <h5 style={{ color: '#FFF', fontSize: '0.95rem', marginBottom: '6px' }}>Polly & HeyGen</h5>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.4' }}>Synthesizes voice speech and updates video streams via WebRTC</p>
                </div>
              </div>
            </div>

            {/* AI Cost Topology Cards */}
            <div style={{ background: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ color: '#FFF', fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💰</span> Cloud AI Cost Telemetry Rates
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1.2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Amazon Bedrock (Nova Lite)</span>
                  <div style={{ color: '#FFF', fontWeight: 'bold', marginTop: '4px', fontSize: '1.05rem' }}>$0.06 / 1M Input Tokens</div>
                  <div style={{ color: '#FFF', fontWeight: 'bold', fontSize: '1.05rem' }}>$0.24 / 1M Output Tokens</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1.2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Amazon Bedrock (Nova Pro)</span>
                  <div style={{ color: '#FFF', fontWeight: 'bold', marginTop: '4px', fontSize: '1.05rem' }}>$0.80 / 1M Input Tokens</div>
                  <div style={{ color: '#FFF', fontWeight: 'bold', fontSize: '1.05rem' }}>$3.20 / 1M Output Tokens</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1.2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Amazon Polly Neural Voice</span>
                  <div style={{ color: '#FFF', fontWeight: 'bold', marginTop: '4px', fontSize: '1.05rem' }}>$16.00 / 1M Characters</div>
                  <div style={{ color: '#FFF', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--accent-yellow)', marginTop: '4px' }}>Local Audio Caching active</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="fade-in">
            {mainDevices.length > 0 && (
              <div style={{ marginBottom: '3rem' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 600, letterSpacing: '0.3px' }}>Main Heavy Appliances</h3>
                <div className="devices-grid">
                  {mainDevices.map(device => (
                    <DeviceIcon 
                      key={device._id} 
                      device={device} 
                      onToggle={() => toggleDevice(device.roomId, device._id, device.isOn)} 
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 600, letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Rooms <span style={{ background: 'var(--bg-panel)', padding: '2px 10px', borderRadius: '12px', fontSize: '0.9rem', color: 'var(--accent-yellow)', border: '1px solid var(--border-subtle)' }}>{homeInfo?.rooms?.length || 0}</span>
              </h3>
              <div className="rooms-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '2rem' }}>
                {homeInfo?.rooms.map(room => {
                  const activeCount = room.devices.filter(d => d.isOn).length;
                  return (
                    <div 
                      key={room._id} 
                      className="room-card"
                      onClick={() => { setCurrentRoomId(room._id); setActiveTab('room_view'); }}
                      style={{ 
                        borderRadius: '20px', overflow: 'hidden', cursor: 'pointer', position: 'relative', height: '220px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-6px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0px)'}
                    >
                      <img 
                        src={getRoomImage(room.name)} 
                        alt={room.name} 
                        onError={(e) => e.target.src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&q=80'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75, transition: 'opacity 0.3s' }} 
                        onMouseEnter={(e) => e.target.style.opacity = 0.9}
                        onMouseLeave={(e) => e.target.style.opacity = 0.75}
                      />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '25px 20px', background: 'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0))' }}>
                        <h3 style={{ color: '#FFF', fontSize: '1.5rem', marginBottom: '8px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{room.name}</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#AAA', fontSize: '0.90rem', fontWeight: 500 }}>{room.devices.length} Connected Devices</span>
                          {activeCount > 0 && (
                            <span style={{ background: 'var(--accent-yellow)', color: '#000', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 0 10px rgba(234, 235, 114, 0.4)' }}>
                              {activeCount} Active
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'room_view' && activeRoom && (
          <div className="fade-in">
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span 
                onClick={() => setActiveTab('dashboard')} 
                style={{ cursor: 'pointer', color: 'var(--accent-yellow)', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', padding: '5px 12px', borderRadius: '8px' }}
              >
                ← Back
              </span> 
              {activeRoom.name}
            </h3>
            
            <div className="devices-grid">
              {activeRoom.devices.map(device => (
                <DeviceIcon 
                  key={device._id} 
                  device={device} 
                  onToggle={() => toggleDevice(activeRoom._id, device._id, device.isOn)} 
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'members' && (() => {
          const activeUserIds = new Set([
            String(homeInfo?.owner?._id),
            ...(homeInfo?.members || []).filter(m => m.status === 'approved' && m.user).map(m => String(m.user._id || m.user))
          ]);
          const activeUserNames = new Set([
            homeInfo?.owner?.name?.toLowerCase(),
            ...(homeInfo?.members || []).filter(m => m.status === 'approved' && m.user).map(m => m.user.name?.toLowerCase())
          ].filter(Boolean));

          const offlineMembers = familyMembers.filter(f => {
            if (f.user) {
              const uid = typeof f.user === 'object' ? String(f.user._id) : String(f.user);
              return !activeUserIds.has(uid);
            }
            if (f.name) {
              const cleanName = f.name.toLowerCase().replace(/\s*\(\d+\)/g, '');
              return !activeUserNames.has(cleanName);
            }
            return true;
          });

          return (
            <div className="fade-in">
              <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 600, letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Active Household Members <span style={{ background: 'var(--bg-panel)', padding: '2px 10px', borderRadius: '12px', fontSize: '0.9rem', color: 'var(--accent-yellow)', border: '1px solid var(--border-subtle)' }}>{activeMembers.length + 1}</span>
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* Home Creator (Owner) Card */}
                {(() => {
                  const ownerId = homeInfo?.owner?._id || user.id || user._id;
                  const ownerProfile = familyMembers.find(f => f.user === ownerId || (f.user && f.user._id === ownerId) || (f.name && f.name.toLowerCase() === homeInfo?.owner?.name?.toLowerCase()));
                  return (
                    <div style={{ 
                      display: 'flex', flexDirection: 'column', gap: '15px',
                      background: 'linear-gradient(135deg, rgba(234, 235, 114, 0.05) 0%, rgba(0,0,0,0.5) 100%)', 
                      padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(234, 235, 114, 0.2)', boxShadow: '0 4px 15px rgba(0,0,0,0.4)', transition: 'transform 0.3s' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ 
                          width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.2)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent-yellow)', fontSize: '1.5rem'
                        }}>
                          {ownerProfile?.avatarImage || (homeInfo?.owner?.name ? homeInfo.owner.name.charAt(0).toUpperCase() : '?')}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.15rem' }}>
                            {homeInfo?.owner?.name || 'Home Creator'} 
                            {String(user.id || user._id) === String(homeInfo?.owner?._id) && <span style={{fontSize: '0.8rem', opacity: 0.5}}> (You)</span>}
                          </span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{homeInfo?.owner?.email}</span>
                          <span style={{ color: 'var(--accent-yellow)', fontSize: '0.75rem', marginTop: '4px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                            🌟 Home Creator
                          </span>
                        </div>
                      </div>

                      {ownerProfile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>📅 Routine: <strong style={{ color: '#FFF' }}>{ownerProfile.routineProfile}</strong></span>
                            <span style={{ color: 'var(--text-secondary)' }}>🗣️ Voice: <strong style={{ color: '#FFF' }}>{ownerProfile.voiceProfile}</strong></span>
                            <span style={{ color: 'var(--text-secondary)' }}>🌐 Lang: <strong style={{ color: '#FFF' }}>{ownerProfile.preferredLanguage}</strong></span>
                            <span style={{ color: 'var(--text-secondary)' }}>🌡️ Temp Pref: <strong style={{ color: '#FFF' }}>{ownerProfile.preferences?.tempPreference}°C</strong></span>
                            <span style={{ color: 'var(--text-secondary)' }}>💡 Lights: <strong style={{ color: '#FFF' }}>{ownerProfile.preferences?.lightingStyle}</strong></span>
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleEditMemberClick(ownerProfile); }}
                              style={{ flex: 1, background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', border: '1px solid rgba(234, 235, 114, 0.2)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                            >
                              Edit AI Profile
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteMember(ownerProfile._id); }}
                              style={{ flex: 1, background: 'rgba(255,50,50,0.1)', color: '#FF5555', border: '1px solid rgba(255,50,50,0.2)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                            >
                              Delete Profile
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>No AI Profile configured. Enrolling your profile enables personalized smart home automation recommendations.</span>
                          <button 
                            onClick={() => {
                              setProfileModal({
                                isOpen: true,
                                type: 'setup_ai',
                                userId: ownerId,
                                memberId: null,
                                name: homeInfo?.owner?.name || user.name || 'Owner',
                                role: 'Father',
                                age: '',
                                preferredLanguage: 'English',
                                voiceProfile: 'Aditi',
                                routineProfile: 'Office Routine',
                                preferences: {
                                  tempPreference: 24,
                                  lightingStyle: 'Warm White',
                                  extraNotes: ''
                                }
                              });
                            }}
                            style={{ width: '100%', background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', border: '1px solid rgba(234, 235, 114, 0.2)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                          >
                            + Setup AI Profile
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Approved Members Card Loop */}
                {activeMembers.filter(m => m.user).map(m => {
                  const isExpanded = expandedMemberDetails?.user?._id === m.user._id;
                  const profile = familyMembers.find(f => f.user === m.user._id || (f.user && f.user._id === m.user._id) || (f.name && f.name.toLowerCase().replace(/\s*\(\d+\)/g, '') === m.user.name?.toLowerCase()));

                  return (
                    <div key={m.user._id} 
                      onClick={() => {
                        if (!isExpanded) {
                          setExpandedMemberDetails(m);
                          setTempAccessibleRooms(m.roomAccessConfigured ? (m.accessibleRooms || []) : (homeInfo?.rooms || []).map(r => r._id));
                          
                          const prof = familyMembers.find(f => f.user === m.user._id || (f.user && f.user._id === m.user._id) || (f.name && f.name.toLowerCase().replace(/\s*\(\d+\)/g, '') === m.user.name?.toLowerCase()));
                          if (prof) {
                            fetchMemberContext(prof._id);
                          }
                        }
                      }}
                      style={{ 
                        display: 'flex', flexDirection: 'column', gap: '15px',
                        background: 'var(--bg-panel)', padding: isExpanded ? '1.5rem' : '1.2rem', 
                        borderRadius: '16px', 
                        border: isExpanded ? '1px solid var(--accent-yellow)' : '1px solid var(--border-subtle)', 
                        boxShadow: isExpanded ? '0 10px 30px rgba(0,0,0,0.4)' : '0 4px 15px rgba(0,0,0,0.2)', 
                        cursor: isExpanded ? 'default' : 'pointer', transition: 'all 0.3s',
                        gridColumn: isExpanded ? '1 / -1' : 'auto'
                      }}
                      onMouseEnter={(e) => { if(!isExpanded) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; } }}
                      onMouseLeave={(e) => { if(!isExpanded) { e.currentTarget.style.transform = 'translateY(0px)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; } }}
                    >
                      {!isExpanded ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ 
                              width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.1)', 
                              display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(234, 235, 114, 0.3)', fontSize: '1.4rem'
                            }}>
                              {profile?.avatarImage || (m.user?.name ? m.user.name.charAt(0).toUpperCase() : '?')}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>{m.user?.name || 'Unknown User'}</span>
                              <span style={{ color: m.role === 'admin' ? 'var(--accent-yellow)' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
                                {m.role === 'admin' ? 'Admin' : 'Member'} {profile ? `• AI: ${profile.role}` : ''}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {!profile && <span style={{ background: 'rgba(255,100,100,0.1)', color: '#FF7777', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>No AI Profile</span>}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', transition: 'all 0.2s', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>↓</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="fade-in" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                              <div style={{ 
                                width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.1)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(234, 235, 114, 0.3)', fontSize: '1.8rem'
                              }}>
                                {profile?.avatarImage || (m.user?.name ? m.user.name.charAt(0).toUpperCase() : '?')}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h2 style={{ color: '#FFF', margin: '0 0 4px 0', fontSize: '1.4rem' }}>{m.user?.name || 'Unknown User'}</h2>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{m.user?.email}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                                  <span style={{ color: '#44FF44', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(68,255,68,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#44FF44', boxShadow: '0 0 5px #44FF44' }} /> Active 
                                  </span>
                                  <span style={{ color: m.role === 'admin' ? '#000' : 'var(--text-secondary)', background: m.role === 'admin' ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {m.role === 'admin' ? 'House Admin' : 'Standard Member'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setExpandedMemberDetails(null); }} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '1.2rem', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#FFF'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888'; }} title="Close Details">✕</button>
                          </div>

                          {user.role === 'Owner' && (
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', alignItems: 'center' }}>
                              {m.role === 'admin' ? (
                                <button onClick={(e) => { e.stopPropagation(); handleDemote(m.user._id); setExpandedMemberDetails(null); }} style={{ width: 'max-content', padding: '0.6rem 1.4rem', background: 'rgba(255,150,50,0.1)', color: '#FFAA33', border: '1px solid rgba(255,150,50,0.3)', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => { e.currentTarget.style.background = '#FFAA33'; e.currentTarget.style.color = '#000'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,150,50,0.1)'; e.currentTarget.style.color = '#FFAA33'; }}>
                                  <span style={{ fontSize: '1.1rem', margin: '-2px 0 0 0' }}>↓</span> Demote
                                </button>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); handlePromote(m.user._id); setExpandedMemberDetails(null); }} style={{ width: 'max-content', padding: '0.6rem 1.4rem', background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', border: '1px solid rgba(234, 235, 114, 0.3)', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-yellow)'; e.currentTarget.style.color = '#000'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(234, 235, 114, 0.1)'; e.currentTarget.style.color = 'var(--accent-yellow)'; }}>
                                  <span style={{ fontSize: '1.1rem', margin: '-2px 0 0 0' }}>↑</span> Promote to Admin
                                </button>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); handleReject(m.user._id); setExpandedMemberDetails(null); }} style={{ width: 'max-content', padding: '0.6rem 1.4rem', background: 'rgba(255,50,50,0.1)', color: '#FF5555', border: '1px solid rgba(255,50,50,0.3)', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#FF4444'; e.currentTarget.style.color = '#FFF'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,50,50,0.1)'; e.currentTarget.style.color = '#FF5555'; }}>
                                <span style={{ fontSize: '1rem', margin: '-2px 0 0 0' }}>⊘</span> Suspend Access
                              </button>
                            </div>
                          )}

                          {/* AI Profile Section (Phase 2 - Context Engine Integration) */}
                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                            <h4 style={{ color: '#FFF', fontSize: '1.05rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              🧠 AI Context Profile
                            </h4>
                            
                            {!profile ? (
                              <div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 12px 0' }}>This member has no AI comfort profile configured.</p>
                                {user.role === 'Owner' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProfileModal({
                                        isOpen: true,
                                        type: 'setup_ai',
                                        userId: m.user._id,
                                        memberId: null,
                                        name: m.user.name || m.user.email.split('@')[0],
                                        role: 'Father',
                                        age: '',
                                        preferredLanguage: 'English',
                                        voiceProfile: 'Aditi',
                                        routineProfile: 'Office Routine',
                                        preferences: {
                                          tempPreference: 24,
                                          lightingStyle: 'Warm White',
                                          extraNotes: ''
                                        }
                                      });
                                    }}
                                    style={{ background: 'rgba(234, 235, 114, 0.15)', color: 'var(--accent-yellow)', border: '1px solid rgba(234, 235, 114, 0.3)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                                  >
                                    + Setup AI Profile
                                  </button>
                                )}
                              </div>
                            ) : selectedMemberContext ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                                {/* AI Learning/Predictive Status Banner */}
                                <div style={{ 
                                  background: selectedMemberContext.aiMode === 'Predictive' 
                                    ? 'linear-gradient(135deg, rgba(68,255,68,0.08) 0%, rgba(0,0,0,0.4) 100%)' 
                                    : 'linear-gradient(135deg, rgba(100,200,255,0.08) 0%, rgba(0,0,0,0.4) 100%)',
                                  border: selectedMemberContext.aiMode === 'Predictive'
                                    ? '1px solid rgba(68,255,68,0.25)'
                                    : '1px solid rgba(100,200,255,0.25)',
                                  padding: '1.2rem',
                                  borderRadius: '12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ 
                                      fontWeight: 800, 
                                      color: selectedMemberContext.aiMode === 'Predictive' ? '#44FF44' : '#64C8FF',
                                      textTransform: 'uppercase',
                                      fontSize: '0.85rem',
                                      letterSpacing: '1px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}>
                                      {selectedMemberContext.aiMode === 'Predictive' ? '🤖 Predictive Mode Active' : '🧠 AI Learning Mode'}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#888' }}>
                                      Timeline Started: {selectedMemberContext.learningStartedAt ? new Date(selectedMemberContext.learningStartedAt).toLocaleDateString() : 'Just Now'}
                                    </span>
                                  </div>
                                  
                                  {selectedMemberContext.aiMode === 'Learning' ? (
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#BBB', marginBottom: '4px' }}>
                                        <span>Analyzing family behavior logs...</span>
                                        <span>Day {selectedMemberContext.daysElapsed || 0} of 10</span>
                                      </div>
                                      {/* Progress Bar */}
                                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.min(100, ((selectedMemberContext.daysElapsed || 0) / 10) * 100)}%`, height: '100%', background: '#64C8FF', borderRadius: '4px' }}></div>
                                      </div>
                                      <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                                        AI is compiling comfort baseline preferences. Full automatic rules and routine predictions will activate in {selectedMemberContext.nextModificationInDays || 10} days.
                                      </p>
                                    </div>
                                  ) : (
                                    <div>
                                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#EEE' }}>
                                        Comfort rules and active hour ranges are dynamically updated by the AI context engine.
                                      </p>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                                          Next auto-evaluation check in {selectedMemberContext.nextModificationInDays || 10} days.
                                        </span>
                                        <button 
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                              const token = localStorage.getItem('token');
                                              const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/context/profile/${selectedMemberContext._id}?forceEvaluate=true`, {
                                                headers: { 'Authorization': `Bearer ${token}` }
                                              });
                                              if (res.ok) {
                                                const data = await res.json();
                                                setSelectedMemberContext(data);
                                                alert('AI Evaluation executed! Analyzed history logs and updated preferences.');
                                                fetchFamilyMembers();
                                              } else {
                                                alert('Failed to run manual evaluation.');
                                              }
                                            } catch (err) {
                                              console.error(err);
                                            }
                                          }}
                                          style={{ 
                                            background: 'rgba(68,255,68,0.15)', 
                                            color: '#44FF44', 
                                            border: '1px solid rgba(68,255,68,0.3)', 
                                            padding: '4px 12px', 
                                            borderRadius: '6px', 
                                            fontSize: '0.75rem', 
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'all 0.2s'
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(68,255,68,0.3)'}
                                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(68,255,68,0.15)'}
                                        >
                                          ⚡ Force AI Re-Evaluation
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Insights Row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Visited Room</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--accent-yellow)', marginTop: '4px' }}>🏠 {selectedMemberContext.mostVisitedRoom || 'None'}</div>
                                  </div>
                                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Most Used Device</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#64C8FF', marginTop: '4px' }}>🔌 {selectedMemberContext.mostUsedDevice || 'None'}</div>
                                  </div>
                                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Peak Activity Time</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#FFAA33', marginTop: '4px' }}>🕒 {selectedMemberContext.mostActiveTime || 'None'}</div>
                                  </div>
                                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Habit Schedule</div>
                                    <div style={{ fontSize: '0.8rem', color: '#AAA', marginTop: '4px', lineHeight: '1.3' }}>{selectedMemberContext.dailyActivityPatterns || 'No pattern logged.'}</div>
                                  </div>
                                </div>

                                {/* Frequency Tags */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                                  <div>
                                    <h5 style={{ color: '#FFF', margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Frequently Visited Rooms</h5>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {selectedMemberContext.frequentlyUsedRooms && selectedMemberContext.frequentlyUsedRooms.length > 0 ? (
                                        selectedMemberContext.frequentlyUsedRooms.map((r, idx) => (
                                          <span key={idx} style={{ background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(234, 235, 114, 0.2)', fontWeight: 500 }}>{r}</span>
                                        ))
                                      ) : (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Gathering telemetry logs...</span>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <h5 style={{ color: '#FFF', margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Most Interacted Devices</h5>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {selectedMemberContext.frequentlyUsedDevices && selectedMemberContext.frequentlyUsedDevices.length > 0 ? (
                                        selectedMemberContext.frequentlyUsedDevices.map((d, idx) => (
                                          <span key={idx} style={{ background: 'rgba(100, 200, 255, 0.1)', color: '#64C8FF', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(100, 200, 255, 0.2)', fontWeight: 500 }}>{d}</span>
                                        ))
                                      ) : (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Gathering telemetry logs...</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Personalized Summary */}
                                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.2rem' }}>
                                  <h5 style={{ color: '#FFF', margin: '0 0 8px 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                    ✨ GrihaMitra AI Habit Summary
                                  </h5>
                                  {selectedMemberSummaryLoading ? (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Analyzing routine behavior timeline...</div>
                                  ) : (
                                    <p style={{ color: '#E0E0E0', fontSize: '0.85rem', margin: 0, lineHeight: '1.45', fontStyle: 'italic' }}>
                                      "{selectedMemberSummary || 'Establishing baseline routines. Complete more device actions to generate AI context summaries.'}"
                                    </p>
                                  )}
                                </div>

                                {/* AI Auto-Modification Logs */}
                                {selectedMemberContext.aiEvaluationLogs && selectedMemberContext.aiEvaluationLogs.length > 0 && (
                                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.2rem' }}>
                                    <h5 style={{ color: '#FFF', margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      📋 AI Auto-Modification Logs ({selectedMemberContext.aiEvaluationLogs.length})
                                    </h5>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '5px' }}>
                                      {selectedMemberContext.aiEvaluationLogs.slice().reverse().map((log, idx) => (
                                        <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                            <span>{new Date(log.evaluatedAt).toLocaleString()}</span>
                                            <span style={{ color: 'var(--accent-yellow)', fontWeight: 600 }}>{log.modeAtEvaluation} Mode</span>
                                          </div>
                                          <p style={{ color: '#DDD', fontSize: '0.8rem', margin: '0 0 6px 0', lineHeight: '1.3' }}>{log.summary}</p>
                                          {log.changesMade && log.changesMade.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                              {log.changesMade.map((change, cIdx) => (
                                                <span key={cIdx} style={{ background: 'rgba(234, 235, 114, 0.15)', color: 'var(--accent-yellow)', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(234, 235, 114, 0.1)' }}>{change}</span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Inline Preferences Form */}
                                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '1.25rem' }}>
                                  <h5 style={{ color: '#FFF', margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 600 }}>⚙️ Personalization & Comfort Settings</h5>
                                  <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    try {
                                      const token = localStorage.getItem('token');
                                      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/context/profile/${selectedMemberContext._id}`, {
                                        method: 'PUT',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'Authorization': `Bearer ${token}`
                                        },
                                        body: JSON.stringify({
                                          preferredLanguage: selectedMemberContext.preferredLanguage,
                                          voiceProfile: selectedMemberContext.voiceProfile,
                                          activeHours: selectedMemberContext.activeHours,
                                          preferences: selectedMemberContext.preferences
                                        })
                                      });
                                      if (res.ok) {
                                        alert('AI Context personalization updated successfully!');
                                        fetchFamilyMembers();
                                      } else {
                                        const errData = await res.json();
                                        alert(errData.error || 'Failed to update preferences');
                                      }
                                    } catch (err) {
                                      console.error(err);
                                    }
                                  }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Active Hours Range</label>
                                      <input 
                                        type="text" 
                                        value={selectedMemberContext.activeHours || ''} 
                                        onChange={e => setSelectedMemberContext(prev => ({ ...prev, activeHours: e.target.value }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', outline: 'none' }} 
                                        placeholder="e.g. 7 PM - 11 PM"
                                      />
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Language Interface</label>
                                      <select 
                                        value={selectedMemberContext.preferredLanguage || 'English'} 
                                        onChange={e => setSelectedMemberContext(prev => ({ ...prev, preferredLanguage: e.target.value }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                                      >
                                        <option value="English">English</option>
                                        <option value="Hindi">Hindi (हिंदी)</option>
                                        <option value="Marathi">Marathi (मराठी)</option>
                                        <option value="Spanish">Spanish</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Voice Output Profile</label>
                                      <select 
                                        value={selectedMemberContext.voiceProfile || 'Aditi'} 
                                        onChange={e => setSelectedMemberContext(prev => ({ ...prev, voiceProfile: e.target.value }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                                      >
                                        <option value="Aditi">Aditi (Hindi/English)</option>
                                        <option value="Raveena">Raveena (Indian English)</option>
                                        <option value="Kajal">Kajal (Bilingual)</option>
                                        <option value="Matthew">Matthew (US English)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Climate Comfort (°C)</label>
                                      <input 
                                        type="number" 
                                        value={selectedMemberContext.preferences?.tempPreference || 24} 
                                        onChange={e => setSelectedMemberContext(prev => ({ ...prev, preferences: { ...prev.preferences, tempPreference: parseInt(e.target.value) || 24 } }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', outline: 'none' }} 
                                        min="16" max="30"
                                      />
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Illumination Mode</label>
                                      <select 
                                        value={selectedMemberContext.preferences?.lightingStyle || 'Warm White'} 
                                        onChange={e => setSelectedMemberContext(prev => ({ ...prev, preferences: { ...prev.preferences, lightingStyle: e.target.value } }))}
                                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                                      >
                                        <option value="Warm White">Warm White</option>
                                        <option value="Cool Focus">Cool Focus</option>
                                        <option value="Ambient Sunset">Ambient Sunset</option>
                                        <option value="Eco Dim">Eco Dim</option>
                                      </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                      <button type="submit" style={{ width: '100%', background: 'var(--accent-yellow)', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.9} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
                                        Save Comfort Rules
                                      </button>
                                    </div>
                                  </form>
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>Syncing telemetry context...</div>
                            )}
                          </div>

                          {user.role === 'Owner' && m.role !== 'admin' && (
                            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                              <h4 style={{ color: '#FFF', fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                Physical Room Limitations
                                <span style={{ fontSize: '0.8rem', color: 'var(--accent-yellow)', background: 'rgba(234, 235, 114, 0.15)', padding: '2px 8px', borderRadius: '8px', border: '1px solid rgba(234, 235, 114, 0.3)' }}>{tempAccessibleRooms.length} Enforced</span>
                              </h4>
                              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.2rem', lineHeight: '1.4' }}>Select which physical rooms this member is allowed to explicitly interact with and view.</p>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '1.5rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
                                {homeInfo?.rooms?.map(room => (
                                  <label key={room._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                                    <input 
                                      type="checkbox" 
                                      checked={tempAccessibleRooms.includes(room._id)}
                                      onChange={(e) => {
                                        if(e.target.checked) setTempAccessibleRooms(prev => [...prev, room._id]);
                                        else setTempAccessibleRooms(prev => prev.filter(id => id !== room._id));
                                      }}
                                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent-yellow)', cursor: 'pointer' }}
                                    />
                                    <span style={{ color: '#FFF', fontSize: '0.95rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.name}</span>
                                  </label>
                                ))}
                              </div>
                              
                              <button onClick={(e) => { e.stopPropagation(); handleSaveMemberRooms(m.user._id); }} style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent-yellow) 0%, #D4D540 100%)', color: '#000', border: 'none', padding: '0.8rem', borderRadius: '8px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(234, 235, 114, 0.2)', transition: 'transform 0.2s', letterSpacing: '0.5px', textTransform: 'uppercase' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                Commit Changes
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Offline Family Members Section */}
              <div style={{ marginTop: '4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 600, letterSpacing: '0.3px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    👵 Offline Family Members <span style={{ background: 'var(--bg-panel)', padding: '2px 10px', borderRadius: '12px', fontSize: '0.95rem', color: 'var(--accent-yellow)', border: '1px solid var(--border-subtle)' }}>{offlineMembers.length}</span>
                  </h3>
                  {user.role === 'Owner' && (
                    <button
                      onClick={() => {
                        setProfileModal({
                          isOpen: true,
                          type: 'create_offline',
                          userId: null,
                          memberId: null,
                          name: '',
                          role: 'Father',
                          age: '',
                          preferredLanguage: 'English',
                          voiceProfile: 'Aditi',
                          routineProfile: 'Office Routine',
                          preferences: { tempPreference: 24, lightingStyle: 'Warm White', extraNotes: '' }
                        });
                      }}
                      style={{
                        background: 'linear-gradient(135deg, var(--accent-yellow) 0%, #D4D540 100%)',
                        color: '#000',
                        border: 'none',
                        padding: '0.7rem 1.5rem',
                        borderRadius: '12px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(234, 235, 114, 0.2)',
                        transition: 'all 0.2s',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      + Add Offline Profile
                    </button>
                  )}
                </div>

                {offlineMembers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-panel)', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', margin: '0 0 1rem 0' }}>No offline family profiles registered yet.</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto' }}>
                      Enrolling offline members (like Grandmother or kids) allows the AI assistant "GrihaMitra" to learn habits and predict their routines.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {offlineMembers.map(member => {
                      const isOfflineExpanded = expandedMemberDetails?._id === member._id;
                      return (
                        <div 
                          key={member._id}
                          onClick={() => {
                            if (!isOfflineExpanded) {
                              setExpandedMemberDetails(member);
                              fetchMemberContext(member._id);
                            }
                          }}
                          style={{
                            background: 'var(--bg-panel)', 
                            border: isOfflineExpanded ? '1px solid var(--accent-yellow)' : '1px solid var(--border-subtle)', 
                            borderRadius: '20px', 
                            padding: isOfflineExpanded ? '1.8rem' : '1.5rem',
                            boxShadow: isOfflineExpanded ? '0 10px 30px rgba(0,0,0,0.4)' : '0 8px 30px rgba(0,0,0,0.3)', 
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '15px',
                            cursor: isOfflineExpanded ? 'default' : 'pointer',
                            gridColumn: isOfflineExpanded ? '1 / -1' : 'auto'
                          }}
                          onMouseEnter={e => { if(!isOfflineExpanded) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; } }}
                          onMouseLeave={e => { if(!isOfflineExpanded) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; } }}
                        >
                          {!isOfflineExpanded ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                  <div style={{
                                    width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(234,235,114,0.3)', fontSize: '1.6rem'
                                  }}>
                                    {member.avatarImage || '👤'}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: '#FFF', fontWeight: 'bold', fontSize: '1.25rem' }}>{member.name}</span>
                                    <span style={{ color: 'var(--accent-yellow)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: '2px' }}>
                                      {member.role} ({member.age || 'N/A'} yrs)
                                    </span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', transition: 'all 0.2s', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>↓</span>
                                </div>
                              </div>

                              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>📅 Routine: <strong style={{ color: '#FFF' }}>{member.routineProfile}</strong></span>
                                <span style={{ color: 'var(--text-secondary)' }}>🗣️ Voice: <strong style={{ color: '#FFF' }}>{member.voiceProfile}</strong></span>
                                <span style={{ color: 'var(--text-secondary)' }}>🌐 Lang: <strong style={{ color: '#FFF' }}>{member.preferredLanguage}</strong></span>
                              </div>

                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                <div style={{ fontWeight: 600, color: '#FFF', marginBottom: '5px' }}>Comfort Parameters:</div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  <span style={{ background: 'rgba(100, 200, 255, 0.08)', color: '#64C8FF', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>🌡️ {member.preferences?.tempPreference}°C Preference</span>
                                  <span style={{ background: 'rgba(255, 150, 50, 0.08)', color: '#FFAA33', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>💡 {member.preferences?.lightingStyle}</span>
                                </div>
                                {member.preferences?.extraNotes && (
                                  <div style={{ fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                                    "{member.preferences.extraNotes}"
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="fade-in" style={{ width: '100%' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                  <div style={{
                                    width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(234,235,114,0.3)', fontSize: '1.8rem'
                                  }}>
                                    {member.avatarImage || '👤'}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h2 style={{ color: '#FFF', margin: '0 0 4px 0', fontSize: '1.4rem' }}>{member.name}</h2>
                                    <span style={{ color: 'var(--accent-yellow)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                      👵 Offline {member.role} ({member.age || 'N/A'} yrs)
                                    </span>
                                  </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setExpandedMemberDetails(null); }} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '1.2rem', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#FFF'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888'; }} title="Close Details">✕</button>
                              </div>

                              {/* AI Profile Section (Phase 2 - Context Engine Integration) */}
                              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                                <h4 style={{ color: '#FFF', fontSize: '1.05rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  🧠 AI Context Profile
                                </h4>

                                {selectedMemberContext ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                                    {/* AI Learning/Predictive Status Banner */}
                                    <div style={{ 
                                      background: selectedMemberContext.aiMode === 'Predictive' 
                                        ? 'linear-gradient(135deg, rgba(68,255,68,0.08) 0%, rgba(0,0,0,0.4) 100%)' 
                                        : 'linear-gradient(135deg, rgba(100,200,255,0.08) 0%, rgba(0,0,0,0.4) 100%)',
                                      border: selectedMemberContext.aiMode === 'Predictive'
                                        ? '1px solid rgba(68,255,68,0.25)'
                                        : '1px solid rgba(100,200,255,0.25)',
                                      padding: '1.2rem',
                                      borderRadius: '12px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px',
                                      boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ 
                                          fontWeight: 800, 
                                          color: selectedMemberContext.aiMode === 'Predictive' ? '#44FF44' : '#64C8FF',
                                          textTransform: 'uppercase',
                                          fontSize: '0.85rem',
                                          letterSpacing: '1px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px'
                                        }}>
                                          {selectedMemberContext.aiMode === 'Predictive' ? '🤖 Predictive Mode Active' : '🧠 AI Learning Mode'}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: '#888' }}>
                                          Timeline Started: {selectedMemberContext.learningStartedAt ? new Date(selectedMemberContext.learningStartedAt).toLocaleDateString() : 'Just Now'}
                                        </span>
                                      </div>
                                      
                                      {selectedMemberContext.aiMode === 'Learning' ? (
                                        <div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#BBB', marginBottom: '4px' }}>
                                            <span>Analyzing family behavior logs...</span>
                                            <span>Day {selectedMemberContext.daysElapsed || 0} of 10</span>
                                          </div>
                                          {/* Progress Bar */}
                                          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(100, ((selectedMemberContext.daysElapsed || 0) / 10) * 100)}%`, height: '100%', background: '#64C8FF', borderRadius: '4px' }}></div>
                                          </div>
                                          <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                                            AI is compiling comfort baseline preferences. Full automatic rules and routine predictions will activate in {selectedMemberContext.nextModificationInDays || 10} days.
                                          </p>
                                        </div>
                                      ) : (
                                        <div>
                                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#EEE' }}>
                                            Comfort rules and active hour ranges are dynamically updated by the AI context engine.
                                          </p>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '10px' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#888', fontStyle: 'italic' }}>
                                              Next auto-evaluation check in {selectedMemberContext.nextModificationInDays || 10} days.
                                            </span>
                                            <button 
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  const token = localStorage.getItem('token');
                                                  const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/context/profile/${selectedMemberContext._id}?forceEvaluate=true`, {
                                                    headers: { 'Authorization': `Bearer ${token}` }
                                                  });
                                                  if (res.ok) {
                                                    const data = await res.json();
                                                    setSelectedMemberContext(data);
                                                    alert('AI Evaluation executed! Analyzed history logs and updated preferences.');
                                                    fetchFamilyMembers();
                                                  } else {
                                                    alert('Failed to run manual evaluation.');
                                                  }
                                                } catch (err) {
                                                  console.error(err);
                                                }
                                              }}
                                              style={{ 
                                                background: 'rgba(68,255,68,0.15)', 
                                                color: '#44FF44', 
                                                border: '1px solid rgba(68,255,68,0.3)', 
                                                padding: '4px 12px', 
                                                borderRadius: '6px', 
                                                fontSize: '0.75rem', 
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                transition: 'all 0.2s'
                                              }}
                                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(68,255,68,0.3)'}
                                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(68,255,68,0.15)'}
                                            >
                                              ⚡ Force AI Re-Evaluation
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Insights Row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Visited Room</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--accent-yellow)', marginTop: '4px' }}>🏠 {selectedMemberContext.mostVisitedRoom || 'None'}</div>
                                      </div>
                                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Most Used Device</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#64C8FF', marginTop: '4px' }}>🔌 {selectedMemberContext.mostUsedDevice || 'None'}</div>
                                      </div>
                                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Peak Activity Time</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#FFAA33', marginTop: '4px' }}>🕒 {selectedMemberContext.mostActiveTime || 'None'}</div>
                                      </div>
                                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Habit Schedule</div>
                                        <div style={{ fontSize: '0.8rem', color: '#AAA', marginTop: '4px', lineHeight: '1.3' }}>{selectedMemberContext.dailyActivityPatterns || 'No pattern logged.'}</div>
                                      </div>
                                    </div>

                                    {/* Frequency Tags */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                                      <div>
                                        <h5 style={{ color: '#FFF', margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Frequently Visited Rooms</h5>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                          {selectedMemberContext.frequentlyUsedRooms && selectedMemberContext.frequentlyUsedRooms.length > 0 ? (
                                            selectedMemberContext.frequentlyUsedRooms.map((r, idx) => (
                                              <span key={idx} style={{ background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(234, 235, 114, 0.2)', fontWeight: 500 }}>{r}</span>
                                            ))
                                          ) : (
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Gathering telemetry logs...</span>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <h5 style={{ color: '#FFF', margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Most Interacted Devices</h5>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                          {selectedMemberContext.frequentlyUsedDevices && selectedMemberContext.frequentlyUsedDevices.length > 0 ? (
                                            selectedMemberContext.frequentlyUsedDevices.map((d, idx) => (
                                              <span key={idx} style={{ background: 'rgba(100, 200, 255, 0.1)', color: '#64C8FF', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(100, 200, 255, 0.2)', fontWeight: 500 }}>{d}</span>
                                            ))
                                          ) : (
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Gathering telemetry logs...</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Personalized Summary */}
                                    <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.2rem' }}>
                                      <h5 style={{ color: '#FFF', margin: '0 0 8px 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                        ✨ GrihaMitra AI Habit Summary
                                      </h5>
                                      {selectedMemberSummaryLoading ? (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Analyzing routine behavior timeline...</div>
                                      ) : (
                                        <p style={{ color: '#E0E0E0', fontSize: '0.85rem', margin: 0, lineHeight: '1.45', fontStyle: 'italic' }}>
                                          "{selectedMemberSummary || 'Establishing baseline routines. Complete more device actions to generate AI context summaries.'}"
                                        </p>
                                      )}
                                    </div>

                                    {/* AI Auto-Modification Logs */}
                                    {selectedMemberContext.aiEvaluationLogs && selectedMemberContext.aiEvaluationLogs.length > 0 && (
                                      <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1.2rem' }}>
                                        <h5 style={{ color: '#FFF', margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          📋 AI Auto-Modification Logs ({selectedMemberContext.aiEvaluationLogs.length})
                                        </h5>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '5px' }}>
                                          {selectedMemberContext.aiEvaluationLogs.slice().reverse().map((log, idx) => (
                                            <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                <span>{new Date(log.evaluatedAt).toLocaleString()}</span>
                                                <span style={{ color: 'var(--accent-yellow)', fontWeight: 600 }}>{log.modeAtEvaluation} Mode</span>
                                              </div>
                                              <p style={{ color: '#DDD', fontSize: '0.8rem', margin: '0 0 6px 0', lineHeight: '1.3' }}>{log.summary}</p>
                                              {log.changesMade && log.changesMade.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                  {log.changesMade.map((change, cIdx) => (
                                                    <span key={cIdx} style={{ background: 'rgba(234, 235, 114, 0.15)', color: 'var(--accent-yellow)', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(234, 235, 114, 0.1)' }}>{change}</span>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Inline Preferences Form */}
                                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '14px', padding: '1.25rem' }}>
                                      <h5 style={{ color: '#FFF', margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 600 }}>⚙️ Personalization & Comfort Settings</h5>
                                      <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        try {
                                          const token = localStorage.getItem('token');
                                          const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/family/context/profile/${selectedMemberContext._id}`, {
                                            method: 'PUT',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              'Authorization': `Bearer ${token}`
                                            },
                                            body: JSON.stringify({
                                              preferredLanguage: selectedMemberContext.preferredLanguage,
                                              voiceProfile: selectedMemberContext.voiceProfile,
                                              activeHours: selectedMemberContext.activeHours,
                                              preferences: selectedMemberContext.preferences
                                            })
                                          });
                                          if (res.ok) {
                                            alert('AI Context personalization updated successfully!');
                                            fetchFamilyMembers();
                                          } else {
                                            const errData = await res.json();
                                            alert(errData.error || 'Failed to update preferences');
                                          }
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Active Hours Range</label>
                                          <input 
                                            type="text" 
                                            value={selectedMemberContext.activeHours || ''} 
                                            onChange={e => setSelectedMemberContext(prev => ({ ...prev, activeHours: e.target.value }))}
                                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', outline: 'none' }} 
                                            placeholder="e.g. 7 PM - 11 PM"
                                          />
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Language Interface</label>
                                          <select 
                                            value={selectedMemberContext.preferredLanguage || 'English'} 
                                            onChange={e => setSelectedMemberContext(prev => ({ ...prev, preferredLanguage: e.target.value }))}
                                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                                          >
                                            <option value="English">English</option>
                                            <option value="Hindi">Hindi (हिंदी)</option>
                                            <option value="Marathi">Marathi (मराठी)</option>
                                            <option value="Spanish">Spanish</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Voice Output Profile</label>
                                          <select 
                                            value={selectedMemberContext.voiceProfile || 'Aditi'} 
                                            onChange={e => setSelectedMemberContext(prev => ({ ...prev, voiceProfile: e.target.value }))}
                                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                                          >
                                            <option value="Aditi">Aditi (Hindi/English)</option>
                                            <option value="Raveena">Raveena (Indian English)</option>
                                            <option value="Kajal">Kajal (Bilingual)</option>
                                            <option value="Matthew">Matthew (US English)</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Climate Comfort (°C)</label>
                                          <input 
                                            type="number" 
                                            value={selectedMemberContext.preferences?.tempPreference || 24} 
                                            onChange={e => setSelectedMemberContext(prev => ({ ...prev, preferences: { ...prev.preferences, tempPreference: parseInt(e.target.value) || 24 } }))}
                                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', outline: 'none' }} 
                                            min="16" max="30"
                                          />
                                        </div>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Illumination Mode</label>
                                          <select 
                                            value={selectedMemberContext.preferences?.lightingStyle || 'Warm White'} 
                                            onChange={e => setSelectedMemberContext(prev => ({ ...prev, preferences: { ...prev.preferences, lightingStyle: e.target.value } }))}
                                            style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#FFF', fontSize: '0.85rem', cursor: 'pointer', outline: 'none' }}
                                          >
                                            <option value="Warm White">Warm White</option>
                                            <option value="Cool Focus">Cool Focus</option>
                                            <option value="Ambient Sunset">Ambient Sunset</option>
                                            <option value="Eco Dim">Eco Dim</option>
                                          </select>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                          <button type="submit" style={{ width: '100%', background: 'var(--accent-yellow)', color: '#000', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.9} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
                                            Save Comfort Rules
                                          </button>
                                        </div>
                                      </form>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>Syncing telemetry context...</div>
                                )}
                              </div>

                              {user.role === 'Owner' && (
                                <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '1.5rem' }}>
                                  <button 
                                    onClick={() => handleEditMemberClick(member)}
                                    style={{ flex: 1, background: 'rgba(234, 235, 114, 0.1)', color: 'var(--accent-yellow)', border: '1px solid rgba(234, 235, 114, 0.2)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(234, 235, 114, 0.15)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(234, 235, 114, 0.1)'}
                                  >
                                    Edit Profile
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteMember(member._id)}
                                    style={{ flex: 1, background: 'rgba(255,50,50,0.1)', color: '#FF5555', border: '1px solid rgba(255,50,50,0.2)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', transition: 'all 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,50,50,0.25)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,50,50,0.1)'}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {activeTab === 'family_intel' && (
          <FamilyIntelligence />
        )}

        {activeTab === 'automation' && (
          <PredictiveAutomation homeInfo={homeInfo} />
        )}

        {activeTab === 'explainability' && (
          <ExplainabilityDashboard homeInfo={homeInfo} />
        )}

        {activeTab === 'voice_dashboard' && (
          <VoiceDashboard homeInfo={homeInfo} />
        )}

        {activeTab === 'avatar_dashboard' && (
          <AvatarDashboard homeInfo={homeInfo} socket={socket} />
        )}

        {activeTab === 'notifications' && (
          <div className="fade-in" style={{ paddingBottom: '2rem' }}>
            <div style={{ 
              display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', 
              marginBottom: '2rem', gap: '1rem', background: 'var(--bg-panel)', padding: '1.5rem', 
              borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(234, 235, 114, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(234, 235, 114, 0.2)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                </div>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.5px', margin: 0 }}>
                  24-Hour Activity Log
                </h3>
              </div>
              
              {user.role === 'Owner' && history.length > 0 && (
                <button 
                  onClick={handleClearNotifications}
                  title="Wipe all history logs"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(200,30,30,0.15) 0%, rgba(150,0,0,0.2) 100%)',
                    color: '#FF5555',
                    border: '1px solid rgba(255,68,68,0.3)',
                    boxShadow: '0 8px 25px rgba(255,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                    padding: '0.8rem 1.4rem', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    fontWeight: '600', 
                    fontSize: '0.9rem', 
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: 'fit-content',
                    marginLeft: 'auto'
                  }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,50,50,0.25) 0%, rgba(200,0,0,0.4) 100%)'; 
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 30px rgba(255,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = '#FFF';
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(200,30,30,0.15) 0%, rgba(150,0,0,0.2) 100%)'; 
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(255,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)';
                    e.currentTarget.style.color = '#FF5555';
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                  Delete All Logs
                </button>
              )}
            </div>

            <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)', maxHeight: '650px', overflowY: 'auto', borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.2)' }}>
              {history.length === 0 ? (
                <div style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '3rem', opacity: 0.5 }}>📭</span>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 500, margin: 0 }}>No recent activity within 24 hours.</p>
                </div>
              ) : null}
              {history.map((log, idx) => {
                // Remove the hardcoded bell emoji from the backend
                let finalMessage = log.message.replace('🔔 ', '');
                
                if(log.actorName === user.name) {
                  finalMessage = finalMessage.replace(log.actorName, 'You');
                }
                const isOff = finalMessage.includes('OFF');
                return (
                  <div key={log._id} style={{ 
                    padding: '1.25rem 1.5rem', borderBottom: idx === history.length - 1 ? 'none' : '1px solid var(--border-subtle)', 
                    display: 'flex', alignItems: 'center', gap: '18px', transition: 'background 0.2s', cursor: 'default'
                  }} 
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} 
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ 
                      flexShrink: 0, width: '46px', height: '46px', borderRadius: '50%', 
                      background: isOff ? 'rgba(255,50,50,0.15)' : 'rgba(68,255,68,0.15)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      border: `1px solid ${isOff ? 'rgba(255,50,50,0.3)' : 'rgba(68,255,68,0.3)'}`,
                      boxShadow: `0 0 15px ${isOff ? 'rgba(255,50,50,0.1)' : 'rgba(68,255,68,0.1)'}`
                    }}>
                      <span style={{ fontSize: '1.2rem' }}>{isOff ? '🔌' : '⚡'}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600, margin: '0 0 6px 0', letterSpacing: '0.2px' }}>{finalMessage}</p>
                      <small style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        {new Date(log.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'event_history' && (
          <div className="fade-in" style={{ paddingBottom: '3rem' }}>
            {/* Analytics Header Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem', background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(234, 235, 114, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(234, 235, 114, 0.2)' }}>
                <span style={{ fontSize: '1.4rem' }}>📊</span>
              </div>
              <div>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.5px', margin: 0 }}>
                  AI Event History & Analytics
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Record of every device state transition for AI pattern learning</p>
              </div>
            </div>

            {/* Analytics KPI Widgets */}
            {analyticsLoading ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '2rem 0' }}>Loading analytics metrics...</div>
            ) : analytics ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(234, 235, 114, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(234, 235, 114, 0.2)', fontSize: '1.4rem' }}>📈</div>
                  <div>
                    <h4 style={{ color: 'var(--text-secondary)', margin: '0 0 4px 0', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Total Actions</h4>
                    <h2 style={{ color: '#FFF', margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{analytics.totalEvents}</h2>
                  </div>
                </div>
                
                <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(100, 200, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(100, 200, 255, 0.2)', fontSize: '1.4rem' }}>👤</div>
                  <div>
                    <h4 style={{ color: 'var(--text-secondary)', margin: '0 0 4px 0', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Active Actor</h4>
                    <h2 style={{ color: '#FFF', margin: 0, fontSize: '1.25rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {analytics.mostActiveUser ? `${analytics.mostActiveUser.userName} (${analytics.mostActiveUser.count})` : 'N/A'}
                    </h2>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(0, 255, 156, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0, 255, 156, 0.2)', fontSize: '1.4rem' }}>🏠</div>
                  <div>
                    <h4 style={{ color: 'var(--text-secondary)', margin: '0 0 4px 0', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Active Room</h4>
                    <h2 style={{ color: '#FFF', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                      {analytics.mostActiveRoom ? `${analytics.mostActiveRoom.roomName} (${analytics.mostActiveRoom.count})` : 'N/A'}
                    </h2>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'rgba(255, 150, 50, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255, 150, 50, 0.2)', fontSize: '1.4rem' }}>🔌</div>
                  <div>
                    <h4 style={{ color: 'var(--text-secondary)', margin: '0 0 4px 0', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Frequent Device</h4>
                    <h2 style={{ color: '#FFF', margin: 0, fontSize: '1.25rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {analytics.mostUsedDevice ? `${analytics.mostUsedDevice.deviceName} (${analytics.mostUsedDevice.count})` : 'N/A'}
                    </h2>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Visualizer Row */}
            {analytics && (
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
                {/* Past 7 Days */}
                <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ color: '#FFF', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 600 }}>📅 Daily Activity Metrics</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '150px', paddingTop: '10px' }}>
                    {analytics.dailyActivity.map((day, idx) => {
                      const maxCount = Math.max(...analytics.dailyActivity.map(d => d.count), 1);
                      const heightPct = (day.count / maxCount) * 100;
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                          <div style={{ color: 'var(--accent-yellow)', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>{day.count}</div>
                          <div style={{ width: '20px', height: '100px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                            <div style={{
                              width: '100%',
                              height: `${heightPct}%`,
                              background: 'linear-gradient(to top, #D4D540, var(--accent-yellow))',
                              borderRadius: '4px',
                              boxShadow: '0 0 8px rgba(234, 235, 114, 0.3)',
                              transition: 'height 0.5s ease-out'
                            }} />
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {day.dayOfWeek.substring(0, 3)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Weekly activity */}
                <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ color: '#FFF', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 600 }}>📈 Weekly Activity Breakdown</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', height: '100px', justifyContent: 'center', margin: 'auto 0' }}>
                    {analytics.weeklyActivity.map((week, idx) => {
                      const maxCount = Math.max(...analytics.weeklyActivity.map(w => w.count), 1);
                      const widthPct = (week.count / maxCount) * 100;
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', width: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {week.weekLabel}
                          </div>
                          <div style={{ flex: 1, height: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${widthPct}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #64C8FF, #3B82F6)',
                              boxShadow: '0 0 6px rgba(100, 200, 255, 0.2)',
                              borderRadius: '5px',
                              transition: 'width 0.5s ease-out'
                            }} />
                          </div>
                          <div style={{ color: '#64C8FF', fontSize: '0.8rem', fontWeight: 'bold', width: '25px', textAlign: 'right' }}>
                            {week.count}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Event Filtering & Table Controls */}
            <div style={{ background: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-subtle)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
              
              {/* Filter Row */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                
                {/* Room Select */}
                <div style={{ flex: '1 1 150px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: 600 }}>Filter Room</label>
                  <select 
                    value={histRoomId} 
                    onChange={handleRoomFilterChange}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: '8px', color: '#FFF', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="">All Rooms</option>
                    {homeInfo?.rooms?.map(room => (
                      <option key={room._id} value={room._id}>{room.name}</option>
                    ))}
                  </select>
                </div>

                {/* Device Select */}
                <div style={{ flex: '1 1 150px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: 600 }}>Filter Device</label>
                  <select 
                    value={histDeviceId} 
                    onChange={handleDeviceFilterChange}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: '8px', color: '#FFF', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="">All Devices</option>
                    {(() => {
                      let devices = [];
                      if (histRoomId) {
                        const targetRoom = homeInfo?.rooms?.find(r => r._id === histRoomId);
                        if (targetRoom) devices = targetRoom.devices || [];
                      } else {
                        homeInfo?.rooms?.forEach(r => {
                          devices = [...devices, ...(r.devices || [])];
                        });
                      }
                      return devices.map(dev => (
                        <option key={dev._id} value={dev._id}>{dev.name}</option>
                      ));
                    })()}
                  </select>
                </div>

                {/* User Select */}
                <div style={{ flex: '1 1 150px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: 600 }}>Filter Actor</label>
                  <select 
                    value={histUserId} 
                    onChange={handleUserFilterChange}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: '8px', color: '#FFF', cursor: 'pointer', outline: 'none' }}
                  >
                    <option value="">All Users</option>
                    {homeInfo?.owner && (
                      <option value={homeInfo.owner._id}>{homeInfo.owner.name} (Creator)</option>
                    )}
                    {homeInfo?.members?.filter(m => m.status === 'approved' && m.user).map(m => (
                      <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                    ))}
                  </select>
                </div>

                {/* Start Date */}
                <div style={{ flex: '1 1 120px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: 600 }}>Start Date</label>
                  <input 
                    type="date" 
                    value={histStartDate}
                    onChange={handleStartDateChange}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '9px 12px', borderRadius: '8px', color: '#FFF', outline: 'none' }}
                  />
                </div>

                {/* End Date */}
                <div style={{ flex: '1 1 120px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', fontWeight: 600 }}>End Date</label>
                  <input 
                    type="date" 
                    value={histEndDate}
                    onChange={handleEndDateChange}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '9px 12px', borderRadius: '8px', color: '#FFF', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Event Log Table */}
              <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                {histLoading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading event logs...</div>
                ) : eventHistory.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No historical events match the query.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actor</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Room</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Device Details</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trigger Source</th>
                        <th style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventHistory.map(evt => {
                        const isOff = evt.action === 'OFF';
                        return (
                          <tr key={evt._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '14px 18px' }}>
                              <span style={{
                                background: isOff ? 'rgba(255,50,50,0.1)' : 'rgba(68,255,68,0.1)',
                                color: isOff ? '#FF5555' : '#44FF44',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                border: `1px solid ${isOff ? 'rgba(255,50,50,0.2)' : 'rgba(68,255,68,0.2)'}`
                              }}>
                                {evt.action}
                              </span>
                            </td>
                            <td style={{ padding: '14px 18px', color: '#FFF', fontWeight: 600, fontSize: '0.9rem' }}>{evt.userName}</td>
                            <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{evt.roomName}</td>
                            <td style={{ padding: '14px 18px', color: '#FFF', fontSize: '0.9rem' }}>
                              <strong>{evt.deviceName}</strong> <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>({evt.deviceType})</span>
                            </td>
                            <td style={{ padding: '14px 18px' }}>
                              <span style={{
                                fontSize: '0.75rem',
                                color: evt.source === 'MANUAL' ? '#64C8FF' : evt.source === 'AI' ? 'var(--accent-yellow)' : '#FFAA33',
                                background: evt.source === 'MANUAL' ? 'rgba(100,200,255,0.1)' : evt.source === 'AI' ? 'rgba(234,235,114,0.1)' : 'rgba(255,150,50,0.1)',
                                padding: '3px 8px',
                                borderRadius: '5px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                fontWeight: 600
                              }}>{evt.source}</span>
                            </td>
                            <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              {new Date(evt.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination Row */}
              {histTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <button 
                    disabled={histPage === 1} 
                    onClick={() => setHistPage(prev => Math.max(prev - 1, 1))}
                    style={{ background: histPage === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)', color: histPage === 1 ? '#555' : '#FFF', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: '8px', cursor: histPage === 1 ? 'not-allowed' : 'pointer', transition: '0.2s' }}
                  >
                    Previous
                  </button>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                    Page <strong style={{ color: '#FFF' }}>{histPage}</strong> of <strong>{histTotalPages}</strong>
                  </span>
                  <button 
                    disabled={histPage === histTotalPages} 
                    onClick={() => setHistPage(prev => Math.min(prev + 1, histTotalPages))}
                    style={{ background: histPage === histTotalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)', color: histPage === histTotalPages ? '#555' : '#FFF', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: '8px', cursor: histPage === histTotalPages ? 'not-allowed' : 'pointer', transition: '0.2s' }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'join_requests' && (
          <div className="room-section fade-in" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Pending Join Requests</h3>
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-panel)' }}>
              {pendingMembers.length === 0 ? <p style={{color: 'var(--text-secondary)'}}>No pending requests at the moment.</p> : null}
              
              {pendingMembers.map(m => (
                <div key={m.user._id} className="user-item" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)'}}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}>{m.user.email}</strong>
                    <br/>
                    <small style={{ color: 'var(--text-secondary)' }}>Role: Member</small>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => {
                        setProfileModal({
                          isOpen: true,
                          type: 'approve',
                          userId: m.user._id,
                          memberId: null,
                          name: m.user.name || m.user.email.split('@')[0],
                          role: 'Father',
                          age: '',
                          preferredLanguage: 'English',
                          voiceProfile: 'Aditi',
                          routineProfile: 'Office Routine',
                          preferences: {
                            tempPreference: 24,
                            lightingStyle: 'Warm White',
                            extraNotes: ''
                          }
                        });
                      }}
                      style={{ background: 'var(--accent-yellow)', color: 'var(--text-dark)', padding: '0.4rem 1rem', fontSize: '0.9rem', margin: 0 }}
                    >
                      ✅ Approve
                    </button>
                    <button 
                      onClick={() => handleReject(m.user._id)}
                      style={{ background: 'transparent', border: '1px solid #FF0000', color: '#FF0000', padding: '0.4rem 1rem', fontSize: '0.9rem', margin: 0 }}
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'add_room' && (
          <div className="fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Deploy New Hardware Zone
            </h3>
            <div className="glass-card" style={{ padding: '2rem', background: 'var(--bg-panel)' }}>
              
              <label style={{ display: 'block', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 600 }}>Zone Designation</label>
              <input 
                type="text" 
                value={newRoom.name} 
                onChange={e => setNewRoom(prev => ({...prev, name: e.target.value}))} 
                placeholder="e.g. Master Bedroom, Garage" 
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '12px', color: '#FFF', fontSize: '1.1rem', marginBottom: '2.5rem', outline: 'none', transition: 'border 0.3s' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-yellow)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />

              <label style={{ display: 'block', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem', marginBottom: '12px', fontWeight: 600 }}>Load Hardware ({newRoom.devices.length} Nodes)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '2rem' }}>
                  {[
                    { type: 'light', label: 'Smart Light', icon: '💡', color: 'var(--accent-yellow)', bg: 'rgba(234, 235, 114, 0.15)' },
                    { type: 'fan', label: 'Ceiling Fan', icon: '🌀', color: '#64C8FF', bg: 'rgba(100, 200, 255, 0.15)' },
                    { type: 'ac', label: 'A/C Unit', icon: '❄️', color: '#FF9696', bg: 'rgba(255, 150, 150, 0.15)' },
                    { type: 'tv', label: 'Smart TV', icon: '📺', color: '#96FF96', bg: 'rgba(150, 255, 150, 0.15)' },
                    { type: 'fridge', label: 'Refrigerator', icon: '🧊', color: '#C896FF', bg: 'rgba(200, 150, 255, 0.15)' },
                  ].map(devConf => {
                     const count = newRoom.devices.filter(d => d.type === devConf.type).length;
                     return (
                        <div key={devConf.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '12px', border: count > 0 ? `1px solid ${devConf.bg}` : '1px solid rgba(255,255,255,0.05)', transition: 'all 0.3s' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                             <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: devConf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>{devConf.icon}</div>
                             <span style={{ color: count > 0 ? '#FFF' : '#AAA', fontSize: '1.1rem', fontWeight: 600 }}>{devConf.label}</span>
                           </div>
                           
                           <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(0,0,0,0.5)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                             <button onClick={() => removeDeviceFromNewRoom(devConf.type)} disabled={count === 0} style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'transparent', border: 'none', color: count === 0 ? '#555' : '#FFF', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: count === 0 ? 'not-allowed' : 'pointer' }}>−</button>
                             <span style={{ width: '25px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: count > 0 ? devConf.color : '#666' }}>{count}</span>
                             <button onClick={() => addDeviceToNewRoom(devConf.type)} style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#FFF', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</button>
                           </div>
                        </div>
                     )
                  })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem' }}>
                 <button 
                   onClick={submitNewRoom}
                   disabled={!newRoom.name.trim() || isSubmitting}
                   style={{ background: newRoom.name.trim() ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.1)', color: newRoom.name.trim() ? '#000' : '#888', fontWeight: 'bold', padding: '14px 30px', borderRadius: '12px', fontSize: '1.1rem', cursor: newRoom.name.trim() && !isSubmitting ? 'pointer' : 'not-allowed', border: 'none', transition: '0.3s' }}
                 >
                   {isSubmitting ? 'Processing...' : 'Finalize & Boot Hardware Zone'}
                 </button>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="fade-in" style={{ height: 'calc(100vh - 150px)', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
            <HomeChat 
              socket={socket} 
              homeInfo={homeInfo} 
              user={user} 
            />
          </div>
        )}

        {profileModal.isOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)',
            padding: '20px', boxSizing: 'border-box'
          }}>
            <div className="fade-in" style={{
              background: 'var(--bg-panel)', padding: '2rem', borderRadius: '24px',
              border: '1px solid var(--border-subtle)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto'
            }}>
              <h4 style={{ color: '#FFF', fontSize: '1.3rem', marginBottom: '1.5rem', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {profileModal.type === 'edit' ? '✏️ Edit Family Profile' : 
                 profileModal.type === 'approve' ? '✅ Enroll Approved Member' :
                 profileModal.type === 'setup_ai' ? '🧠 Setup AI Smart Profile' : '➕ Enroll New Offline Family Member'}
              </h4>
              <form onSubmit={handleSaveFamilyMember} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Name</label>
                    <input 
                      type="text" 
                      required
                      value={profileModal.name}
                      onChange={e => setProfileModal(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Papa, Dadi, Rohan"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', color: '#FFF', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Role</label>
                    <select 
                      value={profileModal.role}
                      onChange={e => handleRoleChange(e.target.value)}
                      style={{ background: 'rgba(20, 20, 20, 0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', color: '#FFF', outline: 'none' }}
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Grandmother">Grandmother</option>
                      <option value="Student">Student</option>
                      <option value="Guest">Guest</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Age</label>
                    <input 
                      type="number"
                      value={profileModal.age}
                      onChange={e => setProfileModal(prev => ({ ...prev, age: e.target.value }))}
                      placeholder="e.g. 45"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', color: '#FFF', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Preferred Language</label>
                    <input 
                      type="text" 
                      value={profileModal.preferredLanguage}
                      onChange={e => setProfileModal(prev => ({ ...prev, preferredLanguage: e.target.value }))}
                      placeholder="e.g. English, Hindi"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', color: '#FFF', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Polly Voice Profile</label>
                    <select 
                      value={profileModal.voiceProfile}
                      onChange={e => setProfileModal(prev => ({ ...prev, voiceProfile: e.target.value }))}
                      style={{ background: 'rgba(20, 20, 20, 0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', color: '#FFF', outline: 'none' }}
                    >
                      <option value="Aditi">Aditi (Indian English / Hindi - Neural)</option>
                      <option value="Raveena">Raveena (Indian English - Standard)</option>
                      <option value="Kajal">Kajal (Hindi - Standard)</option>
                      <option value="Kendra">Kendra (US English - Standard)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Daily Routine Profile</label>
                    <select 
                      value={profileModal.routineProfile}
                      onChange={e => setProfileModal(prev => ({ ...prev, routineProfile: e.target.value }))}
                      style={{ background: 'rgba(20, 20, 20, 0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', color: '#FFF', outline: 'none' }}
                    >
                      <option value="Office Routine">Office Routine</option>
                      <option value="Cooking Routine">Cooking Routine</option>
                      <option value="Pooja Routine">Pooja Routine</option>
                      <option value="Study Routine">Study Routine</option>
                      <option value="Dynamic Routine">Dynamic Routine</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Preferred Temp (°C)</label>
                    <input 
                      type="number"
                      value={profileModal.preferences.tempPreference}
                      onChange={e => setProfileModal(prev => ({ 
                        ...prev, 
                        preferences: { ...prev.preferences, tempPreference: parseInt(e.target.value) || 24 } 
                      }))}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', color: '#FFF', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Lighting Style Preference</label>
                    <input 
                      type="text" 
                      value={profileModal.preferences.lightingStyle}
                      onChange={e => setProfileModal(prev => ({ 
                        ...prev, 
                        preferences: { ...prev.preferences, lightingStyle: e.target.value } 
                      }))}
                      placeholder="e.g. Warm White, Soft Daylight"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', color: '#FFF', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>Extra Comfort Notes</label>
                  <textarea 
                    value={profileModal.preferences.extraNotes}
                    onChange={e => setProfileModal(prev => ({ 
                      ...prev, 
                      preferences: { ...prev.preferences, extraNotes: e.target.value } 
                    }))}
                    placeholder="e.g. Needs quiet setting, prefers low fan speed"
                    rows={2}
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px', color: '#FFF', outline: 'none', resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '1rem' }}>
                  <button 
                    type="submit" 
                    style={{ flex: 1, background: 'linear-gradient(135deg, var(--accent-yellow) 0%, #D4D540 100%)', color: '#000', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 15px rgba(234,235,114,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  >
                    {profileModal.type === 'edit' ? 'Update Profile' : 
                     profileModal.type === 'approve' ? 'Approve & Enroll' : 'Enroll Member'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setProfileModal(prev => ({ ...prev, isOpen: false }))}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: '#FFF', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerDashboard;
