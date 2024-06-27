const puppeteer = require("puppeteer");
const Job = require("../models/Jobs");

async function scrapeLinkedInJobs(query, options) {
  console.log("Launching browser...");
  console.log("Options:", JSON.stringify(options, null, 2));
  const browser = await puppeteer.launch({
    headless: "new",
    slowMo: 200,
    args: ["--lang=en-GB"],
  });

  try {
    const page = await browser.newPage();

    // Construct URL with filters
    const baseUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      query
    )}`;
    const locationParam = options.locations
      ? `&location=${encodeURIComponent(options.locations.join(","))}`
      : "";
    const filterParams = constructFilterParams(options.filters);
    const url = `${baseUrl}${locationParam}${filterParams}`;

    console.log("Navigating to URL:", url);
    await page.goto(url);

    await page.waitForSelector(".jobs-search__results-list");
    console.log("Job results loaded");

    await autoScroll(page);
    console.log("Page scrolled to load more jobs");

    const jobsData = await page.evaluate((limit) => {
      const jobListItems = document.querySelectorAll(
        ".jobs-search__results-list > li"
      );
      return Array.from(jobListItems)
        .slice(0, limit)
        .map((item) => {
          const titleElement = item.querySelector("h3.base-search-card__title");
          const companyElement = item.querySelector(
            "h4.base-search-card__subtitle"
          );
          const locationElement = item.querySelector(
            ".job-search-card__location"
          );
          const linkElement = item.querySelector("a.base-card__full-link");

          return {
            title: titleElement ? titleElement.innerText.trim() : "N/A",
            company: companyElement ? companyElement.innerText.trim() : "N/A",
            location: locationElement
              ? locationElement.innerText.trim()
              : "N/A",
            link: linkElement ? linkElement.href : "N/A",
          };
        });
    }, options.limit || Infinity);

    console.log(`Found ${jobsData.length} jobs`);

    for (const [index, jobData] of jobsData.entries()) {
      console.log(`Processing job ${index + 1}/${jobsData.length}`);
      await processJob(page, jobData);
    }

    console.log(`Scraping completed. Processed ${jobsData.length} jobs`);
  } catch (error) {
    console.error("Error during scraping:", error);
    throw error;
  } finally {
    await browser.close();
    console.log("Browser closed");
  }
}

async function processJob(page, jobData, retryCount = 0) {
  try {
    console.log("Navigating to job page:", jobData.link);
    await page.goto(jobData.link, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Check if we've been redirected to a login page
    const isLoginPage = await page.evaluate(() => {
      return document.querySelector(".login__form") !== null;
    });

    if (isLoginPage) {
      console.log("Redirected to login page. Job details cannot be accessed.");
      return;
    }

    // Wait for either the job details or a possible alternative layout
    const selector = await Promise.race([
      page
        .waitForSelector(".job-details-jobs-unified-top-card__job-title", {
          timeout: 30000,
        })
        .then(() => ".job-details-jobs-unified-top-card__job-title"),
      page
        .waitForSelector(".top-card-layout__title", { timeout: 30000 })
        .then(() => ".top-card-layout__title"),
      page
        .waitForSelector("#main-content", { timeout: 30000 })
        .then(() => "#main-content"),
    ]);

    console.log("Job details page loaded");

    const detailedJobData = await page.evaluate((selector) => {
      const getText = (sel) =>
        document.querySelector(sel)?.innerText.trim() || "N/A";
      const getAttribute = (sel, attribute) =>
        document.querySelector(sel)?.getAttribute(attribute) || "N/A";

      return {
        jobTitle:
          getText(selector) || getText(".top-card-layout__title") || "N/A",
        company:
          getText(".job-details-jobs-unified-top-card__company-name") ||
          getText(".topcard__org-name-link") ||
          "N/A",
        location:
          getText(".job-details-jobs-unified-top-card__bullet") ||
          getText(".topcard__flavor--bullet") ||
          "N/A",
        description:
          getText(".jobs-description__content") ||
          getText(".description__text") ||
          "N/A",
        salary:
          getText(
            ".job-details-jobs-unified-top-card__job-insight--highlight span"
          ) || "N/A",
        jobType:
          getText(
            ".job-details-jobs-unified-top-card__job-insight-view-model-secondary span.ui-label"
          ) || "N/A",
        companyLogo: getAttribute("img.ember-view", "src") || "N/A",
      };
    }, selector);

    const job = {
      ...jobData,
      ...detailedJobData,
      date: new Date(),
    };

    console.log("Processed job data:", JSON.stringify(job, null, 2));

    await Job.findOneAndUpdate({ link: job.link }, job, { upsert: true });
    console.log(`Saved job: ${job.title}`);
  } catch (error) {
    console.error("Error processing job:", error);

    // Capture and log the page content
    const content = await page.content();
    console.log("Page content:", content);

    // Implement retry mechanism
    if (retryCount < 3) {
      console.log(`Retrying... (Attempt ${retryCount + 1})`);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before retrying
      await processJob(page, jobData, retryCount + 1);
    } else {
      console.log("Max retry attempts reached. Moving to next job.");
    }
  }
}

async function autoScroll(page) {
  console.log("Starting auto-scroll");
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  console.log("Auto-scroll completed");
}

function constructFilterParams(filters) {
  if (!filters) return "";

  const paramMap = {
    type: "f_JT",
    onSiteOrRemote: "f_WT",
    baseSalary: "f_SB",
  };

  let params = "";
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        params += `&${paramMap[key]}=${encodeURIComponent(v)}`;
      });
    } else {
      params += `&${paramMap[key]}=${encodeURIComponent(value)}`;
    }
  }

  return params;
}

module.exports = scrapeLinkedInJobs;
