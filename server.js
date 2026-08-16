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

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'DEBUG';

app.post('/webhook/payment', (req, res) => {
    const shasum = crypto.createHmac('sha256', WEBHOOK_SECRET);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (req.headers['x-razorpay-signature'] !== digest && WEBHOOK_SECRET !== 'DEBUG') {
        return res.status(403).send('Invalid signature');
    }

    try {
        const paymentEntity = req.body.payload.payment.entity;
        const amountInRupees = paymentEntity.amount / 100;
        
        const autoId = (paymentEntity.notes && paymentEntity.notes.autoId) ? paymentEntity.notes.autoId : 'AUTO_001';

        io.to(autoId).emit('payment_received', { amount: amountInRupees });
        res.sendStatus(200);
    } catch (error) {
        res.status(400).send('Bad Request');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log("Server running");
});