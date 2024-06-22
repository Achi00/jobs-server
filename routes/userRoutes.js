const express = require("express");
const User = require("../models/User");
const { authenticateUser } = require("../utils");

const router = express.Router();

// Get user profile
router.get("/profile", authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

// Update user profile
router.post("/profile", authenticateUser, async (req, res) => {
  try {
    const { displayName, email, photoUrl, skills, experience } = req.body;

    const updatedData = {
      displayName,
      email,
      photoUrl,
      skills,
      experience,
    };

    const user = await User.findByIdAndUpdate(req.user.id, updatedData, {
      new: true,
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

module.exports = router;
