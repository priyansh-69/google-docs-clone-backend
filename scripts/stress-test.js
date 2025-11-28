const axios = require('axios');
const { io } = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3001/api';
const SOCKET_URL = 'http://localhost:3001';

// Colors for output
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m"
};

const log = (msg, color = colors.reset) => console.log(`${color}${msg}${colors.reset}`);

async function stressTest() {
    log("🚀 Starting Backend Stress & Edge Case Test...", colors.blue);

    let token;
    let userId;
    let docId;

    // 1. Auth Edge Cases
    log("\n1️⃣ Testing Auth Edge Cases...", colors.yellow);
    try {
        // Register
        const uniqueUser = `stress_${Date.now()}`;
        const res = await axios.post(`${BASE_URL}/auth/register`, {
            username: uniqueUser,
            email: `${uniqueUser}@example.com`,
            password: 'Password123!'
        });
        token = res.data.token;
        userId = res.data._id;
        log("✅ Registration successful", colors.green);

        // Login with wrong password
        try {
            await axios.post(`${BASE_URL}/auth/login`, {
                email: `${uniqueUser}@example.com`,
                password: 'WrongPassword!'
            });
            log("❌ Failed: Should reject wrong password", colors.red);
        } catch (e) {
            if (e.response?.status === 400) log("✅ Correctly rejected wrong password", colors.green);
            else log(`❌ Unexpected error: ${e.message}`, colors.red);
        }

        // Access protected route with garbage token
        try {
            await axios.get(`${BASE_URL}/auth/me`, {
                headers: { Authorization: 'Bearer garbage_token_string' }
            });
            log("❌ Failed: Should reject garbage token", colors.red);
        } catch (e) {
            if (e.response?.status === 401) log("✅ Correctly rejected garbage token", colors.green);
        }

    } catch (e) {
        log(`❌ Critical Auth Failure: ${e.message}`, colors.red);
        return;
    }

    // 2. Document Concurrency & Race Conditions
    log("\n2️⃣ Testing Document Concurrency...", colors.yellow);
    try {
        // Create Doc
        const newDocId = uuidv4();
        const docRes = await axios.post(`${BASE_URL}/documents`, {
            title: "Stress Doc",
            documentId: newDocId
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        docId = docRes.data._id;
        log("✅ Document created", colors.green);

        // Simulate 20 concurrent title updates
        log("⚡ Firing 20 concurrent title updates...", colors.blue);
        const updates = [];
        for (let i = 0; i < 20; i++) {
            updates.push(axios.patch(`${BASE_URL}/documents/${docId}/title`,
                { title: `Title Update ${i}` },
                { headers: { Authorization: `Bearer ${token}` } }
            ));
        }

        const results = await Promise.allSettled(updates);
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length === 0) {
            log("✅ Server handled 20 concurrent updates without crashing", colors.green);
        } else {
            log(`⚠️ ${failures.length} updates failed (might be rate limiting, which is good)`, colors.yellow);
        }

    } catch (e) {
        log(`❌ Document Test Failure: ${e.message}`, colors.red);
    }

    // 3. Socket.io Connection Stress
    log("\n3️⃣ Testing Socket Connection Stress...", colors.yellow);
    const sockets = [];
    try {
        log("⚡ Opening 50 simultaneous socket connections...", colors.blue);
        for (let i = 0; i < 50; i++) {
            const socket = io(SOCKET_URL, {
                transports: ['websocket'],
                forceNew: true
            });
            sockets.push(socket);
        }

        // Wait a bit for connections
        await new Promise(r => setTimeout(r, 2000));

        const connectedCount = sockets.filter(s => s.connected).length;
        log(`✅ ${connectedCount}/50 sockets connected successfully`, colors.green);

        // Cleanup
        sockets.forEach(s => s.disconnect());

    } catch (e) {
        log(`❌ Socket Stress Failure: ${e.message}`, colors.red);
    }

    // 4. Input Validation & Injection
    log("\n4️⃣ Testing Input Validation...", colors.yellow);
    try {
        // XSS Payload in Title
        const xssPayload = "<script>alert('hacked')</script>";
        await axios.patch(`${BASE_URL}/documents/${docId}/title`,
            { title: xssPayload },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        // Fetch it back to see if it was sanitized or stored raw
        const getDoc = await axios.get(`${BASE_URL}/documents/${docId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (getDoc.data.title === xssPayload) {
            log("⚠️ Warning: XSS payload stored raw (Frontend must handle escaping)", colors.yellow);
        } else {
            log("✅ Input sanitized/modified", colors.green);
        }

        // Huge Payload
        const hugeTitle = "a".repeat(10000);
        try {
            await axios.patch(`${BASE_URL}/documents/${docId}/title`,
                { title: hugeTitle },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            log("⚠️ Warning: Server accepted 10k char title", colors.yellow);
        } catch (e) {
            log("✅ Server rejected huge payload", colors.green);
        }

    } catch (e) {
        log(`❌ Validation Test Failure: ${e.message}`, colors.red);
    }

    log("\n🏁 Stress Test Complete", colors.blue);
}

stressTest();
