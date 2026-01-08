import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getTokenInfo } from "../utils/helius";
import { supabase } from "../utils/supabase";

export async function handleSetAlertCommand(interaction: ChatInputCommandInteraction) {
  const mint = interaction.options.getString("mint", true);
  const type = interaction.options.getString("type", true);
  const price = interaction.options.getNumber("price", true);
  const userId = interaction.user.id;

  await interaction.deferReply();

  try {
    // Ensure user exists
    await supabase.from("users").upsert({ id: userId }, { onConflict: "id" });

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

    // Create the alert
    await supabase.from("price_alerts").insert({
      user_id: userId,
      mint,
      type,
      threshold: price,
    });

    const embed = new EmbedBuilder()
      .setTitle("🔔 Alert Created")
      .setDescription(`You'll be notified when **${name} (${symbol})** goes **${type}** $${price}`)
      .addFields({ name: "Mint", value: `\`${mint}\`` })
      .setColor(0x00FF00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /setalert command:", error);
    await interaction.editReply("Error creating alert. Try again later.");
  }
}