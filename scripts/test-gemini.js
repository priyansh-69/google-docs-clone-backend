require("dotenv").config()
const { GoogleGenerativeAI } = require("@google/generative-ai")

async function testGemini() {
    console.log("🧪 Testing Gemini API Connection...\n")

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        console.error("❌ Error: GEMINI_API_KEY is missing in .env file")
        return
    }

    console.log(`🔑 API Key found (starts with: ${apiKey.substring(0, 4)}...)`)

    try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

        console.log("🤖 Sending request to Gemini...")
        const prompt = "Say 'Hello, World!' if you can hear me."

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        console.log("✅ Gemini API Response:", text)
        console.log("\n🎉 Gemini API is working correctly!")
    } catch (error) {
        console.error("❌ Gemini API Test Failed:")
        console.error(error.message)

        if (error.message.includes("API key not valid")) {
            console.log("\n💡 Tip: Your API key seems invalid. Please check the Google AI Studio.")
        } else if (error.message.includes("quota")) {
            console.log("\n💡 Tip: You might have exceeded your API quota.")
        }
    }
}

testGemini()
