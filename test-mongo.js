const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
    }
});

async function run() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });

        console.log("✅ MongoDB Connection SUCCESS!");
    } catch (error) {
        console.log("❌ MongoDB Connection FAILED!");
        console.log(error.message);
    } finally {
        await client.close();
    }
}

run();