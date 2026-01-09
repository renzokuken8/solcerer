import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { supabase } from "../utils/supabase";

export async function handleAddTwitterCommand(interaction: ChatInputCommandInteraction) {
  const handle = interaction.options.getString("handle", true).replace("@", "");
  const userId = interaction.user.id;

  try {
    await interaction.deferReply();
  } catch {
    console.log("Failed to defer reply");
    return;
  }

  try {
    // Ensure user exists
    await supabase.from("users").upsert({ id: userId }, { onConflict: "id" });

    // Check if already tracking
    const { data: existing } = await supabase
      .from("tracked_twitter_handles")
      .select()
      .eq("user_id", userId)
      .eq("handle", handle.toLowerCase())
      .single();

    if (existing) {
      await interaction.editReply(`You're already tracking @${handle}`);
      return;
    }

    // Set followed_at to 24 hours ago to catch recent tweets
    const followedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Add to tracked handles
    const { error } = await supabase.from("tracked_twitter_handles").insert({
      user_id: userId,
      handle: handle.toLowerCase(),
      followed_at: followedAt,
    });

    if (error) {
      console.error("Error inserting handle:", error);
      await interaction.editReply("Error adding Twitter handle. Try again.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🐦 Twitter Handle Added")
      .setDescription(`Now tracking **@${handle}**\n\nNew tweets will be posted to the tracked tweets channel.\n\n*Note: Tweets from the last 24 hours will also be included.*`)
      .setColor(0x1DA1F2)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /addtwitter command:", error);
    try {
      await interaction.editReply("Error adding Twitter handle. Try again later.");
    } catch {
      console.log("Could not send error message");
    }
  }
}