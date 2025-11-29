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
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost/google-docs-clone", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
})

// Initialize Express app
const app = express()

// Trust proxy - Required for Railway/Heroku/Render to get real client IP
app.set('trust proxy', 1)

// Middleware
// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, enable in production
}))

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
// TODO: Fix mongoSanitize compatibility issue - currently causing crash
// app.use(mongoSanitize())

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

  socket.on("get-document", async ({ documentId, user }) => {
    const document = await findOrCreateDocument(documentId)
    socket.join(documentId)

    // Initialize user tracking for this document (use Map instead of Set)
    if (!documentUsers.has(documentId)) {
      documentUsers.set(documentId, new Map()) // socketId -> userInfo
    }

    // Add user to document (using Map to prevent duplicates)
    const userInfo = {
      socketId: socket.id,
      userId: user?._id || socket.id,
      username: user?.username || 'Anonymous',
      color: generateUserColor()
    }

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

    // Handle text changes
    socket.on("send-changes", delta => {
      socket.broadcast.to(documentId).emit("receive-changes", delta)
    })

    // Handle cursor movement
    socket.on("cursor-move", cursorData => {
      socket.broadcast.to(documentId).emit("cursor-update", {
        userId: userInfo.userId,
        username: userInfo.username,
        color: userInfo.color,
        ...cursorData
      })
    })

    // Handle title changes - broadcast to other users
    socket.on("title-change", (newTitle) => {
      socket.broadcast.to(documentId).emit("title-update", newTitle)
    })

    // Handle document save
    socket.on("save-document", async (data, callback) => {
      try {
        await Document.findByIdAndUpdate(documentId, { data })
        io.to(documentId).emit("document-saved")
        if (callback) callback({ status: 'ok' })
      } catch (e) {
        console.error("Save error:", e)
        if (callback) callback({ status: 'error', error: e.message })
      }
    })

    // Handle user disconnect
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id)

      if (documentUsers.has(documentId)) {
        const users = documentUsers.get(documentId)

        // Remove user from the map
        if (users.has(socket.id)) {
          users.delete(socket.id)

          // Notify others that user left
          io.to(documentId).emit("user-left", {
            userId: userInfo.userId,
            username: userInfo.username,
            activeUsers: Array.from(users.values()).map(u => ({
              userId: u.userId,
              username: u.username,
              color: u.color
            }))
          })
        }

        // Clean up if no users left
        if (users.size === 0) {
          documentUsers.delete(documentId)
        }
      }
    })
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

