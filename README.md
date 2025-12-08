# 🚀 FlowDocs - Server

> Real-time collaborative document editing backend with AI capabilities

[![Node.js](https://img.shields.io/badge/Node.js-14+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.1.0-blue.svg)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.0.1-black.svg)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5.x-green.svg)](https://www.mongodb.com/)

## ✨ Features

### 🔐 Authentication & Security
- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **Rate Limiting** - Prevent brute force attacks
- **Input Validation** - Express-validator for data sanitization
- **CORS Protection** - Configured allowed origins
- **Helmet Security** - HTTP headers protection
- **XSS Protection** - Clean user inputs

### 📄 Document Management
- **CRUD Operations** - Create, read, update, delete documents
- **Real-time Sync** - Socket.IO for live updates
- **Auto-save** - Periodic document persistence
- **Share Links** - Generate unique share tokens
- **Access Control** - Owner-based permissions

### 🤝 Real-time Collaboration
- **Multi-user Editing** - Simultaneous document editing
- **Live Cursors** - Track user positions
- **Active Users** - See who's online
- **Operational Transform** - Conflict-free editing
- **Connection Management** - Handle disconnects gracefully

### 🤖 AI Integration
- **Google Gemini AI** - Powered by gemini-1.5-flash
- **Grammar Correction** - Fix spelling and grammar
- **Text Enhancement** - Professional writing
- **Summarization** - Concise summaries
- **Text Expansion** - Add details
- **Simplification** - Easy-to-read text

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express 5** | Web framework |
| **MongoDB** | Document database |
| **Mongoose** | ODM for MongoDB |
| **Socket.IO** | Real-time communication |
| **JWT** | Authentication tokens |
| **bcryptjs** | Password hashing |
| **Google Gemini** | AI text processing |
| **Helmet** | Security middleware |
| **Express Rate Limit** | Rate limiting |

## 📦 Installation

### Prerequisites
- Node.js >= 14.x
- MongoDB Atlas account or local MongoDB
- Google Gemini API key

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd google-clone/server
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the server directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/flowdocs?retryWrites=true&w=majority

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# AI Integration
GEMINI_API_KEY=your-google-gemini-api-key
```

4. **Start the server**

Development mode (with nodemon):
```bash
npm run devStart
```

Production mode:
```bash
npm start
```

Server runs on [http://localhost:3001](http://localhost:3001)

## 📁 Project Structure

```
server/
├── controllers/
│   ├── aiController.js      # AI text processing
│   ├── authController.js    # Authentication logic
│   └── documentController.js # Document CRUD
├── middleware/
│   └── authMiddleware.js    # JWT verification
├── models/
│   ├── Document.js          # Document schema
│   └── User.js              # User schema
├── routes/
│   ├── ai.js                # AI routes
│   ├── auth.js              # Auth routes
│   └── documents.js         # Document routes
├── .env                     # Environment variables
├── server.js                # Main server file
└── package.json             # Dependencies
```

## 🔌 API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

#### Get Current User
```http
GET /api/auth/user
Authorization: Bearer <jwt_token>
```

### Documents

#### Get All Documents
```http
GET /api/documents
Authorization: Bearer <jwt_token>
```

#### Get Single Document
```http
GET /api/documents/:id
Authorization: Bearer <jwt_token>
```

#### Create Document
```http
POST /api/documents
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "My Document",
  "data": {}
}
```

#### Update Document
```http
PUT /api/documents/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "title": "Updated Title",
  "data": {}
}
```

#### Delete Document
```http
DELETE /api/documents/:id
Authorization: Bearer <jwt_token>
```

#### Generate Share Link
```http
POST /api/documents/:id/share
Authorization: Bearer <jwt_token>
```

### AI Processing

#### Process Text
```http
POST /api/ai/process
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "text": "hello me is Priyansh",
  "action": "grammar"
}
```

**Actions**: `grammar`, `summarize`, `enhance`, `expand`, `simplify`

## 🔌 WebSocket Events

### Client → Server

```javascript
// Join document room
socket.emit('get-document', { 
  documentId: 'abc123',
  shareToken: 'optional-token'
})

// Send text changes
socket.emit('send-changes', delta)

// Save document
socket.emit('save-document', documentData)

// Update cursor position
socket.emit('cursor-position', {
  position: { index: 10, length: 0 },
  username: 'John'
})
```

### Server → Client

```javascript
// Receive document data
socket.on('load-document', documentData)

// Receive text changes
socket.on('receive-changes', delta)

