require("dotenv").config()
const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const http = require("http")
const { Server } = require("socket.io")
const helmet = require("helmet")
const mongoSanitize = require("express-mongo-sanitize")
const { apiLimiter } = require("./middleware/rateLimiter")
const Document = require("./Document")

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost/google-docs-clone")

// Initialize Express app
const app = express()

// Trust proxy - Required for Railway/Heroku/Render to get real client IP
app.set('trust proxy', 1)

// Middleware
// Security headers
app.use(helmet())

// CORS configuration
const allowedOrigins = [
  "http://localhost:3000",  // Local development
  "https://google-docs-clone-frontend-puce.vercel.app",  // Vercel production
  process.env.CLIENT_URL  // Additional from env
].filter(Boolean);

// Log allowed origins for debugging
console.log('🔒 Allowed CORS Origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS allowed:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS BLOCKED:', origin);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: false, limit: '10mb' }))

// Data sanitization against NoSQL injection
app.use(mongoSanitize())

// Rate limiting
app.use('/api/', apiLimiter)

// Health check endpoint (for deployment platforms)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Routes
app.use("/api/auth", require("./routes/authRoutes"))
app.use("/api/documents", require("./routes/documentRoutes"))
app.use("/api/ai", require("./routes/aiRoutes"))

// Create HTTP server
const server = http.createServer(app)

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
})

// Socket.io authentication middleware
const jwt = require("jsonwebtoken")
const User = require("./User")

io.use(async (socket, next) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth.token || socket.handshake.query.token

    if (!token) {
      return next(new Error("Authentication error: No token provided"))
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user from database
    const user = await User.findById(decoded.id).select('-password')

    if (!user) {
      return next(new Error("Authentication error: User not found"))
    }

    // Attach user to socket
    socket.user = user
    next()
  } catch (error) {
    console.error("Socket auth error:", error.message)
    next(new Error("Authentication error: Invalid token"))
  }
})

const defaultValue = ""

// Track active users per document
const documentUsers = new Map() // documentId -> Set of { socketId, userId, username, color }

// Generate random color for user cursor
function generateUserColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

