import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { supabase } from "../utils/supabase";

export async function handleRemoveAlertCommand(interaction: ChatInputCommandInteraction) {
  const mint = interaction.options.getString("mint", true);
  const userId = interaction.user.id;

  await interaction.deferReply();

  try {
    const { data, error } = await supabase
      .from("price_alerts")
      .delete()
      .eq("user_id", userId)
      .eq("mint", mint)
      .select();

    if (error || !data || data.length === 0) {
      await interaction.editReply("No alert found for this token.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🔕 Alert Removed")
      .setDescription(`Removed ${data.length} alert(s) for \`${mint}\``)
      .setColor(0xFF0000)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /removealert command:", error);
    await interaction.editReply("Error removing alert. Try again later.");
  }
}