// Save acknowledgment
socket.on('save-success')
socket.on('save-error', error)

// User joined
socket.on('user-joined', { username, userId })

// User left
socket.on('user-left', username)

// Active users
socket.on('active-users', usersArray)

// Cursor update
socket.on('cursor-update', cursorData)
```

## 🗄️ Database Schema

### User Model
```javascript
{
  username: String (required, unique),
  email: String (required, unique),
  password: String (required, hashed),
  createdAt: Date
}
```

### Document Model
```javascript
{
  title: String (default: "Untitled Document"),
  data: Object (Quill Delta),
  owner: ObjectId (ref: User),
  shareToken: String (unique, indexed),
  createdAt: Date,
  updatedAt: Date
}
```

## 🔒 Security Features

### Authentication
- JWT tokens with expiration
- Password hashing with bcrypt (10 salt rounds)
- Token verification middleware

### Rate Limiting
```javascript
// 100 requests per 15 minutes per IP
windowMs: 15 * 60 * 1000
max: 100
```

### Input Validation
- Email format validation
- Password strength requirements
- Username constraints
- Document data sanitization

### CORS Configuration
```javascript
allowedOrigins: [
  'http://localhost:3000',
  'https://your-frontend-url.com'
]
```

## 🤖 AI Configuration

### Gemini API Setup

1. **Get API Key**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new API key
   - Copy to `.env` file

2. **Model Selection**
   - Current: `gemini-1.5-flash` (free tier)
   - Alternative: `gemini-pro` (requires quota)

3. **Quota Limits** (Free Tier)
   - 15 requests per minute
   - 1,500 requests per day
   - Resets daily

### Response Cleanup
The server automatically removes:
- Label prefixes (`Enhanced:`, `Corrected:`, etc.)
- Explanatory suffixes
- Surrounding quotes
- Markdown formatting

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## 🚀 Deployment

### Environment Setup

**Production `.env`:**
```env
PORT=3001
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=<strong-random-secret>
GEMINI_API_KEY=<your-api-key>
```

### MongoDB Atlas Setup

1. Create a cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Whitelist your server IP or use `0.0.0.0/0` for all IPs
3. Create a database user
4. Get connection string and add to `.env`

### Deployment Platforms

#### Heroku
```bash
heroku create flowdocs-server
heroku config:set MONGO_URI=<your-uri>
heroku config:set JWT_SECRET=<your-secret>
heroku config:set GEMINI_API_KEY=<your-key>
git push heroku main
```

#### Railway
1. Connect GitHub repository
2. Add environment variables in dashboard
3. Deploy automatically on push

#### Render
1. Create new Web Service
2. Connect repository
3. Add environment variables
4. Deploy

## 📊 Monitoring

### Server Logs
```javascript
// Connection logs
✅ CORS allowed: http://localhost:3000
User connected: <socket-id>
User disconnected: <socket-id>

// Document operations
Document <id> cleaned up - no users remaining

// Errors
Error processing AI request: <error>
```

### Health Check
```http
GET /
Response: "Server is running"
```

## 🐛 Known Issues & Solutions

### 1. MongoDB Connection Error
**Issue**: `MongooseServerSelectionError`

**Solution**: 
- Whitelist your IP in MongoDB Atlas
- Check connection string format
- Verify network access

### 2. Socket.IO CORS Error
**Issue**: CORS policy blocking Socket.IO

**Solution**:
```javascript
// Add frontend URL to allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-frontend.com'
]
```

### 3. AI Quota Exceeded
**Issue**: `429 Too Many Requests`

**Solution**:
- Wait for quota reset (24 hours)
- Create new API key
- Upgrade to paid tier

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3001) |
| `MONGO_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `NODE_ENV` | Environment (development/production) | No |

## 📈 Performance

### Optimizations
- Connection pooling for MongoDB
- Socket.IO room-based broadcasting
- Rate limiting to prevent abuse
- Efficient document querying with indexes

### Scalability
- Stateless architecture
- Horizontal scaling ready
- Redis adapter for Socket.IO (optional)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/) - Web framework
- [Socket.IO](https://socket.io/) - Real-time engine
- [MongoDB](https://www.mongodb.com/) - Database
- [Google Gemini](https://ai.google.dev/) - AI capabilities

## 📞 Support

For issues:
- Check server logs
- Review MongoDB connection
- Verify environment variables
- Check API quotas

---

**Built with ⚡ using Node.js and modern backend technologies**
