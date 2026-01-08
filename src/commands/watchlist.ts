import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { supabase } from "../utils/supabase";

export async function handleWatchlistCommand(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  await interaction.deferReply();

  try {
    const { data: watchlist } = await supabase
      .from("watchlist")
      .select("mint, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!watchlist || watchlist.length === 0) {
      await interaction.editReply("Your watchlist is empty. Use `/track` to add tokens.");
      return;
    }

    // Get token details
    const mints = watchlist.map((w) => w.mint);
    const { data: tokens } = await supabase
      .from("tokens")
      .select("mint, name, symbol")
      .in("mint", mints);

    const tokenMap = new Map(tokens?.map((t) => [t.mint, t]) || []);

    const lines = watchlist.map((w, i) => {
      const token = tokenMap.get(w.mint);
      const name = token?.name || "Unknown";
      const symbol = token?.symbol || "???";
      return `${i + 1}. **${name}** (${symbol})\n\`${w.mint}\``;
    });

    const embed = new EmbedBuilder()
      .setTitle("Your Watchlist")
      .setDescription(lines.join("\n\n"))
      .setColor(0x9945FF)
      .setFooter({ text: `${watchlist.length} token(s)` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /watchlist command:", error);
    await interaction.editReply("Error fetching watchlist. Try again later.");
  }
}