import fetch from "node-fetch";
import * as cheerio from "cheerio";

export async function searchOriginalWebsite(keywords) {
  try {
    if (!keywords || keywords.length === 0) {
      return [];
    }

    const query = encodeURIComponent(keywords.join(" "));
    const url = `https://duckduckgo.com/html/?q=${query}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000, // 10 second timeout
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const results = [];
    $("a.result__a").each((i, elem) => {
      const href = $(elem).attr("href");
      if (href && href.startsWith("http")) {
        results.push(href);
      }
    });

    return results.slice(0, 5);
  } catch (error) {
    console.error("Search error:", error);
    return []; // Return empty array on error
  }
}
