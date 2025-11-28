const express = require("express")
const router = express.Router()
const { verifyToken } = require("../middleware/authMiddleware")
const { processAI } = require("../controllers/aiController")
const { aiLimiter } = require("../middleware/rateLimiter")
const { aiProcessValidation } = require("../middleware/validation")

// All routes require authentication
router.use(verifyToken)

// Apply AI-specific rate limiter
router.use(aiLimiter)

// Process AI request
router.post("/process", aiProcessValidation, processAI)

module.exports = router

