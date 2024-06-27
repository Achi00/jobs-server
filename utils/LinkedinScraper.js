const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const cheerio = require("cheerio");
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

  // const descriptionFn = () => {
  //   console.log("descriptionFn is called");
  //   const getText = (selector) =>
  //     document.querySelector(selector)?.innerText.trim() || "N/A";
  //   const getAttribute = (selector, attribute) =>
  //     document.querySelector(selector)?.getAttribute(attribute) || "N/A";

  //   const getCompanyLogo = () => {
  //     const selectors = [
  //       "a[aria-label$='logo'] img.ivm-view-attr__img--centered",
  //       ".ivm-view-attr__img-wrapper img",
  //       ".artdeco-entity-image",
  //       "img.ivm-view-attr__img--centered",
  //     ];

  //     for (const selector of selectors) {
  //       const src = getAttribute(selector, "src");
  //       if (src !== "N/A") {
  //         console.log(`Company logo found with selector: ${selector}`);
  //         return src;
  //       }
  //     }

  //     console.log("Company logo not found with any selector");
  //     return "N/A";
  //   };

  //   const companyLogo = getCompanyLogo();
  //   const jobTitle = getText(
  //     ".job-details-jobs-unified-top-card__job-title h1"
  //   );
  //   const location = getText(
  //     ".job-details-jobs-unified-top-card__primary-description-container .tvm__text--low-emphasis"
  //   );
  //   const salary = getText(
  //     ".job-details-jobs-unified-top-card__job-insight--highlight span"
  //   );
  //   const jobType = getText(
  //     ".job-details-jobs-unified-top-card__job-insight-view-model-secondary span.ui-label"
  //   );
  //   const experienceLevel = getText(
  //     ".job-criteria__text--criteria:nth-child(3) span"
  //   );

  //   const descriptionHTML =
  //     document
  //       .querySelector(".jobs-description__container.jobs-description__content")
  //       ?.outerHTML.trim() || "N/A";

  //   let mt2mb2Content = "N/A";
  //   const mt2mb2Element = document.querySelector(".mt2.mb2");

  //   if (mt2mb2Element) {
  //     console.log("mt2mb2 element found:", mt2mb2Element);
  //     const items = mt2mb2Element.querySelectorAll("li");
  //     if (items.length > 0) {
  //       mt2mb2Content = Array.from(items)
  //         .map((item) => item.innerText.trim())
  //         .join("\n");
  //     } else {
  //       console.log("No list items found within mt2mb2 element");
  //     }
  //   } else {
  //     console.log("mt2mb2 element not found");
  //   }

  //   console.log("mt2mb2Content:", mt2mb2Content);

  //   const skills = Array.from(
  //     document.querySelectorAll(
  //       ".job-details-jobs-unified-top-card__job-insight-text-button a"
  //     )
  //   )
  //     .map((a) => a.innerText.trim())
  //     .join(", ");

  //   console.log("Extracted data:", {
  //     companyLogo,
  //     jobTitle,
  //     location,
  //     salary,
  //     jobType,
  //     experienceLevel,
  //     descriptionHTML,
  //     skills,
  //     mt2mb2Content,
  //   });

  //   return JSON.stringify({
  //     companyLogo,
  //     jobTitle,
  //     location,
  //     salary,
  //     jobType,
  //     experienceLevel,
  //     descriptionHTML,
  //     skills,
  //     mt2mb2Content,
  //   });
  // };

  scraper.on(events.scraper.data, async (data) => {
    console.log("Raw data:", JSON.stringify(data, null, 2));

    // Extract information from the provided data
    const extractJobDetails = (data) => {
      const $ = cheerio.load(data.descriptionHTML);

      const companyLogo =
        $("img.ivm-view-attr__img--centered").attr("src") || "N/A";
      const jobTitle = data.title || "N/A";
      const location = data.place || "N/A";
      const salary =
        $(".job-details-jobs-unified-top-card__job-insight--highlight span")
          .text()
          .trim() || "N/A";
      const jobType =
        $(
          ".job-details-jobs-unified-top-card__job-insight-view-model-secondary span.ui-label"
        )
          .text()
          .trim() || "N/A";
      const experienceLevel =
        $(".job-criteria__text--criteria:nth-child(3) span").text().trim() ||
        "N/A";
      const skills =
        $(".job-details-jobs-unified-top-card__job-insight-text-button a")
          .map((i, el) => $(el).text().trim())
          .get()
          .join(", ") || "N/A";

      return {
        companyLogo,
        jobTitle,
        location,
        salary,
        jobType,
        experienceLevel,
        skills,
        descriptionHTML: data.descriptionHTML,
      };
    };

    const jobDetails = extractJobDetails(data);

    const job = {
      jobId: data.jobId,
      title: data.title || "N/A",
      company: data.company || "N/A",
      location: data.location || "N/A",
      date: new Date(data.date),
      link: data.link || "N/A",
      applyLink: data.applyLink || "N/A",
      insights: Array.isArray(data.insights) ? data.insights : [data.insights],
      ...jobDetails,
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
  });

  try {
    await scraper.run(
      [
        {
          query,
          options: {
            ...options,
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
