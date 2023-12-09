require("dotenv").config();

const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
app.use(express.json());
app.use(cors());

// database

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri =
  "mongodb+srv://contest:cTEQ2oHjrf3mAPyF@cluster0.03occsr.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const contestCollection = client.db("contestDB").collection("contests");
    const usersCollection = client.db("contestDB").collection("users");
    const paymentCollection = client.db("contestDB").collection("payment");


    // JWT

    app.post("/jwt", async(req,res)=>{
        const user = req.body;
        const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{expiresIn:"1h"})
        res.send({token})
    })

    // // middleware
    // const verifyToken = (req,res,next) => {
    //   console.log(req.headers);
    // }



    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseFloat(price * 100);
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // post payment data

    app.post("/contest/payment", async (req, res) => {
      const conInfo = req.body;
      const result = paymentCollection.insertOne(conInfo);
      res.send(result);
    });

    app.patch("/payment/:id", (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateOne = {
        $set: {
          status: "won",
        },
      };
      const result = paymentCollection.updateOne(filter, updateOne);
      res.send(result);
    });

    // get contest by email
    app.get("/payment", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    
    // get total winners
    app.get("/totalWinners", async (req, res) => {
      const result = await paymentCollection.find({ status: "won" }).toArray();
      res.send(result);
    });
    app.get("/contestWinner", async(req,res)=>{
      const result = await paymentCollection.find().toArray();
      res.send(result);
    })
    // winner delare
    app.patch("/contest/payment", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await paymentCollection.insertOne(query);

      res.send(result);
    });
    // registerd user all
    app.get("/registerdContests", async (req, res) => {

      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    // / total contest according to asnc
    app.get("/contests", async (req, res) => {
      const filter = req.query;
      console.log(filter);
      const query = {
        contestTypes:{$regex:filter.search}
      }
      const contestInfo = await contestCollection
        .find({status:"approved"},query)
        .sort({ participants: -1 })
        .toArray();
      res.send(contestInfo);
    });

    // update contest 

    app.put("/updateContest/:id", async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const options = {upsert:true}
      const contestInfo = req.body;
      console.log(contestInfo)
      const updatedDoc = {
        $set: {
          contestName:contestInfo.contestName,
          contestPrice:contestInfo.contestPrice,
          image:contestInfo.image,
          priceMoney:contestInfo.priceMoney,
          participants:contestInfo.participants,
          contestTypes:contestInfo.contestTypes,
          taskSubmission:contestInfo.taskSubmission,
          contestDeadline:contestInfo.contestDeadline,

        }
      }
      const result = await contestCollection.updateOne(filter,updatedDoc,options);
      res.send(result);
    })

    // single contest
    app.get("/contests/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await contestCollection.findOne(query);
      res.send(result);
    });

    app.get("/dashboard/contests", async (req, res) => {
      const contestInfo = await contestCollection.find().toArray();
      res.send(contestInfo);
    });

    // contest add

    app.post("/contests", async (req, res) => {
      const contestItem = req.body;
      const result = await contestCollection.insertOne(contestItem);
      res.send(result);
    });

    // participate update
    app.put("/contests/add/:id", async (req, res) => {
      const id = req.params.id;
      const updateId = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const participant = req.body;
      console.log(participant);
      const updateParticipant = {
        $set: {
          participants: participant.updateParti,
        },
      };
      const result = contestCollection.updateOne(
        updateId,
        updateParticipant,
        options
      );
      res.send(result);
    });

    app.patch("/contests/admin/:id", (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateOne = {
        $set: {
          status: "approved",
        },
      };
      const result = contestCollection.updateOne(filter, updateOne);
      res.send(result);
    });
    // delete by admin

    app.delete("/contests/admin/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = contestCollection.deleteOne(query);
      res.send(result);
    });

    // users store

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const existingUser = await usersCollection.findOne({
        email: userInfo.email,
      });
      if (existingUser) {
        return res.send({
          message: "User has already exist",
          insertedId: null,
        });
      }
      const result = await usersCollection.insertOne(userInfo);
      res.send(result);
    });

    // get user form DB
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // update to admin

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // contest get by user email
    app.get("/contestByEmail", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await contestCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

// database

app.get("/", (req, res) => {
  res.send("Hello server is running!");
});

// start server

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} at http://localhost:${PORT}`);
});
