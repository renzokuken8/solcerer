import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { scrapeTrendingTokens } from "../scrapers/dexscreener";

export async function handleTrendingCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();
  } catch {
    console.log("Failed to defer reply");
    return;
  }

  try {
    const tokens = await scrapeTrendingTokens();

    if (tokens.length === 0) {
      await interaction.editReply("Could not fetch trending tokens. Try again later.");
      return;
    }

    const lines = tokens.map((t, i) => {
      return `**${i + 1}. ${t.name}**\n\`${t.mint.slice(0, 20)}...\`\n${t.price} (${t.priceChange})`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🔥 Trending on Solana")
      .setDescription(lines.join("\n\n"))
      .setColor(0xFF6600)
      .setFooter({ text: "Scraped from DEX Screener • Use /ca <mint> for details" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /trending command:", error);
    try {
      await interaction.editReply("Error fetching trending tokens. Try again later.");
    } catch {
      console.log("Could not send error message");
    }
  }
}