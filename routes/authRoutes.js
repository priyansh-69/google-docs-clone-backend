const express = require("express")
const router = express.Router()
const {
    registerUser,
    loginUser,
    getMe,
} = require("../controllers/authController")
const { verifyToken } = require("../middleware/authMiddleware")
const { authLimiter } = require("../middleware/rateLimiter")
const { registerValidation, loginValidation } = require("../middleware/validation")

// Apply auth rate limiter to all routes
router.use(authLimiter)

router.post("/register", registerValidation, registerUser)
router.post("/login", loginValidation, loginUser)
router.get("/me", verifyToken, getMe)

module.exports = router

