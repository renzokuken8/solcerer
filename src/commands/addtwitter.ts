import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { supabase } from "../utils/supabase";

export async function handleAddTwitterCommand(interaction: ChatInputCommandInteraction) {
  const handle = interaction.options.getString("handle", true).replace("@", "");
  const userId = interaction.user.id;

  await interaction.deferReply();

  try {
    // Ensure user exists
    await supabase.from("users").upsert({ id: userId }, { onConflict: "id" });

    // Check if already tracking
    const { data: existing } = await supabase
      .from("tracked_twitter_handles")
      .select()
      .eq("user_id", userId)
      .eq("handle", handle)
      .single();

    if (existing) {
      await interaction.editReply(`You're already tracking @${handle}`);
      return;
    }

    // Add to tracked handles
    await supabase.from("tracked_twitter_handles").insert({
      user_id: userId,
      handle,
    });

    const embed = new EmbedBuilder()
      .setTitle("🐦 Twitter Handle Added")
      .setDescription(`Now tracking **@${handle}**\n\nNew tweets will be posted to the tracked tweets channel.`)
      .setColor(0x1DA1F2)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /addtwitter command:", error);
    await interaction.editReply("Error adding Twitter handle. Try again later.");
  }
}