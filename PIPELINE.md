# ☘️ Smart Home & AI Companion Ecosystem (Sapno Ka Ghar)
## End-to-End Data Pipeline & Communication Specifications

This document defines the data pipelines, communication protocols, network topologies, and processing flows implemented in the **Sapno Ka Ghar** (GrihaMitra) ecosystem.

---

## 🏗️ 1. High-Level Architectural Flow

GrihaMitra uses modular communication paths orchestrated by a centralized agent layer to handle real-time control, IoT telemetry ingestion, low-latency video streaming, decoupled AI tasks, and companion avatar dialogues:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React Frontend Dashboard                        │
└─────┬───────────────▲───────────────┬──────────────────────────▲───────┘
      │               │               │ (WebRTC A/V)             │ (WebRTC)
      │ (HTTP REST)   │ (Socket.io)   │                          │
      ▼               │               ▼                          │
┌─────────────┐       │       ┌───────────────┐                  │
│   Node.js   ├───────┴───────► FFmpeg Binary  │                  │
│ API Server  │               └───────▲───────┘                  │
└─────┬───────┴───────────────────────┼──────────────────────────┼───────┘
      │ (Task Queues)                 │ (RTSP Stream)            │
      ▼                               │                          │
┌───────────────────────────────┐     │                          │
│     GrihaMitra Agent Layer    │     │                          │
│  (Context, Memory, Explain,   │     │                          │
│   Voice, Avatar, Predictive)  │     │                          │
└─────┬───────────────┬─────────┘     │                          │
      │               │               │                          │
      ▼               ▼               ▼                          │
┌─────────────┐ ┌─────────────┐ ┌───────┴───────┐          ┌───────┴───────┐
│ Python AI   │ │ AWS Services│ │  AMB82 MINI   │          │    HeyGen     │
│ Microservice│ │ (Bedrock /  │ │  Smart Camera │          │ Streaming API │
│ (Whisper)   │ │  Polly)     │ │               │          │               │
└─────────────┘ └─────────────┘ └───────────────┘          └───────────────┘
```

---

## ⚡ 2. Pipeline A: Real-Time Smart Home Actuation (Socket.io)

This pipeline manages low-latency, bi-directional commands between React clients and home automation hardware (such as ESP32 nodes controlling 3.3V GPIO physical relays).

### Sequence Flow
```mermaid
sequenceDiagram
    autonumber
    actor User as React Web UI
    participant Server as Node.js Backend
    participant DB as MongoDB (Mongoose)
    participant HW as ESP32 Hardware Relays

    User->>Server: Socket.emit('toggleDevice', payload)
    Note over User,Server: payload: { homeId, roomId, deviceId, state, userName }
    
    Server->>Server: Validate & optimistic broadcast
    Server->>User: Socket.to(homeId).emit('deviceUpdate', { roomId, deviceId, state })
    Server->>HW: Socket.to(homeId).emit('deviceUpdate', { roomId, deviceId, state })
    
    rect rgb(240, 248, 255)
        Note right of HW: ESP32 catches broadcast & triggers GPIO High/Low (3.3V Relay)
    end
    
    Server->>DB: Home.findByIdAndUpdate() / Save Device State
    Server->>DB: Create Notification (24-Hour TTL Log)
    Server->>User: Socket.to(homeId).emit('notification', popUpPayload)
```

---

## 🍀 3. Pipeline B: Smart Gardening & AI Irrigation (MQTT)

This pipeline processes high-volume soil telemetry, runs rule-based safety checks, and manages automation for agricultural pumps and drainage valves.

### Sequence Flow
```mermaid
graph LR
    subgraph Sensors
        M1[Depth S1 Moisten]
        M2[Depth S2 Moisten]
        M3[Depth S3 Moisten]
        NPK[NPK Sensor]
        WL[Water Tank Level]
    end

    subgraph Broker
        MQTT_B[Mosquitto Broker]
    end

    subgraph Backend
        GWay[MQTT Gateway Service]
        AIEng[AI Irrigation Engine]
        Mongo[(MongoDB Atlas)]
    end

    subgraph Clients
        WS[Socket.io Server]
        Dash[Frontend Gauges]
    end

    M1 & M2 & M3 & NPK & WL -->|"agri/telemetry"| MQTT_B
    MQTT_B -->|"MQTT Ingest"| GWay
    GWay -->|"Trigger Evaluation"| AIEng
    AIEng -->|"Save SensorData"| Mongo
    AIEng -->|Evaluate Thresholds| Decision{Check Safety}
    
    Decision -->|"Tank Empty (<15%)"| ForceOff[Force Pump OFF & Send Warning Alert]
    Decision -->|"Dry Soil (<Threshold)"| PumpOn[Turn Pump ON & Open Valve]
    Decision -->|"Waterlogged (>90%)"| DrainOn[Open Drainage Valve]
    
    ForceOff & PumpOn & DrainOn -->|"agri/commands"| MQTT_B
    MQTT_B -->|Apply| Solenoids[Relays / Valves / Pumps]
    AIEng -->|"Broadcast Status"| WS
    WS -->|"Emit telemetry_update"| Dash
