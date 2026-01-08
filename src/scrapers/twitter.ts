import { chromium } from "playwright";

export interface Tweet {
  tweetId: string;
  handle: string;
  content: string;
  postedAt: Date;
}

export async function scrapeTwitterProfile(handle: string): Promise<Tweet[]> {
  const browser = await chromium.launch({ 
    headless: true,
  });
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
  });

  const page = await context.newPage();

  try {
    console.log(`Scraping Twitter profile: @${handle}`);
    
    await page.goto(`https://x.com/${handle}`, { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });
    
    // Wait for tweets to load
    await page.waitForTimeout(5000);
    
    // Scroll to load more content
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);

    const pageContent = await page.content();
    console.log("Page loaded, length:", pageContent.length);

    const tweets = await page.evaluate((username) => {
      const items: any[] = [];
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      
      console.log("Found articles:", articles.length);

      articles.forEach((article) => {
        const textEl = article.querySelector('[data-testid="tweetText"]');
        const timeEl = article.querySelector("time");
        const linkEl = article.querySelector('a[href*="/status/"]');

        if (textEl) {
          const href = linkEl?.getAttribute("href") || "";
          const tweetIdMatch = href.match(/\/status\/(\d+)/);

          items.push({
            tweetId: tweetIdMatch ? tweetIdMatch[1] : Math.random().toString(),
            handle: username,
            content: textEl.textContent || "",
            postedAt: timeEl?.getAttribute("datetime") || new Date().toISOString(),
          });
        }
      });

      return items.slice(0, 10);
    }, handle);

    console.log(`Found ${tweets.length} tweets from @${handle}`);

    await browser.close();

    return tweets.map((t) => ({
      ...t,
      postedAt: new Date(t.postedAt),
    }));
  } catch (error) {
    console.error(`Error scraping @${handle}:`, error);
    await browser.close();
    return [];
  }
}

export async function scrapeTwitterSearch(query: string): Promise<Tweet[]> {
  const browser = await chromium.launch({ 
    headless: true,
  });
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
  });

  const page = await context.newPage();

  try {
    console.log(`Searching Twitter for: ${query}`);
    
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
    await page.goto(searchUrl, { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });
    
    await page.waitForTimeout(5000);
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);

    const tweets = await page.evaluate(() => {
      const items: any[] = [];
      const articles = document.querySelectorAll('article[data-testid="tweet"]');

      articles.forEach((article) => {
        const textEl = article.querySelector('[data-testid="tweetText"]');
        const timeEl = article.querySelector("time");
        const linkEl = article.querySelector('a[href*="/status/"]');

        if (textEl) {
          const href = linkEl?.getAttribute("href") || "";
          const tweetIdMatch = href.match(/\/status\/(\d+)/);
          const handleMatch = href.match(/\/([^/]+)\/status/);

          items.push({
            tweetId: tweetIdMatch ? tweetIdMatch[1] : Math.random().toString(),
            handle: handleMatch ? handleMatch[1] : "unknown",
            content: textEl.textContent || "",
            postedAt: timeEl?.getAttribute("datetime") || new Date().toISOString(),
          });
        }
      });

      return items.slice(0, 10);
    });

    console.log(`Found ${tweets.length} tweets for "${query}"`);

    await browser.close();

    return tweets.map((t) => ({
      ...t,
      postedAt: new Date(t.postedAt),
    }));
  } catch (error) {
    console.error(`Error searching Twitter:`, error);
    await browser.close();
    return [];
  }
}