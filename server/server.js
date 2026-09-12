const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

// Load env vars (try server/.env and root .env)
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'shadowbarter_secret_key_default';
}

const app = express();
const server = http.createServer(app);

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for image uploads)
app.use('/uploads', express.static(uploadsDir));

// Socket.io configuration
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinRoom', (transactionId) => {
    socket.join(transactionId);
    console.log(`User joined room: ${transactionId}`);
  });

  socket.on('sendMessage', (data) => {
    io.to(data.transactionId).emit('receiveMessage', data);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

app.set('io', io);

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Anonymous Barter System API',
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

// Routes
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const requestRoutes = require('./routes/requestRoutes');
const matchingRoutes = require('./routes/matchingRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/matching', matchingRoutes);

// Serve client static build in production or single-server setup (Express 5 compatible)
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shadowbarter';
mongoose.connect(mongoUri).then(() => {
  console.log('MongoDB connected successfully');
}).catch(err => console.log('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
