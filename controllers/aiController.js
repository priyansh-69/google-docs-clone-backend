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
                prompt = `You are a grammar expert. Fix ALL grammar mistakes in this text.

IMPORTANT: Return ONLY the corrected text. Do NOT add labels, explanations, or extra words.

Examples:
Input: "hello me is Priyansh"
Output: "Hello, I am Priyansh."

Input: "they was going home"
Output: "They were going home."

Now fix this:
${text}`
                break
            case "summarize":
                prompt = `Summarize this text in 1-2 sentences. Return ONLY the summary, no labels.

${text}`
                break
            case "enhance":
                prompt = `Rewrite this text to be more professional and polished. Keep the same meaning. Return ONLY the improved text, no labels or explanations.

${text}`
                break
            case "expand":
                prompt = `Add 2-3 more sentences to this text with additional details. Return ONLY the complete expanded text, no labels.

${text}`
                break
            case "simplify":
                prompt = `Rewrite this using simple, easy words. Return ONLY the simplified text, no labels.

${text}`
                break
            default:
                return res.status(400).json({ message: "Invalid action" })
        }

        // Get the generative model - using gemini-1.5-flash (free tier)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

        // Generate content
        const result = await model.generateContent(prompt)
        const response = await result.response
        let generatedText = response.text()

        // Aggressive cleanup - remove ALL common labels and formatting
        generatedText = generatedText
            // Remove common prefixes
            .replace(/^(Corrected text:|Corrected:|Summary:|Improved text:|Improved:|Enhanced:|Expanded text:|Expanded:|Simplified text:|Simplified:|Output:|Result:)\s*/gi, '')
            // Remove "this is professionally enhanced" type suffixes
            .replace(/\s*-\s*this is (professionally enhanced|improved|corrected|simplified|expanded)\.?$/gi, '')
            // Remove surrounding quotes
            .replace(/^["']|["']$/g, '')
            // Remove markdown formatting
            .replace(/^\*\*|\*\*$/g, '')
            .trim()

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
