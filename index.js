require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = process.env.MONGODB_URI;

// Mongo Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    console.log("MongoDB Connected");

    const db = client.db("medicare");

    // Collection Example
    const usersCollection = db.collection("users");

    // Test Route
    app.get("/", (req, res) => {
      res.send("MediCare Server Running");
    });

    // Get Users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Add User
    app.post("/users", async (req, res) => {
      const user = req.body;

      const result = await usersCollection.insertOne(user);

      res.send(result);
    });

    // Ping Database
    await db.command({ ping: 1 });

    console.log("Pinged MongoDB Successfully");
  } catch (error) {
    console.error(" MongoDB Error:", error);
  }
}

run();

app.listen(port, () => {
  console.log(`Server Running On Port ${port}`);
});