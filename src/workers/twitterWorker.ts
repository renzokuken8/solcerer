import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { supabase } from "../utils/supabase";
import { scrapeTwitterProfile } from "../scrapers/twitter";

export async function startTwitterWorker(client: Client) {
  console.log("Twitter worker started - checking every 1 minute");

  // Run every 1 minute
  setInterval(async () => {
    await checkTrackedAccounts(client);
  }, 60 * 1000);

  // Run once on startup after 10 seconds
  setTimeout(async () => {
    await checkTrackedAccounts(client);
  }, 10 * 1000);
}

async function checkTrackedAccounts(client: Client) {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Checking tracked Twitter accounts...`);

    // Get all tracked handles with their followed_at timestamp
    const { data: tracked } = await supabase
      .from("tracked_twitter_handles")
      .select("handle, followed_at")
      .limit(10);

    if (!tracked || tracked.length === 0) {
      console.log("No tracked accounts found");
      return;
    }

    // Group by handle and get earliest followed_at
    const handleMap = new Map<string, Date>();
    tracked.forEach((t) => {
      const handle = t.handle.toLowerCase();
      const followedAt = new Date(t.followed_at);
      if (!handleMap.has(handle) || followedAt < handleMap.get(handle)!) {
        handleMap.set(handle, followedAt);
      }
    });

    console.log(`Checking ${handleMap.size} handle(s)`);

    const channelId = process.env.CHANNEL_TRACKED_TWEETS;
    if (!channelId) {
      console.log("CHANNEL_TRACKED_TWEETS not set in .env");
      return;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      console.log("Could not find tracked tweets channel");
      return;
    }

    for (const [handle, followedAt] of handleMap) {
      try {
        // Add small delay between accounts to avoid rate limits
        await new Promise((r) => setTimeout(r, 2000));

        const tweets = await scrapeTwitterProfile(handle);
        
        if (tweets.length === 0) {
          console.log(`No tweets found for @${handle}`);
          continue;
        }

        // Filter tweets that are newer than when user started following
        const newTweets = tweets.filter((t) => t.postedAt > followedAt);

        if (newTweets.length === 0) {
          console.log(`@${handle}: No new tweets since following`);
          continue;
        }

        // Check which tweets we've already posted
        const tweetIds = newTweets.map((t) => t.tweetId);
        const { data: existing } = await supabase
          .from("tweets")
          .select("tweet_id")
          .in("tweet_id", tweetIds);

        const existingIds = new Set(existing?.map((e) => e.tweet_id) || []);
        const unpostedTweets = newTweets.filter((t) => !existingIds.has(t.tweetId));

        if (unpostedTweets.length === 0) {
          console.log(`@${handle}: All tweets already posted`);
          continue;
        }

        console.log(`@${handle}: Posting ${unpostedTweets.length} new tweet(s)`);

        for (const tweet of unpostedTweets) {
          // Save to database
          await supabase.from("tweets").insert({
            tweet_id: tweet.tweetId,
            handle: tweet.handle,
            content: tweet.content,
            posted_at: tweet.postedAt.toISOString(),
            alert_sent: true,
          });

          // Build title based on tweet type
          let title = `@${handle}`;
          let description = tweet.content;
          let color = 0x1DA1F2; // Default Twitter blue
          
          // Handle retweets
          if (tweet.isRetweet && tweet.retweetedBy) {
            title = `🔁 @${tweet.retweetedBy} retweeted @${tweet.handle}`;
            color = 0x17BF63; // Green
          }
          // Handle quote tweets
          else if (tweet.isQuoteRetweet) {
            title = `💬 @${handle} quoted`;
            if (tweet.quotedTweet) {
              description = `${tweet.content}\n\n┌─────────────────\n│ ${tweet.quotedTweet.substring(0, 200)}${tweet.quotedTweet.length > 200 ? '...' : ''}\n└─────────────────`;
            }
            color = 0x794BC4; // Purple
          }
          // Handle replies
          else if (tweet.isReply && tweet.replyingTo) {
            title = `↩️ @${handle} replied to ${tweet.replyingTo}`;
            color = 0xFFAD1F; // Orange
          }

          const embed = new EmbedBuilder()
            .setAuthor({ 
              name: title,
              url: `https://x.com/${tweet.handle}/status/${tweet.tweetId}`,
            })
            .setDescription(description.length > 4000 ? description.slice(0, 4000) + "..." : description)
            .addFields(
              { name: "❤️ Likes", value: tweet.likes.toLocaleString(), inline: true },
              { name: "🔁 Retweets", value: tweet.retweets.toLocaleString(), inline: true },
            )
            .setColor(color)
            .setURL(`https://x.com/${tweet.handle}/status/${tweet.tweetId}`)
            .setTimestamp(tweet.postedAt);

          await channel.send({ embeds: [embed] });
          console.log(`Posted tweet from @${handle}`);
          
          // Small delay between posts
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (error) {
        console.error(`Error checking @${handle}:`, error);
      }
    }

    console.log(`[${new Date().toLocaleTimeString()}] Finished checking`);
  } catch (error) {
    console.error("Error in Twitter worker:", error);
  }
}