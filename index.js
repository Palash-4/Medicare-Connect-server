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
    // await client.connect();
    // console.log("MongoDB Connected");
    const db = client.db("medicare");

    // Collection Example
    const patientCollection = db.collection("patients");
    const doctorCollection = db.collection("doctors");
    const bookingCollection = db.collection("bookings");
    const paymentCollection = db.collection("payments");
    const reviewCollection = db.collection("reviews");
    const prescriptionCollection = db.collection("prescriptions");
    const userCollection = db.collection("users");

    const appointmentCollection = db.collection("appointments");


    // await client.db('admin').command({ ping: 1 });
    app.post("/api/patients", async (req, res) => {
      try {
        const patient = req.body;
        const result = await patientCollection.insertOne({
          ...patient,
          createdAt: new Date(),
          status: "active",
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    const { ObjectId } = require("mongodb");

    app.get("/api/patients/:id", async (req, res) => {
      const id = req.params.id;

      const result = await patientCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.put("/api/patients/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;

      const result = await patientCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: data,
        }
      );

      res.send(result);
    });


    app.delete("/api/patients/:id", async (req, res) => {
      const id = req.params.id;

      const result = await patientCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.get("/api/dashboard/doctor/:email", async (req, res) => {
      try {
        const email = req.params.email;

        // Doctor Info
        const doctor = await doctorCollection.findOne({
          email: email,
        });


        if (!doctor) {
          return res.send({
            totalPatients: 0,
            todayAppointments: 0,
            averageRating: 0,
          });
        }

        // Appointments
        const appointments = await appointmentCollection
          .find({
            doctorEmail: email,
          })
          .toArray();

        const totalPatients = appointments.length;

        const todayAppointments = appointments.filter(
          (item) =>
            item.appointmentStatus === "accepted"
        ).length;

        // Reviews
        const reviews = await reviewCollection
          .find({
            doctorEmail: email,
          })
          .toArray();

        let averageRating = 0;

        if (reviews.length > 0) {
          averageRating =
            (
              reviews.reduce(
                (sum, review) =>
                  sum + Number(review.rating || 0),
                0
              ) / reviews.length
            ).toFixed(1);
        }

        res.send({
          totalPatients,
          todayAppointments,
          averageRating,
        });
      } catch (error) {
        console.log(error);

        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.post("/api/doctors", async (req, res) => {
      const doctor = req.body;

      const result = await doctorCollection.insertOne({
        ...doctor,
        verificationStatus: "pending",
        createdAt: new Date(),
      });

      res.send(result);
    });

    app.get("/api/doctors", async (req, res) => {
      const result = await doctorCollection.find().toArray();

      res.send(result);
    });

    app.patch("/api/doctors/verify/:id", async (req, res) => {
      const id = req.params.id;

      const result = await doctorCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            verificationStatus: "verified",
          },
        }
      );

      res.send(result);
    });

    app.post("/api/appointments", async (req, res) => {
      const appointment = req.body;

      const result =
        await appointmentCollection.insertOne({
          ...appointment,
          appointmentStatus: "pending",
          paymentStatus: "unpaid",
          createdAt: new Date(),
        });

      res.send(result);
    });

    app.get("/api/appointments/:email", async (req, res) => {
      const email = req.params.email;

      const result =
        await appointmentCollection
          .find({
            patientEmail: email,
          })
          .toArray();

      res.send(result);
    });

    app.delete("/api/appointments/:id", async (req, res) => {
      const id = req.params.id;

      const result =
        await appointmentCollection.deleteOne({
          _id: new ObjectId(id),
        });

      res.send(result);
    });

    app.patch("/api/appointments/:id", async (req, res) => {
      const id = req.params.id;

      const { appointmentDate, appointmentTime } =
        req.body;

      const result =
        await appointmentCollection.updateOne(
          {
            _id: new ObjectId(id),
          },
          {
            $set: {
              appointmentDate,
              appointmentTime,
            },
          }
        );

      res.send(result);
    });

    app.post("/api/reviews", async (req, res) => {
      const review = req.body;

      const result =
        await reviewCollection.insertOne(review);

      res.send(result);
    });

    app.get("/api/reviews", async (req, res) => {
      const result =
        await reviewCollection.find().toArray();

      res.send(result);
    });

    app.delete("/api/reviews/:id", async (req, res) => {
      const result =
        await reviewCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

      res.send(result);
    });

    app.get(
      "/api/dashboard/patient/:email",
      async (req, res) => {
        const email = req.params.email;

        const appointments =
          await appointmentCollection.countDocuments({
            patientEmail: email,
          });

        const reviews =
          await reviewCollection.countDocuments({
            patientEmail: email,
          });

        const payments =
          await paymentCollection.countDocuments({
            patientEmail: email,
          });

        res.send({
          appointments,
          reviews,
          payments,
        });
      }
    );


    app.get("/api/dashboard/admin", async (req, res) => {
      const totalDoctors =
        await doctorCollection.countDocuments();

      const totalPatients =
        await patientCollection.countDocuments();

      const totalAppointments =
        await appointmentCollection.countDocuments();

      const totalPayments =
        await paymentCollection.countDocuments();

      res.send({
        totalDoctors,
        totalPatients,
        totalAppointments,
        totalPayments,
      });
    });

    app.get("/api/patients", async (req, res) => {
      const result = await patientCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/doctors/:id", async (req, res) => {
      const result = await doctorCollection.findOne({
        _id: new ObjectId(req.params.id),
      });

      res.send(result);
    });

    app.put("/api/doctors/:id", async (req, res) => {
      const result = await doctorCollection.updateOne(
        {
          _id: new ObjectId(req.params.id),
        },
        {
          $set: req.body,
        }
      );

      res.send(result);
    });

    console.log("Pinged MongoDB Successfully");
  }
  catch (error) {
    console.error(" MongoDB Error:", error);
  }
}

run();

app.listen(port, () => {
  console.log(`Server Running On Port ${port}`);
});