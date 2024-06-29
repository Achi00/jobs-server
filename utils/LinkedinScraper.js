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
      // Save the full HTML to a file
    } catch (error) {
      console.error("Error parsing description:", error);
      parsedDescription = {};
    }

    // Validate and parse date
    let date = new Date(data.date);
    if (isNaN(date.getTime())) {
      date = new Date(); // Set to current date if invalid
    }

    const job = {
      jobId: data.jobId,
      title: data.title || "N/A",
      company: data.company || "N/A",
      location: parsedDescription.location || data.location || "N/A",
      date: date, // Use the validated date
      link: data.link || "N/A",
      applyLink: data.applyLink || "N/A",
      insights: Array.isArray(data.insights) ? data.insights : [data.insights],
      companyLogo: parsedDescription.companyLogo || "N/A",
      jobTitle: parsedDescription.jobTitle || data.title || "N/A",
      salary: parsedDescription.salary || "N/A",
      jobType: parsedDescription.jobType || "N/A",
      experienceLevel: parsedDescription.experienceLevel || "N/A",
      descriptionHTML: parsedDescription.descriptionHTML || "N/A",
      skills: parsedDescription.skills || "N/A",
      mt2mb2Content: parsedDescription.mt2mb2Content || "N/A",
    };

    console.log("Processed job data:", JSON.stringify(job, null, 2));
    console.log(
      "Debug info:",
      JSON.stringify(parsedDescription._debug, null, 2)
    );

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
  });

  const descriptionFn = () => {
    const getText = (selector) => {
      const element = document.querySelector(selector);
      return {
        text: element ? element.innerText.trim() : "N/A",
        found: !!element,
      };
    };

    const getAttribute = (selector, attribute) => {
      const element = document.querySelector(selector);
      return {
        value: element ? element.getAttribute(attribute) : "N/A",
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
        if (result.value !== "N/A") {
          return { value: result.value, selector };
        }
      }

      return { value: "N/A", selector: null };
    };

    const companyLogo = getCompanyLogo();
    const jobTitle = getText(
      ".t-24.job-details-jobs-unified-top-card__job-title h1"
    );
    const location = getText(".jobs-unified-top-card__bullet");
    const salary = getText(
      ".jobs-unified-top-card__job-insight--highlight span"
    );
    const jobType = getText(".jobs-unified-top-card__workplace-type");
    const experienceLevel = getText(
      ".job-criteria__text--criteria:nth-child(3) span"
    );

    let mt2mb2Content = { text: "N/A", found: false };
    const mt2mb2Element = document.querySelector(".mt2.mb2");

    if (mt2mb2Element) {
      const items = mt2mb2Element.querySelectorAll("li, p, span");
      if (items.length > 0) {
        mt2mb2Content = {
          text: Array.from(items)
            .map((item) => item.innerText.trim())
            .join("\n"),
          found: true,
        };
      } else {
        mt2mb2Content = {
          text: mt2mb2Element.innerText.trim(),
          found: true,
        };
      }
    }

    const skills = Array.from(
      document.querySelectorAll(
        ".job-details-jobs-unified-top-card__job-insight-text-button a"
      )
    )
      .map((a) => a.innerText.trim())
      .join(", ");

    return JSON.stringify({
      companyLogo: companyLogo.value,
      jobTitle: jobTitle.text,
      location: location.text,
      salary: salary.text,
      jobType: jobType.text,
      experienceLevel: experienceLevel.text,
      descriptionHTML:
        document.querySelector(
          ".jobs-description__container.jobs-description__content"
        )?.outerHTML || "N/A",
      skills,
      mt2mb2Content: mt2mb2Content.text,
      fullHTML: document.documentElement.outerHTML, // Save full HTML for debugging
      // _debug: {
      //   selectors: {
      //     companyLogo: companyLogo.selector,
      //     jobTitle: jobTitle.found,
      //     location: location.found,
      //     salary: salary.found,
      //     jobType: jobType.found,
      //     experienceLevel: experienceLevel.found,
      //     mt2mb2: mt2mb2Content.found,
      //   },
      //   mt2mb2ElementExists: !!document.querySelector(".mt2.mb2"),
      // },
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