io.on("connection", socket => {
  console.log("User connected:", socket.id)

  let currentDocumentId = null  // Track which document this socket is in
  let currentUserInfo = null    // Track user info for this socket

  socket.on("get-document", async ({ documentId, shareToken }) => {
    try {
      // Use authenticated user from socket (set by middleware)
      const authenticatedUser = socket.user

      // Get document from database
      const document = await findOrCreateDocument(documentId)

      // Check if user has permission to access this document
      const isOwner = authenticatedUser && document.owner && document.owner.toString() === authenticatedUser._id.toString()
      const isCollaborator = authenticatedUser && document.collaborators && document.collaborators.some(
        collab => collab.user && collab.user.toString() === authenticatedUser._id.toString()
      )

      // Check if accessing via valid share link
      const hasValidShareToken = shareToken &&
        document.shareLink &&
        document.shareLink.enabled &&
        document.shareLink.token === shareToken

      // Allow access if: owner, collaborator, OR valid share token
      if (!isOwner && !isCollaborator && !hasValidShareToken) {
        socket.emit("error", { message: "You don't have permission to access this document" })
        return
      }

      // If accessing via share link and not already a collaborator, add them
      if (hasValidShareToken && !isOwner && !isCollaborator) {
        const sharePermission = document.shareLink.permission || 'viewer'

        // Add user to collaborators
        document.collaborators.push({
          user: authenticatedUser._id,
          permission: sharePermission
        })

        await document.save()
        console.log(`Added user ${authenticatedUser.username} as ${sharePermission} via share link`)
      }

      // Store current document ID for this socket
      currentDocumentId = documentId
      socket.join(documentId)

      // Initialize user tracking for this document (use Map instead of Set)
      if (!documentUsers.has(documentId)) {
        documentUsers.set(documentId, new Map()) // socketId -> userInfo
      }

      // Add user to document (using authenticated user data)
      const userInfo = {
        socketId: socket.id,
        userId: authenticatedUser._id.toString(),
        username: authenticatedUser.username,
        email: authenticatedUser.email,
        color: generateUserColor()
      }

      // Store user info for this socket
      currentUserInfo = userInfo

      const users = documentUsers.get(documentId)
      users.set(socket.id, userInfo) // Use socketId as key to prevent duplicates

      // Send document data to the user
      socket.emit("load-document", document.data)

      // Notify all users in the document about the new user
      const activeUsers = Array.from(users.values()).map(u => ({
        userId: u.userId,
        username: u.username,
        color: u.color
      }))

      io.to(documentId).emit("user-joined", {
        user: {
          userId: userInfo.userId,
          username: userInfo.username,
          color: userInfo.color
        },
        activeUsers
      })
    } catch (error) {
      console.error("Error in get-document:", error)
      socket.emit("error", { message: "Failed to load document" })
    }
  })

  // Handle text changes - at connection level
  socket.on("send-changes", (delta) => {
    try {
      if (!delta || !currentDocumentId) {
        console.error("Invalid delta or no document")
        return
      }
      socket.broadcast.to(currentDocumentId).emit("receive-changes", delta)
    } catch (error) {
      console.error("Error handling send-changes:", error)
    }
  })

  // Handle cursor movement - at connection level
  socket.on("cursor-move", (cursorData) => {
    try {
      if (!cursorData || typeof cursorData.index !== 'number' || !currentDocumentId || !currentUserInfo) {
        return
      }
      socket.broadcast.to(currentDocumentId).emit("cursor-update", {
        userId: currentUserInfo.userId,
        username: currentUserInfo.username,
        color: currentUserInfo.color,
        ...cursorData
      })
    } catch (error) {
      console.error("Error handling cursor-move:", error)
    }
  })

  // Handle title changes - at connection level
  socket.on("title-change", (newTitle) => {
    try {
      if (!newTitle || typeof newTitle !== 'string' || !currentDocumentId) {
        return
      }
      socket.broadcast.to(currentDocumentId).emit("title-update", newTitle)
    } catch (error) {
      console.error("Error handling title-change:", error)
    }
  })

  // Handle document save - at connection level
  socket.on("save-document", async (data, callback) => {
    try {
      if (!currentDocumentId) {
        if (callback) callback({ status: 'error', error: 'No document loaded' })
        return
      }
      await Document.findByIdAndUpdate(currentDocumentId, { data })
      io.to(currentDocumentId).emit("document-saved")
      if (callback) callback({ status: 'ok' })
    } catch (e) {
      console.error("Save error:", e)
      if (callback) callback({ status: 'error', error: e.message })
    }
  })

  // Handle user disconnect - at connection level
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)

    if (currentDocumentId && documentUsers.has(currentDocumentId)) {
      const users = documentUsers.get(currentDocumentId)

      // Get user info BEFORE deleting
      const disconnectedUser = users.get(socket.id)

      // Remove user from the map
      if (users.has(socket.id)) {
        users.delete(socket.id)

        // Only notify if we found the user info
        if (disconnectedUser) {
          // Notify others that user left
          io.to(currentDocumentId).emit("user-left", {
            userId: disconnectedUser.userId,
            username: disconnectedUser.username,
            activeUsers: Array.from(users.values()).map(u => ({
              userId: u.userId,
              username: u.username,
              color: u.color
            }))
          })
        }
      }

      // Clean up if no users left
      if (users.size === 0) {
        documentUsers.delete(currentDocumentId)
        console.log(`Document ${currentDocumentId} cleaned up - no users remaining`)
      }
    }
  })
})

async function findOrCreateDocument(id) {
  if (id == null) return

  const document = await Document.findById(id)
  if (document) return document
  return await Document.create({ _id: id, data: defaultValue })
}

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

