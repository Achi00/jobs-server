require("dotenv").config();
const cors = require("cors");
const mongoose = require("mongoose");
const express = require("express");
const passportSetup = require("./config/passport-config");
const passport = require("passport");
const authRoutes = require("./routes/authRoute");
const userRoutes = require("./routes/userRoutes");
const jobsRoutes = require("./routes/jobsRoute");
const session = require("express-session");

const app = express();
// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json());

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production if using HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get("/", (req, res) => {
  res.send("hello world");
});

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/jobs", jobsRoutes);

app.get("/api/session", (req, res) => {
  console.log("Session data:", req.session);
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ message: "You are not authenticated" });
  }
});

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Schedule tasks to be run on the server
// cron.schedule("0 0 * * *", async () => {
//   console.log("Running the job scraping task...");
//   try {
//     await scrapeLinkedInJobs("Engineer", {
//       locations: ["United States"],
//       limit: 20, // Set the desired limit here
//     });
//   } catch (error) {
//     console.error("Error running scheduled job scraping task:", error);
//   }
// });
