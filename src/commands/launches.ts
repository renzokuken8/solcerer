import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { scrapePumpFunLaunches } from "../scrapers/pumpfun";
import { supabase } from "../utils/supabase";

export async function handleLaunchesCommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const tokens = await scrapePumpFunLaunches();

    if (tokens.length === 0) {
      await interaction.editReply("No launches found. Try again later.");
      return;
    }

    // Save tokens to database
    for (const token of tokens) {
      await supabase.from("tokens").upsert({
        mint: token.mint,
        name: token.name,
        symbol: token.symbol,
        image: token.image,
        launch_platform: "pumpfun",
        updated_at: new Date().toISOString(),
      }, { onConflict: "mint" });
    }

    const lines = tokens.map((t, i) => 
      `${i + 1}. **${t.name}** (${t.symbol})\n\`${t.mint}\``
    );

    const embed = new EmbedBuilder()
      .setTitle("🚀 Latest Pump.fun Launches")
      .setDescription(lines.join("\n\n"))
      .setColor(0x00FF00)
      .setFooter({ text: "Use /ca <mint> for more details" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /launches command:", error);
    await interaction.editReply("Error fetching launches. Try again later.");
  }
}