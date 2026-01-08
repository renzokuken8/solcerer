import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { supabase } from "../utils/supabase";

export async function handleFollowingCommand(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  await interaction.deferReply();

  try {
    const { data: handles } = await supabase
      .from("tracked_twitter_handles")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!handles || handles.length === 0) {
      await interaction.editReply("You're not tracking any Twitter accounts. Use `/addtwitter` to add one.");
      return;
    }

    const lines = handles.map((h, i) => `${i + 1}. **@${h.handle}**`);

    const embed = new EmbedBuilder()
      .setTitle("🐦 Tracked Twitter Accounts")
      .setDescription(lines.join("\n"))
      .setColor(0x1DA1F2)
      .setFooter({ text: `${handles.length} account(s)` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /following command:", error);
    await interaction.editReply("Error fetching tracked accounts. Try again later.");
  }
}