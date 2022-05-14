const express = require('express')
const cors = require('cors');
const app = express()
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const res = require('express/lib/response');
const port = process.env.PORT || 5000
app.use(cors());
app.use(express.json())
app.get('/', (req, res) => {
    res.send('Hello from doctor uncle!')
})



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.f1eax.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
console.log(uri)
async function run() {

    try {
        await client.connect();
        console.log('Db is connected');
        const servicesCollection = client.db("doctors_portal").collection("services");
        const bookingCollection = client.db("doctors_portal").collection("booking");
        app.get("/service", async (req, res) => {
            const query = {}
            const cursor = servicesCollection.find(query)
            const services = await cursor.toArray();
            res.send(services)
        });
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
    }
    finally {

    }
}
run().catch(console.dir)

app.listen(port, () => {
    console.log(`Doctors app listening on port ${port}`)
})