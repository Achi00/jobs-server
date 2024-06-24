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
      parsedDescription = JSON.parse(data.description);
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
      descriptionHTML: data.descriptionHTML || "N/A",
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
    const jobTitle = getText(".job-details-jobs-unified-top-card__job-title");
    const location = getText(".job-details-jobs-unified-top-card__bullet");
    const salary = getText(
      ".job-details-jobs-unified-top-card__job-insight--highlight span"
    );
    const jobType = getText(
      ".job-details-jobs-unified-top-card__workplace-type"
    );
    const experienceLevel = getText(
      ".job-details-jobs-unified-top-card__job-insight span"
    );
    const description =
      document.querySelector(".jobs-description__content")?.innerText.trim() ||
      "N/A";
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
      skills,
    });

    return JSON.stringify({
      companyLogo,
      jobTitle,
      location,
      salary,
      jobType,
      experienceLevel,
      description,
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
