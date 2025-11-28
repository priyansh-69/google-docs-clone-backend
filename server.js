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

// Middleware
// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, enable in production
}))

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: false, limit: '10mb' }))

// Data sanitization against NoSQL injection
// Data sanitization against NoSQL injection
// app.use(mongoSanitize())

// Rate limiting
app.use('/api/', apiLimiter)

// Routes
app.use("/api/auth", require("./routes/authRoutes"))
app.use("/api/documents", require("./routes/documentRoutes"))
app.use("/api/ai", require("./routes/aiRoutes"))

// Create HTTP server
const server = http.createServer(app)

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
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

    // Initialize user tracking for this document
    if (!documentUsers.has(documentId)) {
      documentUsers.set(documentId, new Set())
    }

    // Add user to document
    const userInfo = {
      socketId: socket.id,
      userId: user?._id || socket.id,
      username: user?.username || 'Anonymous',
      color: generateUserColor()
    }

    const users = documentUsers.get(documentId)
    users.add(userInfo)

    // Send document data to the user
    socket.emit("load-document", document.data)

    // Notify all users in the document about the new user
    const activeUsers = Array.from(users).map(u => ({
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
        // Remove user from the set
        for (let user of users) {
          if (user.socketId === socket.id) {
            users.delete(user)

            // Notify others that user left
            io.to(documentId).emit("user-left", {
              userId: userInfo.userId,
              username: userInfo.username,
              activeUsers: Array.from(users).map(u => ({
                userId: u.userId,
                username: u.username,
                color: u.color
              }))
            })
            break
          }
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

