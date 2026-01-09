import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import dotenv from "dotenv";

dotenv.config();

chromium.use(stealth());

export interface Tweet {
  tweetId: string;
  handle: string;
  content: string;
  postedAt: Date;
  likes: number;
  retweets: number;
  replies: number;
  isRetweet: boolean;
  retweetedBy: string | null;
  isQuoteRetweet: boolean;
}

function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function getRandomFingerprint() {
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
  ];
  
  const timezones = ["America/New_York", "America/Los_Angeles", "America/Chicago"];
  const locales = ["en-US", "en-GB"];
  
  return {
    viewport: viewports[Math.floor(Math.random() * viewports.length)],
    timezone: timezones[Math.floor(Math.random() * timezones.length)],
    locale: locales[Math.floor(Math.random() * locales.length)],
  };
}

function parseEngagementNumber(text: string): number {
  if (!text) return 0;
  const clean = text.replace(/,/g, "").trim();
  if (clean.includes("K")) {
    return Math.round(parseFloat(clean.replace("K", "")) * 1000);
  }
  if (clean.includes("M")) {
    return Math.round(parseFloat(clean.replace("M", "")) * 1000000);
  }
  return parseInt(clean) || 0;
}

async function createAuthenticatedContext() {
  const fingerprint = getRandomFingerprint();
  
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: fingerprint.viewport,
    locale: fingerprint.locale,
    timezoneId: fingerprint.timezone,
  });

  const authToken = process.env.TWITTER_AUTH_TOKEN;
  const ct0 = process.env.TWITTER_CT0;

  if (authToken && ct0) {
    await context.addCookies([
      {
        name: "auth_token",
        value: authToken,
        domain: ".x.com",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "None",
      },
      {
        name: "ct0",
        value: ct0,
        domain: ".x.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    console.log("Twitter cookies loaded");
  } else {
    console.log("Warning: Twitter cookies not found in .env");
  }

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  return { browser, context, page };
}

async function extractTweets(page: any, profileHandle: string): Promise<any[]> {
  return page.evaluate((handle: string) => {
    const items: any[] = [];
    const articles = document.querySelectorAll('article[data-testid="tweet"]');

    articles.forEach((article) => {
      const textEl = article.querySelector('[data-testid="tweetText"]');
      const timeEl = article.querySelector("time");
      const linkEl = article.querySelector('a[href*="/status/"]');
      
      // Check for retweet indicator
      const socialContext = article.querySelector('[data-testid="socialContext"]');
      const socialText = socialContext?.textContent || "";
      const isRetweet = socialText.toLowerCase().includes("reposted") || socialText.toLowerCase().includes("retweeted");
      
      // Check for quote retweet (has embedded tweet)
      const quoteTweet = article.querySelector('[data-testid="tweet"] [data-testid="tweet"]');
      const isQuoteRetweet = !!quoteTweet;
      
      const likeButton = article.querySelector('[data-testid="like"]');
      const retweetButton = article.querySelector('[data-testid="retweet"]');
      const replyButton = article.querySelector('[data-testid="reply"]');
      
      let likesStr = "0";
      let retweetsStr = "0";
      let repliesStr = "0";
      
      if (likeButton) {
        const label = likeButton.getAttribute("aria-label") || "";
        const match = label.match(/([\d,.]+[KM]?)/);
        if (match) likesStr = match[1];
      }
      if (retweetButton) {
        const label = retweetButton.getAttribute("aria-label") || "";
        const match = label.match(/([\d,.]+[KM]?)/);
        if (match) retweetsStr = match[1];
      }
      if (replyButton) {
        const label = replyButton.getAttribute("aria-label") || "";
        const match = label.match(/([\d,.]+[KM]?)/);
        if (match) repliesStr = match[1];
      }
      
      if (likesStr === "0" && likeButton) {
        const span = likeButton.querySelector('span[data-testid="app-text-transition-container"]');
        if (span && span.textContent) likesStr = span.textContent;
      }
      if (retweetsStr === "0" && retweetButton) {
        const span = retweetButton.querySelector('span[data-testid="app-text-transition-container"]');
        if (span && span.textContent) retweetsStr = span.textContent;
      }
      if (repliesStr === "0" && replyButton) {
        const span = replyButton.querySelector('span[data-testid="app-text-transition-container"]');
        if (span && span.textContent) repliesStr = span.textContent;
      }

      if (textEl) {
        const href = linkEl?.getAttribute("href") || "";
        const tweetIdMatch = href.match(/\/status\/(\d+)/);
        const handleMatch = href.match(/\/([^/]+)\/status/);
        const originalHandle = handleMatch ? handleMatch[1] : "unknown";

        items.push({
          tweetId: tweetIdMatch ? tweetIdMatch[1] : Math.random().toString(),
          handle: originalHandle,
          content: textEl.textContent || "",
          postedAt: timeEl?.getAttribute("datetime") || new Date().toISOString(),
          likesStr,
          retweetsStr,
          repliesStr,
          isRetweet,
          retweetedBy: isRetweet ? handle : null,
          isQuoteRetweet,
        });
      }
    });

    return items.slice(0, 10);
  }, profileHandle);
}

export async function scrapeTwitterProfile(handle: string): Promise<Tweet[]> {
  const { browser, page } = await createAuthenticatedContext();

  try {
    console.log(`Scraping Twitter profile: @${handle}`);
    
    await randomDelay(1000, 2000);
    
    await page.goto(`https://x.com/${handle}`, { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });
    
    console.log("Page loaded, waiting for tweets...");
    
    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });
      console.log("Tweet selector found!");
    } catch {
      console.log("Tweet selector not found, waiting more...");
    }
    
    await randomDelay(3000, 5000);
    
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await randomDelay(1000, 2000);
    }

    const rawTweets = await extractTweets(page, handle);
    console.log(`Found ${rawTweets.length} tweets from @${handle}`);

    await browser.close();

    return rawTweets.map((t) => ({
      tweetId: t.tweetId,
      handle: t.handle,
      content: t.content,
      postedAt: new Date(t.postedAt),
      likes: parseEngagementNumber(t.likesStr),
      retweets: parseEngagementNumber(t.retweetsStr),
      replies: parseEngagementNumber(t.repliesStr),
      isRetweet: t.isRetweet,
      retweetedBy: t.retweetedBy,
      isQuoteRetweet: t.isQuoteRetweet,
    }));
  } catch (error) {
    console.error(`Error scraping @${handle}:`, error);
    await browser.close();
    return [];
  }
}

