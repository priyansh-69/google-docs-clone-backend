const { GoogleGenerativeAI } = require("@google/generative-ai")

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Process AI requests
exports.processAI = async (req, res) => {
    try {
        const { text, action } = req.body

        if (!text) {
            return res.status(400).json({ message: "Text is required" })
        }

        if (!action) {
            return res.status(400).json({ message: "Action is required" })
        }

        let prompt = ""

        switch (action) {
            case "grammar":
                prompt = `Please check and correct the grammar in the following text. Return ONLY the corrected text without any explanations or additional commentary:\n\n${text}`
                break
            case "summarize":
                prompt = `Please provide a concise summary of the following text. Keep it brief and to the point:\n\n${text}`
                break
            case "enhance":
                prompt = `Please enhance and improve the following text to make it more professional, clear, and engaging. Return ONLY the enhanced text without any explanations:\n\n${text}`
                break
            case "expand":
                prompt = `Please expand on the following text with more details and elaboration. Return ONLY the expanded text:\n\n${text}`
                break
            case "simplify":
                prompt = `Please simplify the following text to make it easier to understand. Use simpler words and shorter sentences. Return ONLY the simplified text:\n\n${text}`
                break
            default:
                return res.status(400).json({ message: "Invalid action" })
        }

        // Get the generative model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

        // Generate content
        const result = await model.generateContent(prompt)
        const response = await result.response
        const generatedText = response.text()

        res.json({
            success: true,
            result: generatedText,
            action
        })
    } catch (error) {
        console.error("Error processing AI request:", error)

        // Check if it's an API key error
        if (error.message && error.message.includes("API key")) {
            return res.status(500).json({
                message: "AI service configuration error. Please check your API key."
            })
        }

        res.status(500).json({
            message: "Failed to process AI request",
            error: error.message
        })
    }
}
