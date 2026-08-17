const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());

const mongoURI = "mongodb+srv://bharatrana71727_db_user:aBaagvjZg5fAakpc@cluster0.tlbm2sj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(mongoURI);
let db, autosCollection, scoresCollection;

async function connectDB() {
    try { 
        await client.connect(); 
        db = client.db('SmartAutoDB'); 
        autosCollection = db.collection('autos'); 
        scoresCollection = db.collection('scores');
    } catch (err) {}
}
connectDB();

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.post('/save-score', async (req, res) => {
    const { name, score } = req.body;
    if (scoresCollection) {
        await scoresCollection.updateOne(
            { name: name },
            { $max: { score: score } },
            { upsert: true }
        );
        io.emit('leaderboard_updated');
    }
    res.sendStatus(200);
});

app.get('/leaderboard', async (req, res) => {
    if (scoresCollection) {
        const topScores = await scoresCollection.find().sort({ score: -1 }).limit(10).toArray();
        res.json(topScores);
    } else {
        res.json([]);
    }
});

io.on('connection', (socket) => {
    socket.on('register_device', async (autoId) => {
        socket.join(autoId);
        if (autosCollection) {
            let autoData = await autosCollection.findOne({ autoId: autoId });
            if (!autoData) { 
                await autosCollection.insertOne({ autoId: autoId, totalEarnings: 0 }); 
                socket.emit('update_total', { total: 0 }); 
            } else { 
                socket.emit('update_total', { total: autoData.totalEarnings }); 
            }
        }
    });
});

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'DEBUG';

app.post('/webhook/payment', async (req, res) => {
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
        let newTotal = 0;
        if (autosCollection) {
            const updateResult = await autosCollection.findOneAndUpdate(
                { autoId: autoId }, 
                { $inc: { totalEarnings: amountInRupees } }, 
                { returnDocument: 'after', upsert: true }
            );
            newTotal = updateResult.totalEarnings || amountInRupees;
        }
        io.to(autoId).emit('payment_received', { amount: amountInRupees, newTotal: newTotal });
        res.sendStatus(200);
    } catch (error) { 
        res.status(400).send('Bad Request'); 
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {});