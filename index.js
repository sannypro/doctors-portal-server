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
        app.get("/service", async (req, res) => {
            const query = {}
            const cursor = servicesCollection.find(query)
            const services = await cursor.toArray();
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