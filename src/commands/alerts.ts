import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { supabase } from "../utils/supabase";

export async function handleAlertsCommand(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  await interaction.deferReply();

  try {
    // Ensure user exists
    await supabase.from("users").upsert({ id: userId }, { onConflict: "id" });

    // Get user's alerts
    const { data: alerts } = await supabase
      .from("price_alerts")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!alerts || alerts.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle("🔔 Your Price Alerts")
        .setDescription("You have no active alerts.\n\nTo create an alert, use:\n`/track <mint>` to add a token first")
        .setColor(0x9945FF)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get token details
    const mints = [...new Set(alerts.map((a) => a.mint))];
    const { data: tokens } = await supabase
      .from("tokens")
      .select("mint, name, symbol")
      .in("mint", mints);

    const tokenMap = new Map(tokens?.map((t) => [t.mint, t]) || []);

    const lines = alerts.map((alert, i) => {
      const token = tokenMap.get(alert.mint);
      const name = token?.name || "Unknown";
      const symbol = token?.symbol || "???";
      const status = alert.triggered ? "✅ Triggered" : "⏳ Active";
      
      return `${i + 1}. **${name}** (${symbol})\n   ${alert.type} $${alert.threshold}\n   Status: ${status}`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🔔 Your Price Alerts")
      .setDescription(lines.join("\n\n"))
      .setColor(0x9945FF)
      .setFooter({ text: `${alerts.length} alert(s)` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error in /alerts command:", error);
    await interaction.editReply("Error fetching alerts. Try again later.");
  }
}