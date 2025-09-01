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
dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("."));

app.get("/", (req, res) => res.sendFile("index.html", { root: "." }));

app.post("/check", async (req, res) => {
  let url = req.body.url;
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

    // Crawl page
    const response = await axios.get(url, {
      timeout: 15000, // 15 second timeout
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      maxRedirects: 5,
    });
    const $ = cheerio.load(response.data);
    const title = $("title").text() || "";
    const metaDescription = $('meta[name="description"]').attr("content") || "";

    // SSL
    const sslResult = await checkSSL(url);

    // Web search for original site
    const keywords =
      title && title.trim() !== ""
        ? title.split(" ").slice(0, 5)
        : [domainInfo.domain]; // fallback to domain name if no title
    const candidateSites = await searchOriginalWebsite(keywords);

    // Logo comparison (optional: placeholder for now)
    // You can download favicon/logo and compare with known brand logos using compareLogos()

    // AI-assisted prediction (skipped for now)
    const predictedOriginal =
      "AI prediction disabled - analyzing based on domain patterns and content only";

    // Risk scoring
    let riskScore = 0;
    riskScore += domainAgeDays < 180 ? 30 : 0;
    riskScore += sslResult.riskPoints;
    riskScore = Math.min(riskScore, 100);

    // Send simple HTML result
    res.send(`
            <h1>Detection Result</h1>
            <p><strong>URL:</strong> ${url}</p>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Predicted Original:</strong> ${predictedOriginal}</p>
            <p><strong>Candidate Sites:</strong> ${candidateSites.join(
              ", "
            )}</p>
            <p><strong>SSL Info:</strong> ${JSON.stringify(
              sslResult.cert,
              null,
              2
            )}</p>
            <p><strong>Risk Score:</strong> ${riskScore}%</p>
            <a href="/">Check another URL</a>
        `);
  } catch (err) {
    console.error(err);
    res.send(
      `<p>Error checking website: ${err.message}</p><a href="/">Go Back</a>`
    );
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