```

---

## 📹 4. Pipeline C: Live Camera Streaming (RTSP to WebRTC)

This pipeline establishes a direct peer-to-peer WebRTC stream from camera hardware (AMB82 MINI) to the browser client without intermediate cloud transcoding.

```mermaid
sequenceDiagram
    autonumber
    participant Client as React Browser Client
    participant Server as Node.js Backend
    participant FFmpeg as Spawned FFmpeg Binary
    participant Cam as AMB82 MINI Camera Node

    Cam->>Cam: Initializes RTSP Server: rtsp://[IP]:554/live
    Client->>Server: socket.emit('webrtc_offer', { zoneId, sdp })
    Server->>Server: Binds local UDP Socket Port (e.g. 52402)
    
    Server->>FFmpeg: Spawns FFmpeg Process
    activate FFmpeg
    FFmpeg->>Cam: Connects TCP and requests stream
    Cam-->>FFmpeg: Delivers raw H.264 frames
    FFmpeg->>Server: Relays RTP packets to 127.0.0.1:52402 (UDP)
    deactivate FFmpeg
    
    Server->>Server: UDP Socket captures RTP stream & writes to MediaStreamTrack (werift)
    Server->>Client: socket.emit('webrtc_answer', { zoneId, sdp })
    Server->>Client: socket.emit('webrtc_candidate', candidates)
    Server-->>Client: Direct WebRTC RTP Audio/Video stream
```

---

## 🧠 5. Pipeline D: GrihaMitra Agent Layer Workflow (BullMQ & Redis)

This pipeline operates as the central cognitive processing unit. It decouples high-latency AI tasks into organized agent engines to ensure smooth API responses and resilient memory handling.

```mermaid
graph TD
    UserAudio[Client Voice Input] -->|Socket Stream| NodeBE[Express Route / API]
    
    subgraph GrihaMitra Agent Layer
        NodeBE -->|Enqueue Job| VoiceInt[Voice Intelligence Engine]
        VoiceInt -->|1. Transcribe (FastAPI Whisper)| STTResult[Transcript]
        
        STTResult -->|2. Context Aggregation| ContextEng[Context Engine]
        ContextEng -->|Retrieve History| MemEng[Memory Engine]
        
        MemEng -->|3. Query Bedrock| Bedrock_Q[Bedrock Reasoning]
        Bedrock_Q -->|Generate Explanation| ExplainEng[Explainability Engine]
        
        ExplainEng -->|4. Speech Synthesis| AvatarInt[Avatar Intelligence Engine]
        AvatarInt -->|Trigger Polly TTS| Polly_Q[Polly Synthesis]
    end
    
    Polly_Q -->|Broadcast Audio/WebRTC| ClientUI[Avatar UI Dashboard]
    Polly_Q -->|Save Logs| Analytics[Analytics Queue -> MongoDB]
```

### Components of the GrihaMitra Agent Layer:
- **Context Engine**: Aggregates family profiles, sensor arrays, and active routines.
- **Memory Engine**: Interacts with MongoDB `AvatarMemory` and `ConversationSession` to provide semantic recall to the LLM.
- **Routine Learning Engine**: Maps behavioral patterns into predictable `AIRoutine` documents.
- **Predictive Automation Engine**: Evaluates confidence thresholds before actively controlling home devices.
- **Explainability Engine**: Translates complex probabilistic model logic into friendly human sentences.
- **Voice Intelligence Engine**: Runs speech transcription, language detection, and determines interaction intent.
- **Avatar Intelligence Engine**: Controls HeyGen WebRTC streams, adapts emotions, and modulates avatar behavior states.
- **Proactive Decision Engine**: Driven by BullMQ schedulers to process critical asynchronous events (e.g., Security, Water Tank Alerts).

---

## 👤 6. Pipeline E: HeyGen Streaming Avatar Integration

This pipeline provides low-latency virtual companion avatars via a server-controlled WebRTC streaming session.

### Interactive Session Life-cycle
```mermaid
sequenceDiagram
    autonumber
    participant UI as React Client
    participant Agent as GrihaMitra Agent Layer
    participant HG as HeyGen Streaming API

    UI->>Agent: POST /api/avatar/create-session
    Agent->>HG: POST /v1/streaming.create_token (x-api-key)
    HG-->>Agent: Returns Session Token
    Agent->>HG: POST /v1/streaming.new (VP8 encoding details)
    HG-->>Agent: Returns Session ID & SDP Offer
    Agent-->>UI: Returns Session ID, SDP Offer, ICE Servers

    UI->>UI: Set remote description & generate SDP Answer
    UI->>Agent: POST /api/avatar/start (sessionId, sdpAnswer)
    Agent->>HG: POST /v1/streaming.start (sdpAnswer)
    HG-->>Agent: Establish WebRTC Peer Connection
    Agent-->>UI: Success status

    rect rgb(240, 248, 255)
        UI-->>HG: Peer-to-Peer audio/video streaming (VP8/Opus)
    end

    UI->>Agent: POST /api/avatar/speak (sessionId, text)
    Agent->>HG: POST /v1/streaming.task (text, task_type: talk)
    HG-->>UI: Avatar speaks text in real time

    UI->>Agent: POST /api/avatar/stop (sessionId)
    Agent->>HG: POST /v1/streaming.stop (sessionId)
    HG-->>Agent: Session Closed
    Agent-->>UI: Session Closed
