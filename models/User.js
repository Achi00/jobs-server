const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  displayName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  photoUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  industry: { type: String },
  skills: [{ type: String }],
  experience: [
    {
      title: { type: String },
      company: { type: String },
      startDate: { type: Date },
      endDate: { type: Date },
      description: { type: String },
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
