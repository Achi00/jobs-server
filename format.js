const fs = require("fs");
const cheerio = require("cheerio");

function parseJobData(html) {
  const $ = cheerio.load(html);
  const jobData = {};

  // Find the main content div
  const mainContent = $(".show-more-less-html__markup");

  // Extract job title (assuming it's the first strong tag)
  jobData.jobTitle = mainContent.find("strong").first().text().trim();

  // Extract all sections
  const sections = [];
  let currentSection = { title: "", content: [] };

  mainContent.children().each((i, elem) => {
    if (elem.name === "strong") {
      if (currentSection.title) {
        sections.push(currentSection);
      }
      currentSection = { title: $(elem).text().trim(), content: [] };
    } else if (elem.name === "ul") {
      currentSection.content.push(
        $(elem)
          .find("li")
          .map((i, li) => $(li).text().trim())
          .get()
      );
    } else {
      const text = $(elem).text().trim();
      if (text) {
        currentSection.content.push(text);
      }
    }
  });

  if (currentSection.title) {
    sections.push(currentSection);
  }

  // Assign sections to jobData
  sections.forEach((section) => {
    const key = section.title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    jobData[key] = Array.isArray(section.content[0])
      ? section.content[0]
      : section.content.join("\n");
  });

  // Extract salary range
  const salaryMatch = mainContent
    .text()
    .match(/The range for this role is ([\$\d,]+\s*-\s*[\$\d,]+)/);
  if (salaryMatch) {
    jobData.salary_range = salaryMatch[1];
  }

  return jobData;
}

function jobDataToString(jobData) {
  let output = "";
  for (const [key, value] of Object.entries(jobData)) {
    output += `${key.replace(/_/g, " ").toUpperCase()}:\n`;
    if (Array.isArray(value)) {
      output += value.map((item) => `- ${item}`).join("\n");
    } else {
      output += value;
    }
    output += "\n\n";
  }
  return output.trim();
}

function parseAndSaveJob(inputFile, outputFile) {
  try {
    const htmlContent = fs.readFileSync(inputFile, "utf8");
    const jobData = parseJobData(htmlContent);
    const outputContent = jobDataToString(jobData);
    fs.writeFileSync(outputFile, outputContent);
    console.log(`Job data has been parsed and saved to ${outputFile}`);
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

// Usage
const inputFile = "./html.txt";
const outputFile = "./output.txt";
parseAndSaveJob(inputFile, outputFile);
