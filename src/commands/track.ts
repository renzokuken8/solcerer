import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getTokenInfo } from "../utils/helius";
import { supabase } from "../utils/supabase";

export async function handleTrackCommand(interaction: ChatInputCommandInteraction) {
  const mint = interaction.options.getString("mint", true);
  const userId = interaction.user.id;

  await interaction.deferReply();

  try {
    // Ensure user exists
    await supabase.from("users").upsert({ id: userId }, { onConflict: "id" });

    // Check if already tracking
    const { data: existing } = await supabase
      .from("watchlist")
      .select()
      .eq("user_id", userId)
      .eq("mint", mint)
      .single();

    if (existing) {
      await interaction.editReply("You're already tracking this token.");
      return;
    }

    // Get token info
    const tokenInfo = await getTokenInfo(mint);
    const name = tokenInfo?.content?.metadata?.name || "Unknown";
    const symbol = tokenInfo?.content?.metadata?.symbol || "???";

    // Save token if not exists
    await supabase.from("tokens").upsert({
      mint,
      name,
      symbol,
      updated_at: new Date().toISOString(),
    }, { onConflict: "mint" });

    // Add to watchlist
    await supabase.from("watchlist").insert({
      user_id: userId,
      mint,
    });

    const embed = new EmbedBuilder()
      .setTitle("Token Added to Watchlist")
      .setDescription(`Now tracking **${name} (${symbol})**`)
      .addFields({ name: "Mint", value: `\`${mint}\`` })
      .setColor(0x00FF00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /track command:", error);
    await interaction.editReply("Error adding token to watchlist. Try again later.");
  }
}