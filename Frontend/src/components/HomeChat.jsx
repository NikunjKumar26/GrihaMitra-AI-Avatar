import React, { useState, useEffect, useRef } from 'react';

const HomeChat = ({ socket, homeInfo, user }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChatHistory();

    if (socket) {
      socket.on('receiveChatMessage', (message) => {
        setMessages(prev => [...prev, message]);
      });
      socket.on('chatCleared', () => {
        setMessages([]);
      });
    }

    return () => {
      if (socket) {
        socket.off('receiveChatMessage');
        socket.off('chatCleared');
      }
    };
  }, [socket, homeInfo._id]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChatHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/${homeInfo._id}/chat`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(data);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching chat history:', error);
      setIsLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    if (socket) {
      socket.emit('sendChatMessage', {
        homeId: homeInfo._id,
        senderId: user.id || user._id,
        senderName: user.name || user.email.split('@')[0],
        text: newMessage.trim()
      });
      setNewMessage('');
    }
  };

  const handleClearChat = async () => {
    setIsClearing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : import.meta.env.VITE_API_URL || 'https://sapno-ka-ghar-backend.onrender.com'}/api/home/${homeInfo._id}/chat`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setMessages([]);
        setIsConfirmingClear(false);
      } else {
        alert("Failed to clear chat");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  const formatTime = (dateString) => {
    const d = new Date(dateString);
    let hours = d.getHours();
    let minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
  };

  if (isLoading) {
    return <div style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center' }}>Loading Chat...</div>;
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '700px', background: 'rgba(20, 20, 20, 0.65)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)', overflow: 'hidden', position: 'relative' }}>
      
      {/* Immersive Background Structure */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '200px', background: 'radial-gradient(ellipse at top, rgba(234, 235, 114, 0.05) 0%, rgba(0,0,0,0) 70%)', zIndex: 0, pointerEvents: 'none' }}></div>

      {/* Confirmation Modal overlay inside the chat window */}
      {isConfirmingClear && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="fade-in" style={{ padding: '2rem 2.5rem', background: 'var(--bg-panel)', border: '1px solid rgba(255,50,50,0.3)', borderRadius: '24px', textAlign: 'center', maxWidth: '400px', boxShadow: '0 20px 50px rgba(255,0,0,0.1)' }}>
            <h3 style={{ color: '#FF5555', margin: '0 0 1rem 0', fontSize: '1.4rem' }}>Erase Secure Log?</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.5 }}>
              This will permanently delete the entire real-time conversation history for <strong style={{color: '#FFF'}}>ALL</strong> household members. This action is irreversible.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button 
                onClick={() => setIsConfirmingClear(false)}
                disabled={isClearing}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid rgba(255,255,255,0.2)', padding: '10px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleClearChat}
                disabled={isClearing}
                style={{ background: '#FF3333', color: '#FFF', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(255,50,50,0.4)', transition: '0.2s' }}
                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.2)'}
                onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
              >
                {isClearing ? 'Erasing...' : 'Yes, Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Header */}
      <div style={{ position: 'relative', zIndex: 1, padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(180deg, rgba(30,30,30,0.8) 0%, rgba(20,20,20,0.4) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(234, 235, 114, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(234, 235, 114, 0.3)', boxShadow: '0 0 20px rgba(234, 235, 114, 0.15)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <div>
            <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.3px' }}>Encrypted Home Chat</h3>
            <span style={{ color: '#44FF44', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontWeight: 500 }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#44FF44', boxShadow: '0 0 8px #44FF44' }} />
              Active Real-time Session
            </span>
          </div>
        </div>

        {user.role === 'Owner' && (
          <button 
            onClick={() => setIsConfirmingClear(true)}
            style={{
              background: 'rgba(255,50,50,0.05)',
              color: '#FF4444',
              border: '1px solid rgba(255,50,50,0.2)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: '0.2s',
              width: 'fit-content'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FF4444'; e.currentTarget.style.color = '#FFF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,50,50,0.1)'; e.currentTarget.style.color = '#FF5555'; }}
          >
            Clear History
          </button>
        )}
      </div>

      {/* Messages Window */}
      <div style={{ flex: 1, position: 'relative', zIndex: 1, padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', scrollBehavior: 'smooth' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
            <span style={{fontSize: '1.1rem', fontWeight: 500}}>No messages in the channel.</span>
            <span style={{fontSize: '0.9rem', opacity: 0.7}}>Say hello to the household!</span>
          </div>
        ) : null}
        
        {messages.map((msg, idx) => {
          const isMe = String(msg.senderId) === String(user.id || user._id);
          
          return (
            <div key={msg._id || idx} className="fade-in" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: isMe ? 'flex-end' : 'flex-start',
              gap: '6px'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '0 6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isMe ? 'You' : msg.senderName}
              </span>
              <div style={{ 
                background: isMe ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.06)', 
                color: isMe ? '#000' : 'var(--text-primary)',
                padding: '14px 20px', 
                borderRadius: '20px',
                borderBottomLeftRadius: isMe ? '20px' : '4px',
                borderBottomRightRadius: isMe ? '4px' : '20px',
                maxWidth: '80%',
                boxShadow: isMe ? '0 10px 25px rgba(234, 235, 114, 0.25)' : '0 4px 15px rgba(0,0,0,0.2)',
                border: isMe ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
                fontWeight: 500,
                fontSize: '1.05rem',
                lineHeight: 1.5,
                wordBreak: 'break-word',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
              }}>
                {msg.text}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', padding: '0 6px', fontWeight: 600 }}>
                {formatTime(msg.createdAt)}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area Wrapper */}
      <div style={{ position: 'relative', zIndex: 1, padding: '1.5rem 2rem', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(0deg, rgba(15,15,15,0.9) 0%, rgba(20,20,20,0.6) 100%)' }}>
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '15px', alignItems: 'stretch' }}>
          <input 
            type="text" 
            placeholder="Type a secure message..." 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            style={{ 
              flex: '1 1 auto',
              width: '100%', 
              background: 'rgba(0,0,0,0.4)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '12px', 
              padding: '12px 18px', 
              color: '#FFF', 
              fontSize: '0.95rem', 
              outline: 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent-yellow)';
              e.target.style.boxShadow = '0 0 15px rgba(234, 235, 114, 0.1), inset 0 2px 4px rgba(0,0,0,0.3)';
              e.target.style.background = 'rgba(20,20,20,0.6)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255,255,255,0.1)';
              e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.3)';
              e.target.style.background = 'rgba(0,0,0,0.4)';
            }}
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            style={{ 
              flex: '0 0 auto',
              width: 'fit-content',
              minWidth: '70px',
              background: newMessage.trim() ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.05)', 
              color: newMessage.trim() ? '#000' : '#888',
              border: '1px solid ' + (newMessage.trim() ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.1)'),
              borderRadius: '12px', 
              padding: '0 16px', 
              fontSize: '0.85rem',
              fontWeight: 700, 
              cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: newMessage.trim() ? '0 8px 25px rgba(234, 235, 114, 0.3)' : 'none',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={e => {
              if (newMessage.trim()) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(234, 235, 114, 0.4)';
              }
            }}
            onMouseLeave={e => {
              if (newMessage.trim()) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(234, 235, 114, 0.3)';
              }
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default HomeChat;
