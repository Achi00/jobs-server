const mongoose = require("mongoose");
const { Schema } = mongoose;

const jobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  company: String,
  location: String,
  otherData: String,
  date: Date,
  jobDetailPreferences: String,
  link: String,
  applyLink: String,
  companyLogo: String,
  jobTitle: String,
  description: String,
  skills: Schema.Types.Mixed,
  descriptionHTML: { type: String, maxLength: 16777216 },
  jobInfo: String,
  salary: String,
  jobType: String,
  locationType: String,
  employees: String,
  experiences: { type: [String] },
  knowledge: { type: [String] },
  relevanceScore: { type: Number },
});

module.exports = mongoose.model("Job", jobSchema);
