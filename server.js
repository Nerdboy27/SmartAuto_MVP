
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
    socket.on('register_device', (autoId) => {
        socket.join(autoId);
    });
});

app.post('/webhook/payment', (req, res) => {
    const { autoId, amount, status } = req.body;
    if (status === 'success') {
        io.to(autoId).emit('payment_received', { amount });
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log("Server running");
});

