const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authrization = req.headers.authorization;


    if (!authrization) {
        return res.status(401).send({ error: true, message: "unauthorised Access" });
    }


    const token = authrization.split(" ")[1];


    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "unauthorised Access" })
        }
        req.decoded = decoded;
        next();
    })


}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hbpsi8j.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();


        const classCollection = client.db('sunshineDb').collection('classes');
        const userCollection = client.db('sunshineDb').collection('users');
        const instructorCollection = client.db('sunshineDb').collection('instructors');
        const selectedClassCollections = client.db("sunshineDb").collection("selectedClass");
        const paymentsCollections = client.db("sunshineDb").collection("payments");

        // jwt token:
        app.post("/jwt", (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "24hr"
            })
            res.send({ token })
        })

        // middle wire for verifyAdmin:
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded?.email;
            const query = { email: email };
            const user = await userCollection.findOne(query)
            if (user?.role !== "admin") {
                return res.status(403).send({ error: true, message: "forbidded Access" });
            }
            next();
        }


        // middle wire for verifyInstructor:
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded?.email;
            const query = { email: email };
            const user = await userCollection.findOne(query)
            if (user?.role !== "instructor") {
                return res.status(403).send({ error: true, message: "forbidded Access" });
            }
            next();
        }


        // check if a user is admin or not
        app.get("/users/admin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { admin: user?.role === "admin" };
            console.log(result)
            res.send(result);
        })


        // check if a user is instructor or not:
        app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            const result = { instructor: user?.role === "instructor" };
            res.send(result);
        })

        //getting classes
        app.get("/classes", async (req, res) => {
            const result = await classCollection.find().sort({ totalStudents: -1 }).toArray();
            res.send(result);

        })

        // get single class Info:
        app.get("/classes/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classCollection.findOne(query);
            res.send(result);
        })

        //getting instructor
        app.get('/instructors', async (req, res) => {
            const instructors = await instructorCollection.find().toArray();
            res.send(instructors);
        });


        //getting all user
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            console.log(result)
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await userCollection.insertOne(user);
            console.log(result)
            res.send(result);
        });


        //admin route api

        // get api for users:
        app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {

            const result = await userCollection.find().toArray();
            res.send(result);

        })

        // make admin:
        app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const updatedDoc = {
                $set: {
                    role: "admin"
                },
            }

            const result = await userCollection.updateOne(query, updatedDoc);
            res.send(result);

        })


        // make instructor:

        app.patch("/users/instructor/:id", verifyJWT, verifyAdmin, async (req, res) => {

            const id = req.params.id;

            const query = { _id: new ObjectId(id) }

            const updatedDoc = {
                $set: {
                    role: "instructor"
                },
            }
            const result = await userCollection.updateOne(query, updatedDoc);

            const instructor = req.body;
            const teacher = {
                image: instructor.image,
                name: instructor.name,
                email: instructor.email
            }
            const instructorResult = await instructorCollection.insertOne(teacher);

            res.send({ result, instructorResult });

        })

        // approved course:

        app.patch("/classes/approved/:id", verifyJWT, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const updatedDoc = {
                $set: {
                    status: "approved"
                },
            }

            const result = await classCollection.updateOne(query, updatedDoc);
            res.send(result);

        })

        // deny course:

        app.patch("/classes/deny/:id", verifyJWT, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const updatedDoc = {
                $set: {
                    status: "deny"
                },
            }

            const result = await classCollection.updateOne(query, updatedDoc);
            res.send(result);

        })


        // send Feedback:

        app.patch("/classes/feedback/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const feedback = req.body;

            const query = { _id: new ObjectId(id) }

            const updatedDoc = {
                $set: {
                    feedback: feedback.feedback
                },
            }

            const result = await classCollection.updateOne(query, updatedDoc);
            res.send(result);

        })


        // instructor api

        // add class:

        app.post("/classes", verifyJWT, verifyInstructor, async (req, res) => {

            const newClass = req.body;
            const result = await classCollection.insertOne(newClass);
            res.send(result);

        })

        // my classes:

        app.get("/myclasses/:email", verifyJWT, verifyInstructor, async (req, res) => {

            const email = req.params.email;

            const query = { instructorEmail: email };

            const result = await classCollection.find(query).toArray();
            res.send(result);

        })

        // update myclasses:

        app.patch("/myclasses/:id", verifyJWT, verifyInstructor, async (req, res) => {

            const id = req.params.id;
            const updatedInfo = req.body;

            const query = { _id: new ObjectId(id) }


            const updatedDoc = {
                $set: {
                    name: updatedInfo.name,
                    image: updatedInfo.image,
                    availableSeats: updatedInfo.availableSeats,
                    price: updatedInfo.price
                },
            }

            const result = await classCollection.updateOne(query, updatedDoc);
            res.send(result);

        })

        //student api

        // add selected class

        app.post("/selectedClass", async (req, res) => {

            const selectedClass = req.body;
            const result = await selectedClassCollections.insertOne(selectedClass);
            res.send(result);

        })

        // get selected class

        app.get("/selectedClass", verifyJWT, async (req, res) => {

            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: "forbidden Access" });
            }

            const query = { studentEmail: email }
            const result = await selectedClassCollections.find(query).toArray();
            res.send(result);

        })

        // delete seleted class

        app.delete("/selectedClass/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedClassCollections.deleteOne(query);
            res.send(result);
        })

        // get single slected Class:
        app.get("/selectedClass/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollections.findOne(query);
            res.send(result);
        })




        //-------- payment apis---------:

        // creating payment intent

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // payment api:
        app.post("/payments", verifyJWT, async (req, res) => {

            const payment = req.body;
            const insertedResult = await paymentsCollections.insertOne(payment);

            const query = { _id: new ObjectId(payment.selectedClassId) };
            const deleteResult = await selectedClassCollections.deleteOne(query);


            const updateQuery = { _id: new ObjectId(payment.classId) }
            const paidClass = await classCollection.findOne(updateQuery);
            const updatedDoc = {
                $set: {
                    availableSeats: paidClass.availableSeats - 1,
                    totalStudents: paidClass.totalStudents + 1
                },
            }
            const updateResult = await classCollection.updateOne(updateQuery, updatedDoc);

            res.send({ insertedResult, deleteResult, updateResult });
        })


        // get Enrolled Class:
        app.get("/enrolledClasses", verifyJWT, async (req, res) => {

            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: "forbidden Access" });
            }

            const query = { studentEmail: email }
            const result = await paymentsCollections.find(query).sort({ date: -1 }).toArray();
            res.send(result);

        })




        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Summer camp is starting')
})

app.listen(port, () => {
    console.log(`Summer is starting on port ${port}`);
})