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

const scrapeLinkedInJobs = async (query, options) => {
  const scraper = new LinkedinScraper({
    headless: "new",
    slowMo: 200,
    args: ["--lang=en-GB"],
  });

  scraper.on(events.scraper.data, async (data) => {
    console.log("Raw data:", JSON.stringify(data, null, 2));

    let parsedDescription;
    try {
      parsedDescription =
        typeof data.description === "string"
          ? JSON.parse(data.description)
          : data.description;
    } catch (error) {
      console.error("Error parsing description:", error);
      parsedDescription = {};
    }

    const job = {
      jobId: data.jobId,
      title: data.title || "N/A",
      company: data.company || "N/A",
      location: data.location || "N/A",
      date: new Date(data.date),
      link: data.link || "N/A",
      applyLink: data.applyLink || "N/A",
      insights: Array.isArray(data.insights) ? data.insights : [data.insights],
      companyLogo: parsedDescription.companyLogo || "N/A",
      jobTitle: parsedDescription.jobTitle || data.title || "N/A",
      jobLocation: parsedDescription.location || data.location || "N/A",
      salary: parsedDescription.salary || "N/A",
      jobType: parsedDescription.jobType || "N/A",
      experienceLevel: parsedDescription.experienceLevel || "N/A",
      description: parsedDescription.description || "N/A",
      skills: parsedDescription.skills || "N/A",
      descriptionHTML: data.descriptionHTML || "N/A", // Use data.descriptionHTML directly
    };

    console.log("Processed job data:", JSON.stringify(job, null, 2));

    try {
      await Job.findOneAndUpdate({ jobId: data.jobId }, job, { upsert: true });
      console.log(`Saved job: ${job.title}`);
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
    mongoose.disconnect();
  });

  const descriptionFn = () => {
    const getText = (selector) =>
      document.querySelector(selector)?.innerText.trim() || "N/A";
    const getAttribute = (selector, attribute) =>
      document.querySelector(selector)?.getAttribute(attribute) || "N/A";

    const getCompanyLogo = () => {
      const selectors = [
        "a[aria-label$='logo'] img.ivm-view-attr__img--centered",
        ".ivm-view-attr__img-wrapper img",
        ".artdeco-entity-image",
        "img.ivm-view-attr__img--centered",
      ];

      for (const selector of selectors) {
        const src = getAttribute(selector, "src");
        if (src !== "N/A") {
          console.log(`Company logo found with selector: ${selector}`);
          return src;
        }
      }

      console.log("Company logo not found with any selector");
      return "N/A";
    };

    const companyLogo = getCompanyLogo();
    const jobTitle = getText(
      ".job-details-jobs-unified-top-card__job-title h1"
    );
    const location = getText(
      ".job-details-jobs-unified-top-card__primary-description-container .tvm__text--low-emphasis"
    );
    const salary = getText(
      ".job-details-jobs-unified-top-card__job-insight--highlight span"
    );
    const jobType = getText(
      ".job-details-jobs-unified-top-card__job-insight-view-model-secondary span.ui-label"
    );
    const experienceLevel = getText(
      ".job-criteria__text--criteria:nth-child(3) span"
    );

    // Capture the HTML content of the job description
    const descriptionHTML =
      document
        .querySelector(".jobs-description__container.jobs-description__content")
        ?.outerHTML.trim() || "N/A";

    console.log("descriptionHTML:", descriptionHTML);
    // console.log("companyLogo:", companyLogo);
    // console.log("jobTitle:", jobTitle);
    // console.log("location:", location);
    // console.log("salary:", salary);
    // console.log("jobType:", jobType);
    // console.log("experienceLevel:", experienceLevel);
    // console.log("descriptionHTML:", descriptionHTML);

    const skills = Array.from(
      document.querySelectorAll(
        ".job-details-jobs-unified-top-card__job-insight-text-button a"
      )
    )
      .map((a) => a.innerText.trim())
      .join(", ");

    console.log("Extracted data:", {
      companyLogo,
      jobTitle,
      location,
      salary,
      jobType,
      experienceLevel,
      descriptionHTML,
      skills,
    });

    return JSON.stringify({
      companyLogo,
      jobTitle,
      location,
      salary,
      jobType,
      experienceLevel,
      descriptionHTML,
      skills,
    });
  };

  try {
    await scraper.run(
      [
        {
          query,
          options: {
            ...options,
            descriptionFn,
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
