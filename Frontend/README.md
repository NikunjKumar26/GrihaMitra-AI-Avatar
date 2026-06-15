# 🏡 Sapno Ka Ghar (Home of Dreams) - IoT Smart Home Automation

Welcome to **Sapno Ka Ghar**, a comprehensive, real-time IoT Smart Home Automation platform. This project provides a full-stack solution allowing users to seamlessly control physical home appliances from anywhere in the world using an elegant web interface.

---

## 🌟 Overview

Sapno Ka Ghar is structured into three main synchronized components:
1. **Frontend Application**: A modern, responsive React web interface for users to build and control their virtual homes.
2. **Backend Server**: A robust Node.js/Express server that handles authentication, real-time Socket.io routing, and MongoDB database interactions.
3. **ESP32 Hardware**: The microcontroller script (`arduinoide.ino`) that acts as the physical bridge, translating cloud events into actual relay triggers for turning appliances ON/OFF.

### 🔑 Key Features
- **Role-Based Access Control**:
  - **Admins**: Monitor system health and manage Home Owners.
  - **Owners**: Register, create "Homes", configure Rooms and Devices, and generate invitation codes for family members.
  - **Members**: Join a home using an invite code to gain control over the configured appliances.
- **Real-Time Synchronization**: Changes made on the mobile or web app reflect instantly on the hardware appliance and across all active web sessions via **Socket.io**.
- **Secure Invitations**: Generate secure joining codes to securely expand house access.
- **Real-Time Notifications & Tracking**: Track activities within the home.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React.js, Vite, React Router, TailwindCSS (assumed), Socket.io-Client
- **Backend**: Node.js, Express.js, MongoDB (Mongoose), Socket.io, JSONWebToken (JWT) for secure authentication. 
- **Hardware Integrations**: ESP32 MCU, Arduino IDE, WebSocketsClient, SocketIOclient, ArduinoJson.

### 🔄 How It Works (The Data Flow)
1. **The User** logs in through the Frontend and switches a light ON in the Dashboard.
2. The Frontend sends an HTTP/Socket request to the **Node.js Backend**.
3. The Backend authenticates the request, updates the device state in **MongoDB**, and broadcasts a real-time `deviceUpdate` event via **Socket.io** to that specific home's network overlay.
4. The **ESP32 Microcontroller**, securely connected directly to the cloud backend via WebSockets, catches the broadcast event.
5. The ESP32 parses the JSON payload, matches the `deviceId`, and triggers the respective physical GPIO Pin (e.g., pulling a relay HIGH), physically turning the actual appliance ON.

---

## 🚀 Getting Started

### 1. Database Setup (MongoDB)
1. Create a cluster on MongoDB Atlas or a local MongoDB database.
2. Note down your URI. The backend requires a `MONGO_URI` environment variable.

### 2. Backend Setup
1. Open a terminal and navigate to the `Backend` directory: `cd Backend`
2. Install NodeJS dependencies: `npm install`
3. Create a `.env` file in the `Backend` directory containing:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secret_jwt_key
   ```
4. Start the server (development mode): `npm run dev`

### 3. Frontend Setup
1. Open a separate terminal and navigate to the `Frontend` directory: `cd Frontend`
2. Install React dependencies: `npm install`
3. Since this communicates with the backend, ensure your API Base URLs in the services point to `https://sapno-ka-ghar-backend.onrender.com` (or your deployed URL).
4. Run the frontend development server: `npm run dev`
5. Visit `http://localhost:5173` in your browser.

### 4. ESP32 Hardware Configuration
1. Open `arduinoide.ino` in the **Arduino IDE**.
2. Install the required libraries via the Arduino Library Manager:
   - `WebSockets` by Markus Sattler
   - `ArduinoJson` by Benoit Blanchon (Supports v6 and v7)
3. Modify the configuration under Phase 1 and 2 in the code:
   - Enter your actual `SSID` and `PASSWORD` for your home Wi-Fi network.
   - Enter your Backend URL (`host` variable). If testing locally, you might need to route using Ngrok or deploy your Node.js app momentarily.
4. Update ObjectIDs: Create a Home on the web interface, register lights, and copy their generated MongoDB ObjectIDs (`_id`) into the `arduinoide.ino` definitions.
5. Connect your ESP32 via USB, select your COM Port, and hit **Upload**!

---

## 🌎 Cloud Deployment Readiness
- **Backend** is optimized for frictionless deployment on **Render** or Heroku.
- **Frontend** includes client-side routing `_redirects` and is primed to deploy gracefully directly to **Netlify** or Vercel using `npm run build`.

---

*Made with ❤️ for smart living.*
