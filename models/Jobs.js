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
  jobLocation: String,
  salary: String,
  jobType: String,
  experienceLevel: String,
  description: String,
  skills: String,
  descriptionHTML: String,
});

module.exports = mongoose.model("Job", jobSchema);
