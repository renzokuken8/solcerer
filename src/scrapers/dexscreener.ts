import { chromium } from "playwright";

export interface TrendingToken {
  mint: string;
  name: string;
  symbol: string;
  price: string;
  priceChange: string;
  volume: string;
  liquidity: string;
}

export async function scrapeTrendingTokens(): Promise<TrendingToken[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    console.log("Scraping DEX Screener trending...");
    
    await page.goto("https://dexscreener.com/solana", { 
      waitUntil: "networkidle",
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    // Scroll to load more
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);

    const tokens = await page.evaluate(() => {
      const items: any[] = [];
      const rows = document.querySelectorAll('a[href*="/solana/"]');

      rows.forEach((row) => {
        const href = row.getAttribute("href") || "";
        const mintMatch = href.match(/\/solana\/([A-Za-z0-9]+)/);
        
        if (mintMatch && mintMatch[1].length > 30) {
          const text = row.textContent || "";
          
          // Try to extract data from the row
          const priceMatch = text.match(/\$[\d.]+/);
          const percentMatch = text.match(/([+-]?[\d.]+%)/);
          
          items.push({
            mint: mintMatch[1],
            name: text.split("$")[0]?.trim().substring(0, 30) || "Unknown",
            symbol: "???",
            price: priceMatch ? priceMatch[0] : "N/A",
            priceChange: percentMatch ? percentMatch[0] : "N/A",
            volume: "N/A",
            liquidity: "N/A",
          });
        }
      });

      // Remove duplicates by mint
      const seen = new Set();
      return items.filter((item) => {
        if (seen.has(item.mint)) return false;
        seen.add(item.mint);
        return true;
      }).slice(0, 10);
    });

    console.log(`Found ${tokens.length} trending tokens`);
    
    await browser.close();
    return tokens;
  } catch (error) {
    console.error("Error scraping DEX Screener:", error);
    await browser.close();
    return [];
  }
}