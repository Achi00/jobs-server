const express = require("express");
const { authenticateUser } = require("../utils");
const User = require("../models/User");
const axios = require("axios");
const scrapeLinkedInJobs = require("../utils/LinkedinScraper");
const Job = require("../models/Jobs");

const router = express.Router();

// Middleware to validate ObjectId
const validateObjectId = (req, res, next) => {
  const userId = req.params.userId;
  if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: "Invalid user ID format" });
  }
  next();
};

// scrape linkedin jobs
router.post("/scrape", async (req, res) => {
  const { query, options } = req.body;
  try {
    await scrapeLinkedInJobs(query, options);
    res.status(200).json({ message: "Scraping job data completed" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error scraping job data", error });
  }
});

// get all jobs
router.get("/getjobs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const jobs = await Job.find().skip(skip).limit(limit);
    const totalJobs = await Job.countDocuments();
    const totalPages = Math.ceil(totalJobs / limit);

    res.status(200).json({
      jobs,
      currentPage: page,
      totalPages,
      totalJobs,
      itemsPerPage: limit,
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "An error occurred while fetching jobs" });
  }
});
// featured jobs for user
router.get("/featuredjobs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const userId = req.query.userId; // Assuming you pass the user ID as a query parameter

    // Fetch the user's skills
    const user = await User.findById(userId);
    const userSkills = user
      ? user.skills.map((skill) => skill.toLowerCase())
      : [];

    // Fetch all jobs
    const jobs = await Job.find().lean();

    // Calculate relevance score for each job
    const scoredJobs = jobs.map((job) => {
      const jobSkills = job.skills.map((skill) => skill.toLowerCase());
      const matchingSkills = jobSkills.filter((skill) =>
        userSkills.includes(skill)
      );
      const relevanceScore = matchingSkills.length / jobSkills.length;
      return { ...job, relevanceScore };
    });

    // Sort jobs by relevance score
    scoredJobs.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Paginate the results
    const paginatedJobs = scoredJobs.slice(skip, skip + limit);

    const totalJobs = jobs.length;
    const totalPages = Math.ceil(totalJobs / limit);

    res.status(200).json({
      jobs: paginatedJobs,
      currentPage: page,
      totalPages,
      totalJobs,
      itemsPerPage: limit,
    });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching featured jobs" });
  }
});

// get job based on id
router.get("/getjobs/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.status(200).json(job);
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ error: "An error occurred while fetching the job" });
  }
});

// delete all jobs
router.delete("/deleteAllJobs", async (req, res) => {
  try {
    const result = await Job.deleteMany({});
    res.json({ message: `Deleted ${result.deletedCount} jobs` });
  } catch (error) {
    res.status(500).json({ error: "An error occurred while deleting jobs" });
  }
});

// Get user profile
// router.get(
//   "/linkedin/:userId",
//   authenticateUser,
//   validateObjectId,
//   async (req, res) => {
//     try {
//       const userId = req.params.userId;

//       // Check if authenticated user matches requested user or has admin privileges
//       if (req.user.id !== userId && !req.user.isAdmin) {
//         return res.status(403).json({ error: "Forbidden" });
//       }

//       const user = await User.findById(userId);
//       if (!user) {
//         return res.status(404).json({ error: "User not found" });
//       }

//       const keywords = user.skills;
//       console.log(keywords);

//       res.status(200).json({ keywords });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//     //   const options = {
//     //     method: "GET",
//     //     url: "https://linkedin-data-api.p.rapidapi.com/search-jobs-v2",
//     //     params: {
//     //       keywords: keywords,
//     //       datePosted: "anyTime",
//     //       sort: "mostRelevant",
//     //     },
//     //     headers: {
//     //       "x-rapidapi-key": process.env.RAPIDAPI_KEY,
//     //       "x-rapidapi-host": process.env.RAPIDAPI_HOST,
//     //     },
//     //   };
//     //   try {
//     //     if (!process.env.RAPIDAPI_KEY && !process.env.RAPIDAPI_HOST) return;
//     //     const response = await axios.request(options);
//     //     res.json(response.data);
//     //   } catch (error) {
//     //     res.status(500).json({ error: "Failed to fetch user profile" });
//     //   }
//   }
// );

module.exports = router;
