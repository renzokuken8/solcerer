import { ChatInputCommandInteraction } from "discord.js";
import { supabase } from "../utils/supabase";
import { scrapeTwitterProfile } from "../scrapers/twitter";
import { EmbedBuilder, TextChannel } from "discord.js";

export async function handleCheckTwitterCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();
  } catch {
    console.log("Failed to defer reply");
    return;
  }

  try {
    // Get all tracked handles with their followed_at timestamp
    const { data: tracked } = await supabase
      .from("tracked_twitter_handles")
      .select("handle, followed_at")
      .limit(10);

    if (!tracked || tracked.length === 0) {
      await interaction.editReply("No tracked accounts found. Use `/addtwitter` to add one.");
      return;
    }

    const handleMap = new Map<string, Date>();
    tracked.forEach((t) => {
      const handle = t.handle.toLowerCase();
      const followedAt = new Date(t.followed_at);
      if (!handleMap.has(handle) || followedAt < handleMap.get(handle)!) {
        handleMap.set(handle, followedAt);
      }
    });

    await interaction.editReply(`Checking ${handleMap.size} account(s)... This may take a minute.`);

    const channelId = process.env.CHANNEL_TRACKED_TWEETS;
    if (!channelId) {
      await interaction.editReply("CHANNEL_TRACKED_TWEETS not set in .env");
      return;
    }

    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      await interaction.editReply("Could not find tracked tweets channel");
      return;
    }

    let totalNew = 0;

    for (const [handle, followedAt] of handleMap) {
      try {
        console.log(`Checking @${handle}, followed at ${followedAt.toISOString()}`);
        
        const tweets = await scrapeTwitterProfile(handle);
        console.log(`Found ${tweets.length} total tweets`);

        if (tweets.length === 0) {
          continue;
        }

        // Log tweet timestamps for debugging
        tweets.forEach((t, i) => {
          console.log(`Tweet ${i + 1}: ${t.postedAt.toISOString()} - ${t.content.substring(0, 50)}...`);
        });

        // Filter tweets that are newer than when user started following
        const newTweets = tweets.filter((t) => t.postedAt > followedAt);
        console.log(`${newTweets.length} tweets after follow date`);

        if (newTweets.length === 0) {
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
        console.log(`${unpostedTweets.length} unposted tweets`);

        for (const tweet of unpostedTweets.slice(0, 3)) {
          // Save to database
          await supabase.from("tweets").insert({
            tweet_id: tweet.tweetId,
            handle: tweet.handle,
            content: tweet.content,
            posted_at: tweet.postedAt.toISOString(),
            alert_sent: true,
          });

          let title = `@${tweet.handle}`;
          let description = tweet.content;
          
          if (tweet.isRetweet && tweet.retweetedBy) {
            title = `🔁 @${tweet.retweetedBy} retweeted @${tweet.handle}`;
          }
          
          if (tweet.isQuoteRetweet && tweet.retweetedBy) {
            title = `💬 @${tweet.retweetedBy} quoted @${tweet.handle}`;
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
            .setColor(tweet.isRetweet ? 0x17BF63 : tweet.isQuoteRetweet ? 0x794BC4 : 0x1DA1F2)
            .setURL(`https://x.com/${tweet.handle}/status/${tweet.tweetId}`)
            .setTimestamp(tweet.postedAt);

          await channel.send({ embeds: [embed] });
          totalNew++;
          
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (error) {
        console.error(`Error checking @${handle}:`, error);
      }
    }

    await interaction.editReply(`Done! Found ${totalNew} new tweet(s).`);
  } catch (error) {
    console.error("Error in /checktwitter command:", error);
    try {
      await interaction.editReply("Error checking Twitter. Try again later.");
    } catch {
      console.log("Could not send error message");
    }
  }
}