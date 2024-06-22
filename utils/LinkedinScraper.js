const fs = require("fs");
const path = require("path");
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

(async () => {
  // Each scraper instance is associated with one browser.
  // Concurrent queries will run on different pages within the same browser instance.
  const scraper = new LinkedinScraper({
    headless: "new",
    slowMo: 200,
    args: ["--lang=en-GB"],
  });

  // Add listeners for scraper events

  // Emitted once for each processed job
  scraper.on(events.scraper.data, (data) => {
    const description = JSON.parse(data.description); // Parse the description JSON string back to an object

    console.log(
      `Description Length='${data.description.length}'`,
      `Description HTML Length='${data.descriptionHTML.length}'`,
      `Query='${data.query}'`,
      `Location='${data.location}'`,
      `Id='${data.jobId}'`,
      `Title='${data.title}'`,
      `Company='${data.company ? data.company : "N/A"}'`,
      `CompanyLink='${data.companyLink ? data.companyLink : "N/A"}'`,
      `CompanyImgLink='${data.companyImgLink ? data.companyImgLink : "N/A"}'`,
      `Place='${data.place}'`,
      `Date='${data.date}'`,
      `Link='${data.link}'`,
      `applyLink='${data.applyLink ? data.applyLink : "N/A"}'`,
      `insights='${data.insights}'`,
      `CompanyLogo='${description.companyLogo}'`,
      `JobTitle='${description.jobTitle}'`,
      `Location='${description.location}'`,
      `Salary='${description.salary}'`,
      `JobType='${description.jobType}'`,
      `ExperienceLevel='${description.experienceLevel}'`,
      `Description='${description.description}'`,
      `Skills='${description.skills}'`
    );

    // Save HTML content to a JSON file
    const filePath = path.join(__dirname, `job_${data.jobId}.json`);
    fs.writeFileSync(
      filePath,
      JSON.stringify({ html: data.descriptionHTML }, null, 2)
    );
  });

  // Emitted once for each scraped page
  scraper.on(events.scraper.metrics, (metrics) => {
    console.log(
      `Processed=${metrics.processed}`,
      `Failed=${metrics.failed}`,
      `Missed=${metrics.missed}`
    );
  });

  scraper.on(events.scraper.error, (err) => {
    console.error(err);
  });

  scraper.on(events.scraper.end, () => {
    console.log("All done!");
  });

  // Custom function executed on browser side to extract job description [optional]
  const descriptionFn = () => {
    const getText = (selector) =>
      document.querySelector(selector)?.innerText || "N/A";
    const getAttribute = (selector, attribute) =>
      document.querySelector(selector)?.getAttribute(attribute) || "N/A";

    const companyLogo = getAttribute(".ivm-view-attr__img-wrapper img", "src");
    const jobTitle = getText(
      ".job-details-jobs-unified-top-card__job-title h1"
    );
    const location = getText(".jobs-unified-top-card__bullet");
    const salary = getText(
      ".jobs-unified-top-card__job-insight--highlight span"
    );
    const jobType = getText(".jobs-unified-top-card__workplace-type");
    const experienceLevel = getText(".jobs-unified-top-card__job-insight span");
    const description = getText(".jobs-description__content");
    const skills = Array.from(
      document.querySelectorAll(
        ".jobs-unified-top-card__job-insight-text-button a"
      )
    )
      .map((a) => a.innerText)
      .join(", ");

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

  // Run queries concurrently
  await Promise.all([
    // Run queries serially
    scraper.run(
      [
        {
          query: "Engineer",
          options: {
            locations: ["United States"], // This will override global options ["Europe"]
            filters: {
              type: [typeFilter.FULL_TIME, typeFilter.CONTRACT],
              onSiteOrRemote: [
                onSiteOrRemoteFilter.REMOTE,
                onSiteOrRemoteFilter.HYBRID,
              ],
              baseSalary: baseSalaryFilter.SALARY_100K,
            },
            descriptionFn, // Include the custom description function
          },
        },
      ],
      {
        // Global options, will be merged individually with each query options
        locations: ["Europe"],
        limit: 33,
      }
    ),
  ]);

  // Close browser
  await scraper.close();
})();
