import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getTokenInfo } from "../utils/helius";
import { getTokenSocial } from "../utils/lunarcrush";

export async function handlePulseCommand(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString("query", true);

  try {
    await interaction.deferReply();
  } catch {
    console.log("Failed to defer reply, interaction may have expired");
    return;
  }

  try {
    const isMint = query.length > 30 && !query.includes(" ");
    
    let name = query;
    let symbol = query.replace("$", "").toUpperCase();

    if (isMint) {
      const tokenInfo = await getTokenInfo(query);
      name = tokenInfo?.content?.metadata?.name || "Unknown Token";
      symbol = tokenInfo?.content?.metadata?.symbol?.toUpperCase() || query.slice(0, 6);
    }

    console.log(`Fetching social data for: ${symbol}`);
    const socialData = await getTokenSocial(symbol);

    let embed;

    if (socialData) {
      const sentimentLabel = socialData.galaxy_score > 60 ? "bullish" : socialData.galaxy_score < 40 ? "bearish" : "neutral";
      
      embed = new EmbedBuilder()
        .setTitle(`📊 Token Pulse: ${symbol}`)
        .addFields(
          { name: "💫 Galaxy Score", value: `${socialData.galaxy_score}/100`, inline: true },
          { name: "📈 AltRank", value: `#${socialData.alt_rank}`, inline: true },
          { name: "🎯 Sentiment", value: sentimentLabel, inline: true },
          { name: "💬 Engagements", value: socialData.engagements, inline: true },
          { name: "🔊 Mentions", value: socialData.mentions, inline: true },
          { name: "💰 Price", value: `$${socialData.price}`, inline: true }
        )
        .setColor(sentimentLabel === "bullish" ? 0x00FF00 : sentimentLabel === "bearish" ? 0xFF0000 : 0xFFFF00)
        .setFooter({ text: "Powered by LunarCrush • Live data" })
        .setTimestamp();
    } else {
      embed = new EmbedBuilder()
        .setTitle(`📊 Token Pulse: ${symbol}`)
        .setDescription(`No social data found for ${symbol}. The token may not be tracked by LunarCrush.`)
        .setColor(0xFFFF00)
        .setTimestamp();
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /pulse command:", error);
    try {
      await interaction.editReply("Error analyzing token. Try again later.");
    } catch {
      console.log("Could not send error message");
    }
  }
}