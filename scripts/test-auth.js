const axios = require("axios")

const BASE_URL = "http://localhost:3001/api/auth"

async function testAuth() {
    try {
        console.log("🧪 Testing Authentication API...\n")

        const timestamp = Date.now()
        const testUser = {
            username: `testuser_${timestamp}`,
            email: `test_${timestamp}@example.com`,
            password: "password123"
        }

        // Test 1: Register a new user
        console.log("1️⃣ Testing Registration...")
        console.log(`Creating user: ${testUser.username} (${testUser.email})`)

        const registerResponse = await axios.post(`${BASE_URL}/register`, testUser)
        console.log("✅ Registration successful!")
        console.log("User:", registerResponse.data)
        const token = registerResponse.data.token
        console.log()

        // Test 2: Login with the user
        console.log("2️⃣ Testing Login...")
        const loginResponse = await axios.post(`${BASE_URL}/login`, {
            email: testUser.email,
            password: testUser.password,
        })
        console.log("✅ Login successful!")
        console.log("User:", loginResponse.data)
        console.log()

        // Test 3: Get user profile with token
        console.log("3️⃣ Testing Get Me (Protected Route)...")
        const meResponse = await axios.get(`${BASE_URL}/me`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
        console.log("✅ Get Me successful!")
        console.log("User Profile:", meResponse.data)
        console.log()

        console.log("🎉 All authentication tests passed!")
    } catch (error) {
        console.error("❌ Test failed:")
        if (error.response) {
            console.error("Status:", error.response.status)
            console.error("Message:", error.response.data.message)
            console.error("Errors:", JSON.stringify(error.response.data.errors, null, 2))
        } else {
            console.error(error.message)
        }
    }
}

testAuth()
