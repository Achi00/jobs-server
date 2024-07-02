const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  company: String,
  location: String,
  date: Date,
  link: String,
  applyLink: String,
  companyLogo: String,
  jobTitle: String,
  description: String,
  skills: String,
  descriptionHTML: { type: String, maxLength: 16777216 },
  jobInfo: String,
  salary: String,
  jobType: String,
  locationType: String,
  employees: String,
});

module.exports = mongoose.model("Job", jobSchema);
