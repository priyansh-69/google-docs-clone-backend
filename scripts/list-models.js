require("dotenv").config()
const { GoogleGenerativeAI } = require("@google/generative-ai")

async function listModels() {
    console.log("📋 Listing Available Gemini Models...\n")

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        console.error("❌ Error: GEMINI_API_KEY is missing")
        return
    }

    try {
        // We can't list models directly with the SDK easily in this version, 
        // so let's try a standard fetch to the API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        )
        const data = await response.json()

        if (data.models) {
            console.log("✅ Available Models:")
            data.models.forEach(model => {
                if (model.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${model.name} (${model.displayName})`)
                }
            })
        } else {
            console.log("❌ No models found or error:", data)
        }

    } catch (error) {
        console.error("❌ Failed to list models:", error.message)
    }
}

listModels()
