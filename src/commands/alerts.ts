import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
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

export async function handleAlertsCommand(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  try {
    await interaction.deferReply();
  } catch {
    console.log("Failed to defer reply");
    return;
  }

  try {
    console.log("Fetching alerts for user:", userId);

    // Query without join first to debug
    const { data: alerts, error } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("user_id", userId)
      .eq("triggered", false);

    console.log("Query result:", alerts, error);

    if (error) {
      console.error("Supabase error:", error);
      await interaction.editReply("Error fetching alerts. Try again later.");
      return;
    }

    if (!alerts || alerts.length === 0) {
      await interaction.editReply("You have no active alerts. Use `/setalert` to create one.");
      return;
    }

    // Get token info from DexScreener for each alert
    const lines = [];
    for (const alert of alerts) {
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${alert.mint}`);
        const data = (await response.json()) as any;
        
        let name = "Unknown";
        let symbol = "???";
        
        if (data.pairs && data.pairs.length > 0) {
          name = data.pairs[0].baseToken?.name || "Unknown";
          symbol = data.pairs[0].baseToken?.symbol || "???";
        }
        
        lines.push(`**${name} (${symbol})**\n└ ${alert.type} ${formatMarketCap(alert.threshold)}`);
      } catch {
        lines.push(`**Unknown Token**\n└ ${alert.type} ${formatMarketCap(alert.threshold)}`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("🔔 Your Price Alerts")
      .setDescription(lines.join("\n\n"))
      .setColor(0x00FF00)
      .setFooter({ text: "Use /removealert to delete an alert" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /alerts command:", error);
    try {
      await interaction.editReply("Error fetching alerts. Try again later.");
    } catch {
      console.log("Could not send error message");
    }
  }
}