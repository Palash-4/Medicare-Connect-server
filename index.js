require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");

const stripe = require("stripe")(
  process.env.STRIPE_SECRET_KEY
);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

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
    console.log("MongoDB Connected");
    const db = client.db("medicare");
    const userCollection =
      db.collection("user");
    const doctorCollection =
      db.collection("doctors");
    const appointmentCollection =
      db.collection("appointments");
    const reviewCollection =
      db.collection("reviews");
    const paymentCollection =
      db.collection("payments");
    const patientCollection =
      db.collection("patients");


    //Profile Routes

    app.get(
      "/api/users/:email",
      async (req, res) => {
        const email = req.params.email;

        const result =
          await userCollection.findOne({
            email,
          });

        res.send(result || {});
      }
    );

    app.put(
      "/api/users/:email",
      async (req, res) => {
        const email = req.params.email;
        const profile = req.body;

        const result =
          await userCollection.updateOne(
            {
              email,
            },
            {
              $set: {
                name: profile.name,
                email: profile.email,
                image: profile.image,
                role:
                  profile.role ||
                  "patient",
                updatedAt:
                  new Date(),
                status: "active",
                createdAt: new Date(),
              },
            },
            {
              upsert: true,
            }
          );

        res.send(result);
      }
    );


    //Get All Users

    app.get(
      "/api/users",
      async (req, res) => {
        const result =
          await userCollection
            .find()
            .toArray();

        res.send(result);
      }
    );

    //Suspend User
    app.patch(
      "/api/users/status/:id",
      async (req, res) => {
        try {
          const id = req.params.id;
          const { status } = req.body;

          const result =
            await userCollection.updateOne(
              {
                _id: new ObjectId(id),
              },
              {
                $set: {
                  status,
                },
              }
            );

          res.send(result);
        } catch (error) {
          res.status(500).send({
            message: error.message,
          });
        }
      }
    );


    //Delete User
    app.delete(
      "/api/users/:id",
      async (req, res) => {
        const id =
          req.params.id;

        const result =
          await userCollection.deleteOne(
            {
              _id:
                new ObjectId(id),
            }
          );

        res.send(result);
      }
    );

    //Doctor Routes
    app.post(
      "/api/doctors",
      async (req, res) => {
        const result =
          await doctorCollection.insertOne(
            {
              ...req.body,
              verificationStatus:
                "pending",
              createdAt:
                new Date(),
            }
          );

        res.send(result);
      }
    );

    app.get(
      "/api/doctors",
      async (req, res) => {
        const result =
          await doctorCollection
            .find()
            .toArray();

        res.send(result);
      }
    );

    app.patch(
      "/api/doctors/status/:id",
      async (req, res) => {
        const id = req.params.id;
        const { status } = req.body;
        const result =
          await doctorCollection.updateOne(
            {
              _id: new ObjectId(id),
            },
            {
              $set: {
                verificationStatus:
                  status,
              },
            }
          );

        res.send(result);
      }
    );


    //Appointment Create

    app.post(
      "/api/appointments",
      async (req, res) => {
        try {
          const {
            patientEmail,
            doctorEmail,
            appointmentDate,
            appointmentTime,
          } = req.body;

          const exists =
            await appointmentCollection.findOne(
              {
                patientEmail,
                doctorEmail,
                appointmentDate,
                appointmentTime,
              }
            );

          if (exists) {
            return res
              .status(400)
              .send({
                message:
                  "Appointment already exists",
              });
          }

          const result =
            await appointmentCollection.insertOne(
              {
                ...req.body,
                appointmentStatus:
                  "pending",
                paymentStatus:
                  "unpaid",
                createdAt:
                  new Date(),
              }
            );

          res.send(result);
        } catch (error) {
          res.status(500).send({
            message:
              error.message,
          });
        }
      }
    );

    //Patient Appointments
    app.get(
      "/api/dashboard/patient",
      async (req, res) => {
        try {
          const appointments =
            await appointmentCollection.countDocuments();

          const doctors =
            await doctorCollection.countDocuments();

          const reviews =
            await reviewCollection.find().toArray();

          const rating =
            reviews.length > 0
              ? (
                reviews.reduce(
                  (sum, item) =>
                    sum + item.rating,
                  0
                ) / reviews.length
              ).toFixed(1)
              : 0;

          // Prescription collection নাই,
          // তাই আপাতত 0 দিচ্ছি
          const records = 0;

          res.send({
            appointments,
            doctors,
            records,
            rating,
          });
        } catch (error) {
          console.log(error);

          res.status(500).send({
            message: error.message,
          });
        }
      }
    );
    app.get(
      "/api/appointments/:email",
      async (req, res) => {
        const email =
          req.params.email;

        const result =
          await appointmentCollection
            .find({
              patientEmail:
                email,
            })
            .toArray();

        res.send(result);
      }
    );

    app.post(
      "/api/create-payment-intent",
      async (req, res) => {
        try {
          const { amount } = req.body;

          const paymentIntent =
            await stripe.paymentIntents.create({
              amount: Math.round(
                amount * 100
              ),
              currency: "usd",
              automatic_payment_methods:
              {
                enabled: true,
              },
            });

          res.send({
            clientSecret:
              paymentIntent.client_secret,
          });
        } catch (error) {
          res.status(500).send({
            message: error.message,
          });
        }
      }
    );

    app.post(
      "/api/payments",
      async (req, res) => {
        try {
          const payment = req.body;

          const result =
            await paymentCollection.insertOne({
              ...payment,
              paymentDate: new Date(),
            });

          await appointmentCollection.updateOne(
            {
              _id: new ObjectId(
                payment.appointmentId
              ),
            },
            {
              $set: {
                paymentStatus: "paid",
              },
            }
          );

          res.send(result);
        } catch (error) {
          res.status(500).send({
            message: error.message,
          });
        }
      }
    );

   app.patch(
  "/api/payments/:id",
  async (req, res) => {
    try {
      const id =
        req.params.id;

      const filter = {
        _id: new ObjectId(
          id
        ),
      };

      const updateDoc = {
        $set: {
          paymentStatus:
            "paid",
        },
      };

      const result =
        await appointmentCollection.updateOne(
          filter,
          updateDoc
        );

      res.send(result);
    } catch (error) {
      console.log(error);

      res.status(500).send({
        message:
          "Payment update failed",
      });
    }
  }
);

    //Doctor Appointments
    app.get(
      "/api/doctor-appointments/:email",
      async (req, res) => {
        const email =
          req.params.email;

        const result =
          await appointmentCollection
            .find({
              doctorEmail:
                email,
            })
            .sort({
              createdAt: -1,
            })
            .toArray();

        res.send(result);
      }
    );

    app.get(
      "/api/payments",
      async (req, res) => {
        try {
          const result =
            await paymentCollection
              .find()
              .sort({
                paymentDate: -1,
              })
              .toArray();

          res.send(result);
        } catch (error) {
          res.status(500).send({
            message: error.message,
          });
        }
      }
    );

    // Doctor Patients
    app.get(
      "/api/doctor-patients/:email",
      async (req, res) => {
        try {
          const email = req.params.email;

          const result =
            await appointmentCollection
              .find({
                doctorEmail: email,
                paymentStatus: "paid",
              })
              .sort({
                createdAt: -1,
              })
              .toArray();

          res.send(result);
        } catch (error) {
          console.log(error);

          res.status(500).send({
            message: error.message,
          });
        }
      }
    );

    //Update Appointment Status
    app.patch(
      "/api/appointments/status/:id",
      async (req, res) => {
        const id =
          req.params.id;

        const { status } =
          req.body;

        const allowedStatus = [
          "pending",
          "accepted",
          "rejected",
          "completed",
        ];

        if (
          !allowedStatus.includes(
            status
          )
        ) {
          return res
            .status(400)
            .send({
              message:
                "Invalid status",
            });
        }

        const result =
          await appointmentCollection.updateOne(
            {
              _id:
                new ObjectId(id),
            },
            {
              $set: {
                appointmentStatus:
                  status,
              },
            }
          );

        res.send(result);
      }
    );

    //Delete Appointment
    app.delete(
      "/api/appointments/:id",
      async (req, res) => {
        const id =
          req.params.id;

        const appointment =
          await appointmentCollection.findOne({
            _id: new ObjectId(id),
          });

        if (!appointment) {
          return res.status(404).send({
            message: "Appointment not found",
          });
        }

        if (
          appointment.paymentStatus ===
          "paid"
        ) {
          return res.status(400).send({
            message:
              "Paid appointment cannot be cancelled",
          });
        } {
          return res.status(400).send({
            message:
              "Paid appointment cannot be cancelled",
          });
        }

        const result =
          await appointmentCollection.deleteOne({
            _id: new ObjectId(id),
          });

        res.send(result);
      }
    );

    //Reviews
    app.post(
      "/api/reviews",
      async (req, res) => {
        const result =
          await reviewCollection.insertOne(
            req.body
          );

        res.send(result);
      }
    );

    app.get(
      "/api/reviews",
      async (req, res) => {
        const result =
          await reviewCollection
            .find()
            .toArray();

        res.send(result);
      }
    );

    //Patient Dashboard
    app.get(
      "/api/dashboard/patient/:email",
      async (req, res) => {
        const email =
          req.params.email;

        const appointments =
          await appointmentCollection.countDocuments(
            {
              patientEmail:
                email,
            }
          );

        const reviews =
          await reviewCollection.countDocuments(
            {
              patientEmail:
                email,
            }
          );

        const payments =
          await paymentCollection.countDocuments(
            {
              patientEmail:
                email,
            }
          );

        res.send({
          appointments,
          reviews,
          payments,
        });
      }
    );

    //Doctor Dashboard
    app.get(
      "/api/dashboard/doctor/:email",
      async (req, res) => {
        const email =
          req.params.email;

        const appointments =
          await appointmentCollection
            .find({
              doctorEmail:
                email,
            })
            .toArray();

        const uniquePatients =
          new Set(
            appointments.map(
              (a) =>
                a.patientEmail
            )
          );

        const reviews =
          await reviewCollection
            .find({
              doctorEmail:
                email,
            })
            .toArray();

        const averageRating =
          reviews.length > 0
            ? (
              reviews.reduce(
                (
                  sum,
                  r
                ) =>
                  sum +
                  Number(
                    r.rating ||
                    0
                  ),
                0
              ) /
              reviews.length
            ).toFixed(1)
            : 0;

        res.send({
          totalPatients:
            uniquePatients.size,
          todayAppointments:
            appointments.filter(
              (a) =>
                a.appointmentStatus ===
                "accepted"
            ).length,
          averageRating,
        });
      }
    );

    //Admin Dashboard
    app.get(
      "/api/dashboard/admin",
      async (req, res) => {
        const totalDoctors =
          await userCollection.countDocuments(
            {
              role:
                "doctor",
            }
          );

        const totalPatients =
          await userCollection.countDocuments(
            {
              role:
                "patient",
            }
          );

        const totalAdmins =
          await userCollection.countDocuments(
            {
              role:
                "admin",
            }
          );

        const totalAppointments =
          await appointmentCollection.countDocuments();

        const totalPayments =
          await paymentCollection.countDocuments();

        res.send({
          totalDoctors,
          totalPatients,
          totalAdmins,
          totalAppointments,
          totalPayments,
        });
      }
    );

    //Admin Appointments

    app.get(
      "/api/admin/appointments",
      async (req, res) => {
        const result =
          await appointmentCollection
            .find()
            .sort({
              createdAt: -1,
            })
            .toArray();

        res.send(result);
      }
    );

    app.delete(
      "/api/admin/appointments/:id",
      async (req, res) => {
        const id =
          req.params.id;

        const result =
          await appointmentCollection.deleteOne(
            {
              _id:
                new ObjectId(id),
            }
          );

        res.send(result);
      }
    );



    console.log(
      "MongoDB Connected Successfully"
    );
  } catch (error) {
    console.log(error);
  }
}

run();

app.get("/", (req, res) => {
  res.send(
    "MediCare Server Running"
  );
});


app.listen(port, () => {
  console.log(
    `Server Running On ${port}`
  );
});

