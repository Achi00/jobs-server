const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  title: String,
  company: String,
  location: String,
  date: Date,
  link: String,
  applyLink: String,
  insights: [String],
  companyLogo: String,
  jobTitle: String,
  experienceLevel: String,
  description: String,
  skills: String,
  location: String,
  descriptionHTML: { type: String, maxLength: 16777216 },
  mt2mb2Content: String,
});

module.exports = mongoose.model("Job", jobSchema);
