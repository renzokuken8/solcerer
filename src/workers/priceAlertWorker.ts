import { Client, TextChannel, EmbedBuilder } from "discord.js";
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

export async function startPriceAlertWorker(client: Client) {
  console.log("Price alert worker started - checking every 1 minute");

  // Run every 1 minute
  setInterval(async () => {
    await checkPriceAlerts(client);
  }, 60 * 1000);

  // Run once on startup after 15 seconds
  setTimeout(async () => {
    await checkPriceAlerts(client);
  }, 15 * 1000);
}

async function checkPriceAlerts(client: Client) {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Checking price alerts...`);

    // Simple query without join first
    const { data: alerts, error } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("triggered", false);

    if (error) {
      console.error("Error fetching alerts:", error);
      return;
    }

    if (!alerts || alerts.length === 0) {
      console.log("No active price alerts");
      return;
    }

    console.log(`Found ${alerts.length} active alert(s)`);

    const channelId = process.env.CHANNEL_PRICE_ALERTS;
    if (!channelId) {
      console.log("CHANNEL_PRICE_ALERTS not set in .env");
      return;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      console.log("Could not find price alerts channel");
      return;
    }

    // Group alerts by mint to reduce API calls
    const mintSet = new Set(alerts.map((a) => a.mint));
    const mints = [...mintSet];

    // Fetch current prices from DexScreener
    for (const mint of mints) {
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        const data = (await response.json()) as any;

        if (!data.pairs || data.pairs.length === 0) {
          console.log(`No price data for ${mint}`);
          continue;
        }

        const pair = data.pairs[0];
        const currentMC = pair.marketCap || 0;
        const currentPrice = parseFloat(pair.priceUsd) || 0;
        const tokenName = pair.baseToken?.name || "Unknown";
        const tokenSymbol = pair.baseToken?.symbol || "???";
        
        console.log(`${tokenSymbol} MC: ${formatMarketCap(currentMC)}`);

        // Check alerts for this mint
        const mintAlerts = alerts.filter((a) => a.mint === mint);

        for (const alert of mintAlerts) {
          let triggered = false;

          console.log(`Checking alert: ${alert.type} ${formatMarketCap(alert.threshold)} vs current ${formatMarketCap(currentMC)}`);

          if (alert.type === "above" && currentMC >= alert.threshold) {
            triggered = true;
          } else if (alert.type === "below" && currentMC <= alert.threshold) {
            triggered = true;
          }

          if (triggered) {
            console.log(`Alert triggered for ${mint}`);

            // Mark as triggered
            await supabase
              .from("price_alerts")
              .update({ triggered: true })
              .eq("id", alert.id);

            // Send alert
            const embed = new EmbedBuilder()
              .setTitle("🚨 Price Alert Triggered!")
              .setDescription(`**${tokenName} (${tokenSymbol})** market cap has gone **${alert.type}** ${formatMarketCap(alert.threshold)}`)
              .addFields(
                { name: "Current MC", value: formatMarketCap(currentMC), inline: true },
                { name: "Current Price", value: `$${currentPrice.toFixed(6)}`, inline: true },
                { name: "Target", value: `${alert.type} ${formatMarketCap(alert.threshold)}`, inline: true },
                { name: "Mint", value: `\`${mint}\``, inline: false }
              )
              .setColor(alert.type === "above" ? 0x00FF00 : 0xFF0000)
              .setTimestamp();

            await channel.send({
              content: `<@${alert.user_id}>`,
              embeds: [embed],
            });
          }
        }

        // Small delay between API calls
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        console.error(`Error checking price for ${mint}:`, error);
      }
    }

    console.log(`[${new Date().toLocaleTimeString()}] Finished checking price alerts`);
  } catch (error) {
    console.error("Error in price alert worker:", error);
  }
}