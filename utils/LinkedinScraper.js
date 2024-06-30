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

  scraper.on(events.scraper.data, async (data) => {
    // console.log("Raw data:", JSON.stringify(data, null, 2));

    console.log("insights:", JSON.stringify(data.insights, null, 2));

    let parsedDescription;
    try {
      parsedDescription = JSON.parse(data.description);

      // Save the full HTML to a file
      const fileName = `job_${data.jobId}_${Date.now()}.html`;
      fs.writeFileSync(
        path.join(__dirname, fileName),
        parsedDescription.fullHTML
      );
      console.log(`Saved full HTML to ${fileName}`);
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

    // Format skills
    const formatSkills = (skillsData) => {
      if (typeof skillsData === "string") {
        return skillsData; // This will be "Not Specified" if no skills were found
      }

      if (skillsData.onProfile || skillsData.missing) {
        let formattedSkills = "";
        if (skillsData.onProfile.length > 0) {
          formattedSkills += `${skillsData.onProfile.join(", ")}\n`;
        }
        if (skillsData.missing.length > 0) {
          formattedSkills += `${skillsData.missing.join(", ")}`;
        }
        return formattedSkills.trim();
      }

      if (skillsData.general) {
        let formattedSkills = skillsData.general.join(", ");
        if (skillsData.additional) {
          formattedSkills += ` (+${skillsData.additional} more)`;
        }
        return formattedSkills;
      }

      return "Not Specified";
    };

    const job = {
      jobId: data.jobId,
      company: data.company || "Not Specified",
      location: parsedDescription.location || data.location || "Not Specified",
      date: date,
      link: data.link || "Not Specified",
      applyLink: data.link || "Not Specified",
      insights: Array.isArray(data.insights) ? data.insights : [data.insights],
      companyLogo: parsedDescription.companyLogo || "Not Specified",
      jobTitle: parsedDescription.jobTitle || data.title || "Not Specified",
      salary: (parsedDescription.salary || "Not Specified")
        .replace(/Matches your job preferences,?/, "")
        .trim(),
      jobType: (parsedDescription.jobType || "Not Specified")
        .replace(/Matches your job preferences,?/, "")
        .trim(),
      descriptionHTML: cleanDescriptionHTML,
      skills: formatSkills(parsedDescription.skills),
      mt2mb2Content: parsedDescription.mt2mb2Content || "Not Specified",
    };

    // console.log("Processed job data:", JSON.stringify(job, null, 2));
    // console.log(
    //   "Debug info:",
    //   JSON.stringify(parsedDescription._debug, null, 2)
    // );

    try {
      const cleanedJob = cleanJobObject(job);
      await Job.findOneAndUpdate({ jobId: data.jobId }, cleanedJob, {
        upsert: true,
      });
      console.log(`Saved job: ${job.jobTitle}`);
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

    const getMt2mb2Content = () => {
      const mt2mb2Element = document.querySelector(".mt2.mb2");
      if (mt2mb2Element) {
        const items = mt2mb2Element.querySelectorAll("li, p, span");
        const texts = Array.from(items).map((item) => item.textContent.trim());
        // Remove duplicates and filter out promotional content
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

    // Extract all skills from the specified elements
    const getSkills = () => {
      console.log("Starting skills extraction");

      // Method 1: Try to get detailed skills breakdown
      const getDetailedSkills = () => {
        const skillsData = {
          onProfile: [],
          missing: [],
        };

        const extractSkills = (headerText) => {
          const headers = Array.from(document.querySelectorAll(".t-14.t-bold"));
          console.log(`Found ${headers.length} potential skill headers`);
          const header = headers.find((el) =>
            el.textContent.includes(headerText)
          );
          if (header) {
            console.log(`Found header: ${headerText}`);
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

        console.log("Detailed skills data:", skillsData);
        return skillsData;
      };

      // Method 2: Try to get general skills list
      const getGeneralSkills = () => {
        const generalSkills = document.querySelector(
          ".job-details-jobs-unified-top-card__job-insight-text-button"
        );
        if (generalSkills) {
          console.log("Found general skills element");
          const skillsText = generalSkills.textContent.trim();
          const match = skillsText.match(/Skills: (.+?)(?:, \+(\d+) more)?$/);
          if (match) {
            const listedSkills = match[1].split(", ");
            const additional = match[2] ? parseInt(match[2]) : 0;
            console.log(
              "General skills:",
              listedSkills,
              "Additional:",
              additional
            );
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

      console.log("No skills found");
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
    const mt2mb2Content = getMt2mb2Content();
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
      mt2mb2Content,
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
