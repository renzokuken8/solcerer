import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { scrapeTwitterProfile, scrapeTwitterSearch } from "../scrapers/twitter";
import { analyzeSentiment } from "../utils/openai";

export async function handleAnalyzeCommand(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString("query", true);

  try {
    await interaction.deferReply();
  } catch {
    console.log("Failed to defer reply");
    return;
  }

  try {
    let tweets;
    let searchType = "";
    
    // Check if it's a Twitter handle
    if (query.startsWith("@")) {
      const handle = query.replace("@", "");
      searchType = `@${handle}'s tweets`;
      console.log(`Analyzing profile: @${handle}`);
      tweets = await scrapeTwitterProfile(handle);
    } else {
      // Search for the query
      searchType = `"${query}"`;
      console.log(`Analyzing search: ${query}`);
      tweets = await scrapeTwitterSearch(query);
    }

    console.log(`Scraped ${tweets.length} tweets`);

    if (tweets.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`🔍 Analysis: ${query}`)
            .setDescription("No tweets found. Twitter may be blocking the request or there are no recent tweets for this query.\n\nTry again in a few minutes or try a different search term.")
            .setColor(0xFF0000)
            .setTimestamp()
        ]
      });
      return;
    }

    // Prepare tweet content for GPT
    const tweetTexts = tweets.map(t => `@${t.handle}: ${t.content}`);
    console.log("Sending to GPT-4o for analysis...");

    // Analyze with GPT-4o
    let analysis;
    try {
      analysis = await analyzeSentiment(tweetTexts);
    } catch (error) {
      console.error("GPT-4o error:", error);
      analysis = {
        summary: `Found ${tweets.length} tweets. Add OpenAI credits to enable AI analysis.`,
        sentiment: "neutral",
        vibeScore: 50,
      };
    }

    // Build sample tweets display
    const topTweets = tweets.slice(0, 3).map((t, i) => {
      const truncated = t.content.length > 150 ? t.content.slice(0, 150) + "..." : t.content;
      return `**${i + 1}. @${t.handle}** (❤️${t.likes} 🔁${t.retweets})\n${truncated}`;
    }).join("\n\n");

    // Calculate total engagement
    const totalLikes = tweets.reduce((sum, t) => sum + t.likes, 0);
    const totalRetweets = tweets.reduce((sum, t) => sum + t.retweets, 0);

    const embed = new EmbedBuilder()
      .setTitle(`🔍 AI Analysis: ${query}`)
      .setDescription(analysis.summary)
      .addFields(
        { name: "Sentiment", value: analysis.sentiment, inline: true },
        { name: "Vibe Score", value: `${analysis.vibeScore}/100`, inline: true },
        { name: "Tweets Analyzed", value: `${tweets.length}`, inline: true },
        { name: "Total Engagement", value: `❤️ ${totalLikes} | 🔁 ${totalRetweets}`, inline: false },
        { name: "📝 Sample Tweets", value: topTweets || "No tweets to display" }
      )
      .setColor(analysis.sentiment === "bullish" ? 0x00FF00 : analysis.sentiment === "bearish" ? 0xFF0000 : 0xFFFF00)
      .setFooter({ text: "Powered by Twitter Scraper + GPT-4o" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /analyze command:", error);
    try {
      await interaction.editReply("Error analyzing. Try again later.");
    } catch {
      console.log("Could not send error message");
    }
  }
}