export async function scrapeTwitterSearch(query: string): Promise<Tweet[]> {
  const { browser, page } = await createAuthenticatedContext();

  try {
    console.log(`Searching Twitter for: ${query}`);
    
    await randomDelay(1000, 2000);
    
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
    console.log("URL:", searchUrl);
    
    await page.goto(searchUrl, { 
      waitUntil: "domcontentloaded",
      timeout: 30000 
    });
    
    console.log("Search page loaded, waiting for tweets...");
    
    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });
      console.log("Tweet selector found!");
    } catch {
      console.log("Tweet selector not found");
      const content = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log("Page content:", content);
    }
    
    await randomDelay(3000, 5000);

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await randomDelay(1000, 2000);
    }

    const rawTweets = await extractTweets(page, "");
    console.log(`Found ${rawTweets.length} tweets for "${query}"`);

    await browser.close();

    return rawTweets.map((t) => ({
      tweetId: t.tweetId,
      handle: t.handle,
      content: t.content,
      postedAt: new Date(t.postedAt),
      likes: parseEngagementNumber(t.likesStr),
      retweets: parseEngagementNumber(t.retweetsStr),
      replies: parseEngagementNumber(t.repliesStr),
      isRetweet: t.isRetweet,
      retweetedBy: t.retweetedBy,
      isQuoteRetweet: t.isQuoteRetweet,
    }));
  } catch (error) {
    console.error(`Error searching Twitter:`, error);
    await browser.close();
    return [];
  }
}