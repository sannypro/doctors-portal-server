const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express()
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const res = require('express/lib/response');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const { query } = require('express');
const port = process.env.PORT || 5000
app.use(cors());
app.use(express.json())
app.get('/', (req, res) => {
    res.send('Hello from doctor uncle!')
})


function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;


    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbbiden access' })
        }
        req.decoded = decoded;
        next()
    });
}
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.f1eax.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
console.log(uri)
async function run() {

    try {
        await client.connect();
        console.log('Db is connected');
        const servicesCollection = client.db("doctors_portal").collection("services");
        const bookingCollection = client.db("doctors_portal").collection("booking");
        const userCollection = client.db("doctors_portal").collection("user");
        const doctorsCollection = client.db("doctors_portal").collection("doctors");
        const paymentsCollection = client.db("doctors_portal").collection("payments");
        app.get("/service", async (req, res) => {
            const query = {}
            const cursor = servicesCollection.find(query).project({ name: 1 })
            const services = await cursor.toArray();
            res.send(services)
        });

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === "admin") {
                next()
            }
            else {
                res.status(403).send({ message: 'Forbbiden' });
            }
        }
        app.post('/booking', async (req, res) => {
            const booking = req.body;

            console.log(booking);
            const query = {
                treatment
                    : booking.treatment, date: booking.date, slot: booking.slot, patientEmail: booking.patientEmail
            }
            console.log(query);
            const exists = await bookingCollection.findOne(query)

            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            else {
                const result = await bookingCollection.insertOne(booking);
                res.send({ success: true, result })
            }
        })
        app.post('/create-payment-intent', async (req, res) => {
            const service = req.body
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']


            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })
        app.get('/available', async (req, res) => {
            const date = req.query.date

            const services = await servicesCollection.find().toArray();
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray();
            services.forEach(service => {
                const serviceBooking = bookings.filter(b => b.treatment === service.name)
                const booked = serviceBooking.map(s => s.slot);
                service.booked = booked;
                const available = service.slots.filter(s => !booked.includes(s))
                service.slots = available
            })
            res.send(services)
        })
        app.get('/users', verifyToken, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)

        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true };
            const updatedDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ result, token })
        })
        app.put('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;


            const filter = { email: email }

            const updatedDoc = {
                $set: { role: 'admin' }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send(result)



        })
        app.get('/doctors', verifyToken, verifyAdmin, async (req, res) => {
            const doctors = await doctorsCollection.find().toArray();

            res.send(doctors)
        })
        app.delete('/doctor/:email', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const result = await doctorsCollection.deleteOne(filter)

            res.send(result)
        })
        app.post('/doctors', verifyToken, verifyAdmin, async (req, res) => {
            const doctor = req.body
            const result = await doctorsCollection.insertOne(doctor)
            res.send(result)
        })
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email

            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        });
        app.get('/booking/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const booking = await bookingCollection.findOne(query);
            res.send(booking)
        })
        app.get('/dashboard', verifyToken, async (req, res) => {
            const patientEmail = req.query.patientEmail;
            const decodeEmail = req.decoded.email;
            if (patientEmail === decodeEmail) {
                const query = { patientEmail: patientEmail };
                const bookings = await bookingCollection.find(query).toArray();
                res.send(bookings)
            }
            else {
                return res.status(403).send({ message: 'Forbbiden access' })
            }


        })
        app.put('/booking/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const payment = req.body
            console.log(payment);
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc)
            const result = await paymentsCollection.insertOne(payment)
            res.send(updatedDoc)
        })
    }
    finally {

    }
}
run().catch(console.dir)

app.listen(port, () => {
    console.log(`Doctors app listening on port ${port}`)
})