import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getTokenInfo } from "../utils/helius";
import { analyzeSentiment } from "../utils/openai";
import { supabase } from "../utils/supabase";

export async function handlePulseCommand(interaction: ChatInputCommandInteraction) {
  const mint = interaction.options.getString("mint", true);

  await interaction.deferReply();

  try {
    // Check for cached summary
    const { data: cached } = await supabase
      .from("ai_summaries")
      .select()
      .eq("type", "token_pulse")
      .eq("target_id", mint)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached) {
      const embed = new EmbedBuilder()
        .setTitle("📊 Token Pulse (Cached)")
        .setDescription(cached.summary)
        .addFields(
          { name: "Sentiment", value: cached.sentiment || "Unknown", inline: true },
          { name: "Vibe Score", value: `${cached.vibe_score}/100` || "N/A", inline: true }
        )
        .setColor(cached.sentiment === "bullish" ? 0x00FF00 : cached.sentiment === "bearish" ? 0xFF0000 : 0xFFFF00)
        .setFooter({ text: "Cached result" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get token info
    const tokenInfo = await getTokenInfo(mint);
    const name = tokenInfo?.content?.metadata?.name || "Unknown Token";
    const symbol = tokenInfo?.content?.metadata?.symbol || "???";

    // For now, generate analysis based on token data
    // Later we'll add Twitter scraping
    const mockPosts = [
      `${symbol} looking strong today`,
      `Just aped into ${symbol}`,
      `${symbol} dev is active`,
      `Watching ${symbol} closely`,
      `${symbol} chart looks good`,
    ];

    const analysis = await analyzeSentiment(mockPosts);

    // Cache the result for 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabase.from("ai_summaries").upsert({
      type: "token_pulse",
      target_id: mint,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      vibe_score: analysis.vibeScore,
      expires_at: expiresAt,
    }, { onConflict: "type,target_id" });

    const embed = new EmbedBuilder()
      .setTitle(`📊 Token Pulse: ${name} (${symbol})`)
      .setDescription(analysis.summary)
      .addFields(
        { name: "Sentiment", value: analysis.sentiment, inline: true },
        { name: "Vibe Score", value: `${analysis.vibeScore}/100`, inline: true }
      )
      .setColor(analysis.sentiment === "bullish" ? 0x00FF00 : analysis.sentiment === "bearish" ? 0xFF0000 : 0xFFFF00)
      .setFooter({ text: `Mint: ${mint}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /pulse command:", error);
    await interaction.editReply("Error analyzing token. Try again later.");
  }
}