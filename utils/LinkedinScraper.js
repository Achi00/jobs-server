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
const axios = require("axios");
const {
  extractInsights,
  extractSkillsFromDescription,
  cleanAndProcessSkills,
  cleanJobObject,
  formatJobDescription,
} = require("../helpers");

const scrapeLinkedInJobs = async (query, options) => {
  const scraper = new LinkedinScraper({
    headless: "new",
    slowMo: 200,
    args: ["--lang=en-GB"],
  });

  scraper.on(events.scraper.data, async (data) => {
    let parsedDescription;
    try {
      parsedDescription = JSON.parse(data.description);
    } catch (error) {
      console.error("Error parsing description:", error);
      parsedDescription = {};
    }

    // filter job details
    const otherData = parsedDescription.otherData;
    const filteredOtherData = otherData.replace(/·/g, ",");
    const unfilteredJobDetailPreferences =
      parsedDescription.jobDetailPreferences.text;
    const jobDetailPreferences = await formatJobDescription(
      unfilteredJobDetailPreferences
    );

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

    // Process job skills
    let skills = parsedDescription.skills || "Not Specified";
    if (skills !== "Not Specified") {
      if (typeof skills === "object" && skills.onProfile && skills.missing) {
        const combinedSkills = [...skills.onProfile, ...skills.missing].join(
          ", "
        );
        skills = cleanAndProcessSkills(combinedSkills);
      } else if (typeof skills === "object" && skills.general) {
        skills = cleanAndProcessSkills(skills.general.join(", "));
      } else {
        skills = cleanAndProcessSkills(skills);
      }
    } else {
      // If no skills were found, try to extract from description
      skills = extractSkillsFromDescription(
        parsedDescription.description || ""
      );
    }

    // python api to extract experience from html content
    let experiences = [];
    let knowledge = [];
    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/extract_experience",
        {
          text: cleanDescriptionHTML,
        }
      );
      experiences = response.data.experiences;
      knowledge = response.data.knowledge;
    } catch (error) {
      console.error("Error extracting experiences and knowledge:", error);
    }

    // for mongodb schema, complete data
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
      jobDetailPreferences: jobDetailPreferences,
      jobInfo: parsedDescription.jobInfo || "Not Specified",
      salary: insights.salary,
      jobType: insights.jobType,
      locationType: insights.locationType,
      employees: insights.employees,
      experiences: experiences,
      knowledge: knowledge,
      filteredOtherData,
    };

    try {
      const cleanedJob = cleanJobObject(job);
      await Job.findOneAndUpdate({ jobId: data.jobId }, cleanedJob, {
        upsert: true,
      });
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
    const otherData = getText(
      ".job-details-jobs-unified-top-card__primary-description-container .t-black--light"
    );
    const jobDetailPreferences = getText(".job-details-preferences-and-skills");

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
      jobDetailPreferences,
      insights,
      jobInfo,
      otherData: otherData.text, //test variable
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
