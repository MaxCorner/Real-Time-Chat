require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());

const client = new MongoClient(process.env.MONGO_URI);
let messagesCollection;
let usersCollection;

async function connectDB() {
  try {
    await client.connect();
    const db = client.db();
    messagesCollection = db.collection('messages');
    usersCollection = db.collection('users');
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error(err);
  }
}

connectDB();

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const existing = await usersCollection.findOne({ username });
  if (existing) return res.status(400).json({ error: 'Username exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  await usersCollection.insertOne({ username, passwordHash, role: 'user' });
  res.json({ message: 'Registered!' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await usersCollection.findOne({ username });
  if (!user) return res.status(400).json({ error: 'Invalid username' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(400).json({ error: 'Invalid password' });

  const token = jwt.sign(
    { username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token });
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.username = decoded.username;
    socket.role = decoded.role;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`${socket.username} connected`);

  socket.on('join room', async ({ room }) => {
    socket.join(room);
    socket.room = room;

    console.log(`${socket.username} joined room: ${room}`);

    const history = await messagesCollection
      .find({ room })
      .sort({ timestamp: 1 })
      .limit(20)
      .toArray();
    socket.emit('chat history', history);

    socket.to(room).emit('chat message', {
      username: 'Server',
      message: `${socket.username} joined the room.`,
    });
  });

  socket.on('chat message', async (message) => {
    if (!socket.room) return;

    const msgData = {
      username: socket.username,
      message: message,
      room: socket.room,
      timestamp: new Date(),
    };

    const result = await messagesCollection.insertOne(msgData);
    msgData._id = result.insertedId;

    io.to(socket.room).emit('chat message', msgData);
  });

  socket.on('delete message', async (messageId) => {
    if (socket.role !== 'admin') return;

    await messagesCollection.deleteOne({ _id: new ObjectId(messageId) });
    io.to(socket.room).emit('message deleted', messageId);
  });

  socket.on('disconnect', () => {
    if (socket.room) {
      socket.to(socket.room).emit('chat message', {
        username: 'Server',
        message: `${socket.username} left the room.`,
      });
    }
    console.log(`${socket.username} disconnected`);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
