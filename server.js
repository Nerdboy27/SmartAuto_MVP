const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

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

const WEBHOOK_SECRET = 'DEBUG'; 

app.post('/webhook/payment', (req, res) => {
    const shasum = crypto.createHmac('sha256', WEBHOOK_SECRET);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (req.headers['x-razorpay-signature'] !== digest && WEBHOOK_SECRET !== 'DEBUG') {
        return res.status(403).send('Invalid signature');
    }

    const { autoId, amount, status } = req.body;
    const AUTHORIZED_AUTOS = ['AUTO_001', 'AUTO_002', 'AUTO_003']; 

    if (status === 'success' && AUTHORIZED_AUTOS.includes(autoId)) {
        io.to(autoId).emit('payment_received', { amount });
        res.sendStatus(200);
    } else {
        res.status(400).send('Unauthorized or Invalid ID');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log("Server running");
});