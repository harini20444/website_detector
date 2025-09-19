import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import whois from "whois-json";
import tldExtract from "tld-extract";
import { checkSSL } from "./sslCheck.js";
import { searchOriginalWebsite } from "./crawler.js";
import { compareLogos } from "./logoHash.js";
import dotenv from "dotenv";
import puppeteer from "puppeteer";
dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("."));

app.get("/", (req, res) => res.sendFile("index.html", { root: "." }));
app.post("/check", async (req, res) => {
  let url = req.body.url;
  console.log("Input URL:", url);

  try {
    // Input validation and URL preprocessing
    if (!url || typeof url !== "string" || url.trim() === "") {
      throw new Error("Please provide a valid URL");
    }

    url = url.trim();

    // Add protocol if missing
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // Domain + WHOIS
    const domainInfo = tldExtract(url);
    if (!domainInfo || !domainInfo.domain) {
      throw new Error("Unable to extract domain from URL");
    }

    let whoisInfo = null;
    try {
      whoisInfo = await whois(domainInfo.domain);
    } catch (whoisError) {
      console.error("WHOIS lookup failed:", whoisError);
      whoisInfo = { creationDate: null }; // fallback
    }

    const domainCreationDate = whoisInfo.creationDate
      ? new Date(whoisInfo.creationDate)
      : new Date();
    const domainAgeDays = Math.floor(
      (Date.now() - domainCreationDate) / (1000 * 60 * 60 * 24)
    );

    console.log("Crawling:", url);

    // Variables to hold extracted info
    let title = "";
    let metaDescription = "";

    // Crawl page with Puppeteer
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
      );

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      const content = await page.content();
      await browser.close();

      // Parse HTML with Cheerio
      const $ = cheerio.load(content);
      title = $("title").text() || "";
      metaDescription = $('meta[name="description"]').attr("content") || "";

      console.log("Title:", title);
      console.log("Meta Description:", metaDescription);
    } catch (err) {
      if (browser) await browser.close();
      console.error("❌ Puppeteer error:", err.message);
    }

    // SSL check
    const sslResult = await checkSSL(url);
    console.log("SSL Result:", sslResult);

    // Web search for original site
    const keywords =
      title && title.trim() !== ""
        ? title.split(" ").slice(0, 5)
        : [domainInfo.domain]; // fallback
    const candidateSites = await searchOriginalWebsite(keywords);

    // AI-assisted prediction (placeholder)
    const predictedOriginal =
      "AI prediction disabled - analyzing based on domain patterns and content only";

    // Risk scoring
    let riskScore = 0;
    console.log({domainAgeDays})
    riskScore += domainAgeDays < 180 ? 30 : 0;
    console.log(riskScore,sslResult.riskPoints)
    riskScore += sslResult.riskPoints;
    riskScore = Math.min(riskScore, 100);

    // Send HTML result
    res.send(`
      <h1>Detection Result</h1>
      <p><strong>URL:</strong> ${url}</p>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Description:</strong> ${metaDescription}</p>
      <p><strong>Predicted Original:</strong> ${predictedOriginal}</p>
      <p><strong>Candidate Sites:</strong> ${candidateSites.join(", ")}</p>
      <p><strong>SSL Info:</strong> ${JSON.stringify(
        sslResult.cert,
        null,
        2
      )}</p>
      <p><strong>Risk Score:</strong> ${riskScore}%</p>
      <a href="/">Check another URL</a>
    `);
  } catch (err) {
    console.error("Route error:", err.message);
    res.send(`<p>Error checking website: ${err.message}</p><a href="/">Go Back</a>`);
  }
});


app.listen(3000, () => console.log("Server running on http://localhost:3000"));
