require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let messagesCollection;

async function connectDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    const db = client.db();
    messagesCollection = db.collection('messages');
  } catch (err) {
    console.error(err);
  }
}

connectDB();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('join room', async ({ username, room }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    console.log(`${username} joined room: ${room}`);

    const history = await messagesCollection
      .find({ room })
      .sort({ timestamp: 1 })
      .limit(20)
      .toArray();
    socket.emit('chat history', history);

    socket.to(room).emit('chat message', {
      username: 'Server',
      message: `${username} joined the room.`,
    });
  });

  socket.on('chat message', async (message) => {
    if (socket.room) {
      const msgData = {
        username: socket.username,
        message: message,
        room: socket.room,
        timestamp: new Date(),
      };

      await messagesCollection.insertOne(msgData);

      io.to(socket.room).emit('chat message', msgData);
    }
  });

  socket.on('disconnect', () => {
    if (socket.room) {
      socket.to(socket.room).emit('chat message', {
        username: 'Server',
        message: `${socket.username} left the room.`,
      });
    }
    console.log('A user disconnected');
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
