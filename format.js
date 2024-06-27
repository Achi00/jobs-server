const cheerio = require("cheerio");
const _ = require("lodash");

function extractJobData(html) {
  const $ = cheerio.load(html);

  const jobTitle = $(".description__job-title").text().trim();
  const jobLocation = $(".description__job-criteria-text").eq(0).text().trim();

  const salaryElement = $(".description__text").find(
    'p:contains("anticipated TTC range")'
  );
  const salary = salaryElement.length
    ? salaryElement.text().trim()
    : "Not specified";

  const jobType =
    $(".description__job-criteria-text").eq(1).text().trim() || "Not specified";

  const experienceLevelElement = $(".description__job-criteria-text").eq(2);
  const experienceLevel = experienceLevelElement.length
    ? experienceLevelElement.text().trim()
    : "Not specified";

  const descriptionElement = $(".show-more-less-html__markup");
  const description = descriptionElement.length
    ? descriptionElement.text().trim()
    : "Not available";

  const skills = [];
  $(".description__text ul").each((i, ul) => {
    $(ul)
      .find("li")
      .each((j, li) => {
        skills.push($(li).text().trim());
      });
  });

  return {
    jobTitle,
    jobLocation,
    salary,
    jobType,
    experienceLevel,
    description,
    skills: _.uniq(skills),
  };
}

// Usage
const fs = require("fs");
const htmlContent = fs.readFileSync("./html.txt", "utf8");
const jobData = extractJobData(htmlContent);
console.log(JSON.stringify(jobData, null, 2));
