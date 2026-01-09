import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { supabase } from "../utils/supabase";

export async function handleRemoveTwitterCommand(interaction: ChatInputCommandInteraction) {
  const handle = interaction.options.getString("handle", true).replace("@", "");
  const userId = interaction.user.id;

  try {
    await interaction.deferReply();
  } catch {
    console.log("Failed to defer reply");
    return;
  }

  try {
    const { data, error } = await supabase
      .from("tracked_twitter_handles")
      .delete()
      .eq("user_id", userId)
      .eq("handle", handle.toLowerCase())
      .select();

    if (error || !data || data.length === 0) {
      await interaction.editReply(`You weren't tracking @${handle}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🐦 Twitter Handle Removed")
      .setDescription(`No longer tracking **@${handle}**`)
      .setColor(0xFF0000)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /removetwitter command:", error);
    try {
      await interaction.editReply("Error removing Twitter handle. Try again later.");
    } catch {
      console.log("Could not send error message");
    }
  }
}