```

---

## 📢 7. Pipeline F: Proactive Decision Engine (Scheduler)

This engine manages alerts and predictive recommendations, preventing voice overlap and flooding using priority queue scheduling and throttling windows.

### Flow Architecture
```mermaid
graph TD
    Trigger[Alert Trigger: Security/Water/Power/Routine] -->|Schedule Task| ProactiveEng[Proactive Decision Engine]
    
    subgraph Throttling Evaluation
        ProactiveEng -->|Check Cutoff Window| MongoQuery{Duplicate in Window?}
        MongoQuery -->|Yes| Drop[Drop / Suppress Alert]
        MongoQuery -->|No| AvatarInt[Avatar Intelligence Engine]
    end
    
    AvatarInt -->|Determine State & Emotion| StreamCheck{Active Session?}
    StreamCheck -->|Yes| HeyGenSpeak[HeyGen speakWithAvatar task]
    StreamCheck -->|No/Fallback| SocketEmit[Socket.io: emit avatarAlert]
    
    HeyGenSpeak --> SaveMemory[Memory Engine: Save Log]
    SocketEmit --> SaveMemory
```

### Priority and Throttling Matrix
| Alert Type | Cutoff Window | Queue Priority | Target Emotion | Target State | Description |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **security** | 30 seconds | 1 (Highest) | Alert | Alerting | Unauthorized entry, perimeter break alerts |
| **water_tank** | 3 minutes | 2 | Concerned | Alerting | Low water level warnings |
| **power_failure** | 3 minutes | 2 | Concerned | Alerting | Main grid power loss warnings |
| **routine** | 10 minutes | 3 (Lowest) | Normal | Speaking | Inferred family routine triggers |
| **prediction** | 10 minutes | 3 (Lowest) | Normal | Speaking | Household predictive automation warnings |

---

## 🔊 8. Custom Speech Profiles & Audio Filesystem Cache

This pipeline maps family member roles to distinct Polly voices and caches generated MP3 audio files on the local filesystem to avoid redundant API fees.

### Audio Caching Mechanism
```
Synthesize Request ("Text String", Role)
        ↓
Convert Role to Profile (VoiceId, Rate)
        ↓
SSML Text = <speak><prosody rate="Rate">Escaped Text</prosody></speak>
        ↓
MD5 Hash = md5(SSML_Text + VoiceId)
        ↓
Check Local File System: public/temp_audio/[MD5_Hash].mp3
        ├─► [File Exists] ────► Stream cached MP3 file (Zero AWS charges)
        └─► [File Missing] ───► Call Amazon Polly Neural API
                                     ↓
                                Write MP3 to public/temp_audio/
                                     ↓
                                Record AIUsageMetrics cost telemetry
                                     ↓
                                Stream new MP3 file
```

---

## 📊 9. Telemetry & AI Usage Cost Ingestion

The backend records usage metadata inside the `AIUsageMetrics` collection to track cloud expenses in real time.

### Calculation Parameters
1. **Amazon Bedrock (Nova Lite)**: Input \$0.06 / 1M tokens, Output \$0.24 / 1M tokens
2. **Amazon Bedrock (Nova Pro)**: Input \$0.80 / 1M tokens, Output \$3.20 / 1M tokens
3. **Amazon Polly (Neural Engine)**: \$16.00 / 1M Characters
4. **Amazon Polly (Standard Engine)**: \$4.00 / 1M Characters

---

## 🔒 10. Access Control & Sandbox Telemetry

The ecosystem isolates each home to protect hardware and configuration settings from cross-tenant operations:

1. **REST Authentication**: Calls must provide a JWT in the `Authorization: Bearer <token>` header, containing the encrypted `userId` and `role`.
2. **WebSocket Quarantine**:
   - Clients request access to a home using `socket.emit('joinHome', { homeId })`.
   - The backend checks member configurations in MongoDB.
   - If authorized, the socket joins the isolated space: `socket.join(homeId)`.
3. **Granular Room Access**: Sub-members can only fetch and control devices inside rooms listed in their `accessibleRooms` array.
