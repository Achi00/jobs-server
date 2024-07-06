const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const {
  LinkedinScraper,
  relevanceFilter,
  timeFilter,
  typeFilter,
  experienceLevelFilter,
  onSiteOrRemoteFilter,
  baseSalaryFilter,
  events,
} = require("linkedin-jobs-scraper");
const Job = require("../models/Jobs");
const cheerio = require("cheerio");

const scrapeLinkedInJobs = async (query, options) => {
  const scraper = new LinkedinScraper({
    headless: "new",
    slowMo: 200,
    args: ["--lang=en-GB"],
  });

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

  scraper.on(events.scraper.data, async (data) => {
    console.log("Raw data:", JSON.stringify(data, null, 2));

    let parsedDescription;
    try {
      parsedDescription = JSON.parse(data.description);
    } catch (error) {
      console.error("Error parsing description:", error);
      parsedDescription = {};
    }

    // Validate and parse date
    let date = new Date(data.date);
    if (isNaN(date.getTime())) {
      date = new Date(); // Set to current date if invalid
    }

    // Use Cheerio to remove HTML tags from descriptionHTML
    const $ = cheerio.load(parsedDescription.descriptionHTML || "");
    const cleanDescriptionHTML = $.text().trim() || "Not Specified";

    const insights = extractInsights(
      data.insights || [],
      parsedDescription.jobInfo || ""
    );

    let skills = parsedDescription.skills || "Not Specified";
    if (skills !== "Not Specified") {
      const combinedSkills = [...skills.onProfile, ...skills.missing].join(
        ", "
      );
      skills = combinedSkills;
    }

    const job = {
      jobId: data.jobId,
      company: data.company || "Not Specified",
      location: parsedDescription.location || data.location || "Not Specified",
      date: date,
      link: data.link || "Not Specified",
      applyLink: data.link || "Not Specified",
      companyLogo: parsedDescription.companyLogo || "Not Specified",
      jobTitle: parsedDescription.jobTitle || data.title || "Not Specified",
      description: parsedDescription.description || "Not Specified",
      descriptionHTML: cleanDescriptionHTML,
      skills: skills,
      jobInfo: parsedDescription.jobInfo || "Not Specified",
      salary: insights.salary,
      jobType: insights.jobType,
      locationType: insights.locationType,
      employees: insights.employees,
    };

    console.log("Processed job data:", JSON.stringify(job, null, 2));

    try {
      const cleanedJob = cleanJobObject(job);
      await Job.findOneAndUpdate({ jobId: data.jobId }, cleanedJob, {
        upsert: true,
      });
      console.log(`Saved job: ${job.jobTitle}`);
      console.log(`Employees: ${job.employees}`);
    } catch (error) {
      console.error("Error saving job:", error);
    }
  });

  scraper.on(events.scraper.metrics, (metrics) => {
    console.log(
      `Processed=${metrics.processed}`,
      `Failed=${metrics.failed}`,
      `Missed=${metrics.missed}`
    );
  });

  scraper.on(events.scraper.error, (err) => {
    console.error("Scraper error:", err);
  });

  scraper.on(events.scraper.end, () => {
    console.log("All done!");
  });

  const descriptionFn = () => {
    const getText = (selector) => {
      const element = document.querySelector(selector);
      return {
        text: element ? element.innerText.trim() : "Not Specified",
        found: !!element,
      };
    };

    const getAttribute = (selector, attribute) => {
      const element = document.querySelector(selector);
      return {
        value: element ? element.getAttribute(attribute) : "Not Specified",
        found: !!element,
      };
    };

    const getCompanyLogo = () => {
      const selectors = [
        "a[aria-label$='logo'] img.ivm-view-attr__img--centered",
        ".ivm-view-attr__img-wrapper img",
        ".artdeco-entity-image",
        "img.ivm-view-attr__img--centered",
      ];

      for (const selector of selectors) {
        const result = getAttribute(selector, "src");
        if (result.value !== "Not Specified") {
          return { value: result.value, selector };
        }
      }

      return { value: "Not Specified", selector: null };
    };

    const getInsights = () => {
      const insightElements = document.querySelectorAll(
        ".jobs-unified-top-card__job-insight"
      );
      return Array.from(insightElements)
        .map((el) => el.textContent.trim())
        .filter(
          (text) =>
            !text.includes("Show more") &&
            !text.includes("Try Premium") &&
            !text.includes("Am I a good fit") &&
            !text.includes("How can I best position myself") &&
            !text.includes("Tell me more about")
        );
    };

    const getjobInfo = () => {
      const mt2mb2Element = document.querySelector(".mt2.mb2");
      if (mt2mb2Element) {
        const items = mt2mb2Element.querySelectorAll("li, p, span");
        const texts = Array.from(items).map((item) => item.textContent.trim());
        return [...new Set(texts)]
          .filter(
            (text) =>
              !text.includes("Matches your job preferences") &&
              !text.includes("Show more") &&
              !text.includes("Try Premium") &&
              text.length > 0
          )
          .join("\n");
      }
      return "Not Specified";
    };

    const getSkills = () => {
      console.log("Starting skills extraction");

      const getDetailedSkills = () => {
        const skillsData = {
          onProfile: [],
          missing: [],
        };

        const extractSkills = (headerText) => {
          const headers = Array.from(document.querySelectorAll(".t-14.t-bold"));
          const header = headers.find((el) =>
            el.textContent.includes(headerText)
          );
          if (header) {
            const skillsElement = header.nextElementSibling;
            if (
              skillsElement &&
              skillsElement.classList.contains(
                "job-details-how-you-match__skills-item-subtitle"
              )
            ) {
              return skillsElement.textContent.split(" and ");
            }
          }
          return [];
        };

        skillsData.onProfile = extractSkills("skills on your profile");
        skillsData.missing = extractSkills("skills missing on your profile");

        return skillsData;
      };

      const getGeneralSkills = () => {
        const generalSkills = document.querySelector(
          ".job-details-jobs-unified-top-card__job-insight-text-button"
        );
        if (generalSkills) {
          const skillsText = generalSkills.textContent.trim();
          const match = skillsText.match(/Skills: (.+?)(?:, \+(\d+) more)?$/);
          if (match) {
            const listedSkills = match[1].split(", ");
            const additional = match[2] ? parseInt(match[2]) : 0;
            return { general: listedSkills, additional };
          }
        }
        return null;
      };

      const detailedSkills = getDetailedSkills();
      if (
        detailedSkills.onProfile.length > 0 ||
        detailedSkills.missing.length > 0
      ) {
        return detailedSkills;
      }

      const generalSkills = getGeneralSkills();
      if (generalSkills) {
        return generalSkills;
      }

      return "Not Specified";
    };

    const companyLogo = getCompanyLogo();
    const jobTitle = getText(
      ".t-24.job-details-jobs-unified-top-card__job-title h1"
    );
    const location = getText(".t-black--light.mt2 span:first-child");
    const salary = getText(
      ".jobs-unified-top-card__job-insight--highlight span"
    );
    const jobType = getText(".jobs-unified-top-card__workplace-type");

    const descriptionHTML =
      document.querySelector(
        ".jobs-description__container .jobs-description__content .mt4"
      )?.outerHTML || "Not Specified";

    const insights = getInsights();
    const jobInfo = getjobInfo();
    const skills = getSkills();

    return JSON.stringify({
      companyLogo: companyLogo.value,
      jobTitle: jobTitle.text,
      location: location.text,
      salary: salary.text,
      jobType: jobType.text,
      descriptionHTML: descriptionHTML,
      skills: skills,
      insights,
      jobInfo,
      fullHTML: document.documentElement.outerHTML, // Save full HTML for debugging
      _debug: {
        selectors: {
          companyLogo: companyLogo.selector,
          jobTitle: jobTitle.found,
          location: location.found,
          salary: salary.found,
          jobType: jobType.found,
        },
      },
    });
  };

  try {
    await scraper.run(
      [
        {
          query,
          options: {
            ...options,
            descriptionFn: descriptionFn,
          },
        },
      ],
      options
    );
  } catch (error) {
    console.error("Error running scraper:", error);
  } finally {
    await scraper.close();
  }
};

module.exports = scrapeLinkedInJobs;
