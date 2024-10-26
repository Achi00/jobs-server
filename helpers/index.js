const cleanJobObject = (job) => {
  const cleanedJob = {};
  for (const [key, value] of Object.entries(job)) {
    if (value && value !== "Not Specified" && value.length > 0) {
      cleanedJob[key] = value;
    }
  }
  return cleanedJob;
};

const extractInsights = (insights, jobInfo) => {
  let salary = "Not Specified";
  let jobType = "Not Specified";
  let locationType = "Not Specified";
  let employees = "Not Specified";

  insights.forEach((insight) => {
    let matches = insight.match(
      /\$[\d,.]+(?:K)?\/(?:yr|hr)\s*-\s*\$[\d,.]+(?:K)?\/(?:yr|hr)/
    );
    if (matches) {
      salary = matches[0];
    } else {
      matches = insight.match(/\$[\d,.]+(?:K)?\/(?:yr|hr)/);
      if (matches) {
        salary = matches[0];
      }
    }

    if (insight.includes("Full-time")) {
      jobType = "Full-time";
    } else if (insight.includes("Part-time")) {
      jobType = "Part-time";
    } else if (insight.includes("Contract")) {
      jobType = "Contract";
    }

    if (insight.includes("Remote")) {
      locationType = "Remote";
    } else if (insight.includes("On-site")) {
      locationType = "On-site";
    } else if (insight.includes("Hybrid")) {
      locationType = "Hybrid";
    }

    matches = insight.match(
      /(\d{1,3}(?:,\d{3})*(?:\+)?)\s*-\s*(\d{1,3}(?:,\d{3})*(?:\+)?)\s*employees/
    );
    if (matches) {
      employees = `${matches[1]} - ${matches[2]} employees`;
    } else {
      matches = insight.match(/(\d{1,3}(?:,\d{3})*(?:\+)?)\s*employees/);
      if (matches) {
        employees = `${matches[1]} employees`;
      }
    }
  });

  if (employees === "Not Specified" && jobInfo) {
    const matches = jobInfo.match(
      /(\d{1,3}(?:,\d{3})*(?:\+)?)\s*-\s*(\d{1,3}(?:,\d{3})*(?:\+)?)\s*employees/
    );
    if (matches) {
      employees = `${matches[1]} - ${matches[2]} employees`;
    } else {
      const singleMatch = jobInfo.match(
        /(\d{1,3}(?:,\d{3})*(?:\+)?)\s*employees/
      );
      if (singleMatch) {
        employees = `${singleMatch[1]} employees`;
      }
    }
  }

  if (salary === "Not Specified" && jobInfo) {
    const salaryMatches = jobInfo.match(
      /\$[\d,.]+(?:K)?\/(?:yr|hr)\s*-\s*\$[\d,.]+(?:K)?\/(?:yr|hr)/
    );
    if (salaryMatches) {
      salary = salaryMatches[0];
    } else {
      const singleSalaryMatch = jobInfo.match(/\$[\d,.]+(?:K)?\/(?:yr|hr)/);
      if (singleSalaryMatch) {
        salary = singleSalaryMatch[0];
      }
    }
  }

  return { salary, jobType, locationType, employees };
};

const cleanAndProcessSkills = (skillsData) => {
  if (!skillsData || skillsData === "Not Specified") {
    return [];
  }

  let skills = [];
  if (typeof skillsData === "object") {
    const skillsOnProfile = Array.isArray(skillsData.onProfile)
      ? skillsData.onProfile
      : [];
    const skillsMissing = Array.isArray(skillsData.missing)
      ? skillsData.missing
      : [];
    skills = [...skillsOnProfile, ...skillsMissing];
  } else if (typeof skillsData === "string") {
    skills = skillsData.split(",").map((skill) => skill.trim());
  }

  // Remove duplicates and empty strings
  skills = [...new Set(skills)].filter((skill) => skill.length > 0);

  return skills;
};

const extractSkillsFromDescription = (description) => {
  // List of common technical skills (expand this list as needed)
  const commonSkills = [
    "JavaScript",
    "Python",
    "Java",
    "C++",
    "React",
    "Node.js",
    "SQL",
    "Machine Learning",
    "Data Analysis",
    "AWS",
    "Docker",
    "Kubernetes",
    "Git",
    "Agile",
    "Scrum",
    "DevOps",
    "CI/CD",
    "REST API",
    "GraphQL",
    "MongoDB",
    "PostgreSQL",
    "TensorFlow",
    "PyTorch",
    "Vue.js",
    "Angular",
    "TypeScript",
    "Go",
    "Ruby",
    "PHP",
    "Swift",
    "Kotlin",
    "R",
    "Scala",
    "Hadoop",
    "Spark",
    "Tableau",
    "Power BI",
    "Excel",
    "Kubernetes",
    "Terraform",
    "Ansible",
    "Jenkins",
    "Unity",
    "Unreal Engine",
    "Photoshop",
    "Illustrator",
    "Figma",
    "Sketch",
  ];

  const skills = new Set();
  const words = description.split(/\W+/);

  words.forEach((word) => {
    if (commonSkills.includes(word)) {
      skills.add(word);
    }
  });

  return Array.from(skills);
};

async function formatJobDescription(description) {
  // Step 1: Remove all instances of "Matches your job preferences"
  let result = description.replace(/Matches your job preferences,/g, "");

  // Step 2: Remove "workplace type" and "job type" with any text after until the comma or dot
  result = result.replace(/workplace type[^,\.]*[,.]/gi, ",");
  result = result.replace(/job type[^,\.]*[,.]/gi, ",");

  // Step 3: Replace all periods with commas
  result = result.replace(/\./g, ",");

  // Step 4: Clean up extra whitespace and line breaks
  result = result.replace(/\s+/g, " ").trim();

  // Convert to lowercase (optional, depending on your needs)
  return result.toLowerCase();
}

module.exports = {
  formatJobDescription,
  extractSkillsFromDescription,
  cleanAndProcessSkills,
  extractInsights,
  cleanJobObject,
};
