const express = require("express");
const passport = require("passport");
const User = require("../models/User");

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("http://localhost:3000/profile");
  }
);

router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("http://localhost:3000/");
  });
});

// Route to update user additional information
router.post("/update-profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const { industry, skills, experience } = req.body;

  try {
    const user = await User.findById(req.user.id);
    user.industry = industry;
    user.skills = skills;
    user.experience = experience;
    await user.save();

    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    res.status(500).json({ error: "Error updating profile" });
  }
});

// Endpoint to fetch authenticated user data
router.get("/profile", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "User not authenticated" });
  }
  res.json(req.user);
});

module.exports = router;
