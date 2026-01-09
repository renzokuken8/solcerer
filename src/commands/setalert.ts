import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getTokenInfo } from "../utils/helius";
import { supabase } from "../utils/supabase";

function formatMarketCap(mc: number): string {
  if (mc >= 1000000000) {
    return `$${(mc / 1000000000).toFixed(2)}B`;
  } else if (mc >= 1000000) {
    return `$${(mc / 1000000).toFixed(2)}M`;
  } else if (mc >= 1000) {
    return `$${(mc / 1000).toFixed(2)}K`;
  }
  return `$${mc}`;
}

export async function handleSetAlertCommand(interaction: ChatInputCommandInteraction) {
  const mint = interaction.options.getString("mint", true);
  const type = interaction.options.getString("type", true);
  const marketcap = interaction.options.getNumber("marketcap", true);
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
      threshold: marketcap,
    });

    const embed = new EmbedBuilder()
      .setTitle("🔔 Alert Created")
      .setDescription(`You'll be notified when **${name} (${symbol})** market cap goes **${type}** ${formatMarketCap(marketcap)}`)
      .addFields(
        { name: "Mint", value: `\`${mint}\`` },
        { name: "Target", value: `${type} ${formatMarketCap(marketcap)} market cap` }
      )
      .setColor(0x00FF00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /setalert command:", error);
    try {
      await interaction.editReply("Error creating alert. Try again later.");
    } catch {
      console.log("Could not send error message");
    }
  }
}