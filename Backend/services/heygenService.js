const HEYGEN_API_URL = 'https://api.heygen.com';
const API_KEY = process.env.HEYGEN_API_KEY || '';

// A realistic mock SDP offer to satisfy RTCPeerConnection in fallback mode
const MOCK_SDP_OFFER = 
  "v=0\r\n" +
  "o=- 4611731400430051336 2 IN IP4 127.0.0.1\r\n" +
  "s=-\r\n" +
  "t=0 0\r\n" +
  "a=group:BUNDLE 0 1\r\n" +
  "a=msid-semantic: WMS\r\n" +
  "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n" +
  "c=IN IP4 0.0.0.0\r\n" +
  "a=rtpmap:111 opus/48000/2\r\n" +
  "m=video 9 UDP/TLS/RTP/SAVPF 96\r\n" +
  "c=IN IP4 0.0.0.0\r\n" +
  "a=rtpmap:96 VP8/90000\r\n";

/**
 * Retrieve session token from HeyGen
 */
async function getSessionToken() {
  if (!API_KEY) {
    throw new Error('Missing HEYGEN_API_KEY');
  }

  try {
    const res = await fetch(`${HEYGEN_API_URL}/v1/streaming.create_token`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token creation failed: ${text}`);
    }

    const json = await res.json();
    return json.data?.token || json.token;
  } catch (err) {
    console.warn('[HeyGen API Warning] Token creation failed, reverting to api key headers:', err.message);
    return null;
  }
}

/**
 * Create a new HeyGen streaming avatar session
 */
exports.createSession = async (quality = 'medium', avatarName = 'Bryan_FitnessCoach_public', voiceConfig = {}) => {
  const isFallback = !API_KEY || API_KEY.startsWith('<') || API_KEY.includes('rotated');
  
  if (isFallback) {
    console.log('🤖 [HeyGen Service] Running in Mock/Offline fallback mode.');
    return {
      success: true,
      sessionId: `mock_session_${Date.now()}`,
      sdp: {
        type: 'offer',
        sdp: MOCK_SDP_OFFER
      },
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      isMock: true
    };
  }

  try {
    const token = await getSessionToken();
    const headers = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['x-api-key'] = API_KEY;
    }

    const body = {
      quality: quality,
      avatar_name: avatarName,
      voice: {
        voice_id: voiceConfig.voiceId || 'e99d19a27e7d4dbda6221c0e290f2095', // Default voice
        rate: voiceConfig.rate || 1.0
      },
      video_encoding: 'VP8',
      version: 'v2'
    };

    const res = await fetch(`${HEYGEN_API_URL}/v1/streaming.new`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create HeyGen session: ${text}`);
    }

    const json = await res.json();
    const data = json.data || json;

    return {
      success: true,
      sessionId: data.session_id,
      sdp: data.sdp,
      iceServers: data.ice_servers || [{ urls: 'stun:stun.l.google.com:19302' }],
      isMock: false
    };
  } catch (err) {
    console.warn('⚠️ [HeyGen Service] Create Session failed. Reverting to Mock Fallback:', err.message);
    return {
      success: true,
      sessionId: `mock_session_${Date.now()}`,
      sdp: {
        type: 'offer',
        sdp: MOCK_SDP_OFFER
      },
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      isMock: true
    };
  }
};

/**
 * Start the HeyGen streaming avatar session
 */
exports.startSession = async (sessionId, sdpAnswer) => {
  if (sessionId.startsWith('mock_')) {
    console.log(`🤖 [HeyGen Service] Started Mock Session: ${sessionId}`);
    return { success: true, isMock: true };
  }

  try {
    const res = await fetch(`${HEYGEN_API_URL}/v1/streaming.start`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId,
        sdp: sdpAnswer
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to start HeyGen stream: ${text}`);
    }

    return { success: true, isMock: false };
  } catch (err) {
    console.warn(`⚠️ [HeyGen Service] Start Session failed: ${err.message}. Assuming mock session.`);
    return { success: true, isMock: true };
  }
};

/**
 * Send a speech task to the HeyGen streaming avatar
 */
exports.speak = async (sessionId, text) => {
  if (!sessionId) {
    return { success: false, error: 'No active session ID' };
  }

  if (sessionId.startsWith('mock_')) {
    console.log(`🤖 [HeyGen Service] Mock Session ${sessionId} speaking: "${text}"`);
    return { success: true, isMock: true };
  }

  try {
    const res = await fetch(`${HEYGEN_API_URL}/v1/streaming.task`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId,
        text: text,
        task_type: 'talk'
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HeyGen speak task failed: ${text}`);
    }

    return { success: true, isMock: false };
  } catch (err) {
    console.warn(`⚠️ [HeyGen Service] Speak failed: ${err.message}. Simulating speaking.`);
    return { success: true, isMock: true, error: err.message };
  }
};

/**
 * Stop the HeyGen streaming avatar session
 */
exports.stopSession = async (sessionId) => {
  if (!sessionId) {
    return { success: false, error: 'No session ID to close' };
  }

  if (sessionId.startsWith('mock_')) {
    console.log(`🤖 [HeyGen Service] Mock Session closed: ${sessionId}`);
    return { success: true, isMock: true };
  }

  try {
    const res = await fetch(`${HEYGEN_API_URL}/v1/streaming.stop`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: sessionId
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to stop HeyGen session: ${text}`);
    }

    return { success: true, isMock: false };
  } catch (err) {
    console.warn(`⚠️ [HeyGen Service] Stop failed: ${err.message}`);
    return { success: true, isMock: true };
  }
};
