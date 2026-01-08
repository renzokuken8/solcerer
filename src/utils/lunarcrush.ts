import { chromium } from "playwright";

export interface SocialData {
  sentiment: number;
  galaxy_score: number;
  alt_rank: number;
  engagements: string;
  mentions: string;
  price: string;
}

export async function getTokenSocial(symbol: string): Promise<SocialData | null> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const url = `https://lunarcrush.com/discover/${symbol.toLowerCase()}`;
    console.log("Scraping:", url);
    
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);

    const pageText = await page.evaluate(() => document.body.innerText);
    
    if (pageText.includes("404") || pageText.includes("Page Not Found")) {
      console.log("Page not found");
      await browser.close();
      return null;
    }

    console.log("Page text:", pageText.substring(0, 800));

    // Extract all numbers after specific labels
    const extractNumber = (label: string): number => {
      const regex = new RegExp(label + "[™↑↓\\s]*(\\d+)", "i");
      const match = pageText.match(regex);
      return match ? parseInt(match[1]) : 0;
    };

    const extractWithUnit = (label: string): string => {
      const regex = new RegExp(label + "[↑↓]?([\\d.]+[KMB]?)\\s*([\\d.]+[KMB]?)?", "i");
      const match = pageText.match(regex);
      if (match) {
        return match[2] || match[1];
      }
      return "0";
    };

    // Galaxy Score - second number after the label
    let galaxy_score = 0;
    const galaxyMatch = pageText.match(/Galaxy Score[™]?[↑↓]?(\d+)\s*(\d+)/);
    if (galaxyMatch) {
      galaxy_score = parseInt(galaxyMatch[2]);
    }

    // AltRank - second number after the label
    let alt_rank = 0;
    const altRankMatch = pageText.match(/AltRank[™]?[↑↓]?(\d+)\s*(\d+)/);
    if (altRankMatch) {
      alt_rank = parseInt(altRankMatch[2]);
    }

    // Engagements
    const engagements = extractWithUnit("Engagements");

    // Mentions
    const mentions = extractWithUnit("Mentions");

    // Sentiment - look for percentage
    let sentiment = 50;
    const sentimentMatch = pageText.match(/Sentiment[↑↓]?(\d+)%?\s*(\d+)?%/);
    if (sentimentMatch) {
      sentiment = parseInt(sentimentMatch[2] || sentimentMatch[1]);
    }

    // Price - find the line with "Price" and get the dollar amount after it
    let price = "0";
    const priceSection = pageText.match(/Price[\s\S]*?\$([\d,]+\.?\d*)/);
    if (priceSection) {
      price = priceSection[1];
    } else {
      // Fallback: find any large dollar amount (likely the price)
      const allPrices = pageText.match(/\$([\d,]+\.?\d*)/g);
      if (allPrices && allPrices.length > 0) {
        // Get the first reasonable price (not market cap)
        for (const p of allPrices) {
          const num = parseFloat(p.replace(/[$,]/g, ""));
          if (num < 1000000) {
            price = p.replace("$", "");
            break;
          }
        }
      }
    }

    await browser.close();

    return {
      sentiment,
      galaxy_score,
      alt_rank,
      engagements,
      mentions,
      price,
    };
  } catch (error) {
    console.error("Error scraping LunarCrush:", error);
    await browser.close();
    return null;
  }
}