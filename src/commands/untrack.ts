import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { supabase } from "../utils/supabase";

export async function handleUntrackCommand(interaction: ChatInputCommandInteraction) {
  const mint = interaction.options.getString("mint", true);
  const userId = interaction.user.id;

  await interaction.deferReply();

  try {
    const { data, error } = await supabase
      .from("watchlist")
      .delete()
      .eq("user_id", userId)
      .eq("mint", mint)
      .select();

    if (error || !data || data.length === 0) {
      await interaction.editReply("This token wasn't in your watchlist.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Token Removed from Watchlist")
      .setDescription(`No longer tracking \`${mint}\``)
      .setColor(0xFF0000)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /untrack command:", error);
    await interaction.editReply("Error removing token. Try again later.");
  }
}