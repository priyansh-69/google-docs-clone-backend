const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const User = require("../User")

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    })
}

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        console.log('📝 Registration attempt:', req.body)
        const { username, email, password } = req.body

        if (!username || !email || !password) {
            console.log('❌ Missing fields:', { username: !!username, email: !!email, password: !!password })
            return res.status(400).json({ message: "Please provide all fields" })
        }

        // Check if JWT_SECRET is set
        if (!process.env.JWT_SECRET) {
            console.error('🚨 CRITICAL: JWT_SECRET is not set!')
            return res.status(500).json({ message: "Server configuration error" })
        }

        // Check if user exists
        console.log('🔍 Checking if user exists:', { email, username })
        const userExists = await User.findOne({ email })
        const usernameExists = await User.findOne({ username })

        if (userExists) {
            console.log('❌ User email already exists:', email)
            return res.status(400).json({ message: "User with this email already exists" })
        }

        if (usernameExists) {
            console.log('❌ Username already exists:', username)
            return res.status(400).json({ message: "Username is already taken" })
        }

        // Hash password
        console.log('🔒 Hashing password...')
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)

        // Create user
        console.log('💾 Creating user in database...')
        const user = await User.create({
            username,
            email,
            password: hashedPassword,
        })

        if (user) {
            console.log('✅ User created successfully:', user._id)
            const token = generateToken(user._id)
            res.status(201).json({
                _id: user.id,
                username: user.username,
                email: user.email,
                token: token,
            })
        } else {
            console.log('❌ User creation failed')
            res.status(400).json({ message: "Invalid user data" })
        }
    } catch (error) {
        console.error('🚨 Registration error:', error)
        console.error('🚨 Error name:', error.name)
        console.error('🚨 Error message:', error.message)
        console.error('🚨 Error stack:', error.stack)
        res.status(500).json({
            message: "Server error",
            error: process.env.NODE_ENV === 'production' ? undefined : error.message
        })
    }
}

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body

        // Check for user email
        const user = await User.findOne({ email })

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                _id: user.id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
            })
        } else {
            res.status(400).json({ message: "Invalid credentials" })
        }
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Server error" })
    }
}

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password")
        res.status(200).json(user)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Server error" })
    }
}

module.exports = {
    registerUser,
    loginUser,
    getMe,
}
