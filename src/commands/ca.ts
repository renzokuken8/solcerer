import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getTokenInfo } from "../utils/helius";
import { supabase } from "../utils/supabase";

export async function handleCaCommand(interaction: ChatInputCommandInteraction) {
  const mint = interaction.options.getString("mint", true);

  await interaction.deferReply();

  try {
    const tokenInfo = await getTokenInfo(mint);

    if (!tokenInfo) {
      await interaction.editReply("Token not found. Check the mint address.");
      return;
    }

    const name = tokenInfo.content?.metadata?.name || "Unknown";
    const symbol = tokenInfo.content?.metadata?.symbol || "???";
    const image = tokenInfo.content?.links?.image || null;

    // Save to database
    await supabase.from("tokens").upsert({
      mint,
      name,
      symbol,
      image,
      updated_at: new Date().toISOString(),
    }, { onConflict: "mint" });

    const embed = new EmbedBuilder()
      .setTitle(`${name} (${symbol})`)
      .setDescription(`Mint: \`${mint}\``)
      .addFields(
        { name: "Token Standard", value: tokenInfo.interface || "Unknown", inline: true },
        { name: "Compressed", value: tokenInfo.compression?.compressed ? "Yes" : "No", inline: true }
      )
      .setColor(0x9945FF)
      .setTimestamp();

    if (image) {
      embed.setThumbnail(image);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /ca command:", error);
    await interaction.editReply("Error fetching token info. Try again later.");
  }
}