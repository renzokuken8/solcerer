import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { supabase } from "../utils/supabase";

const WHALE_THRESHOLD_USD = 10000; // $10K+ transactions
const heliusApiKey = process.env.HELIUS_API_KEY;

export async function startWhaleWorker(client: Client) {
  console.log("Whale worker started - checking every 2 minutes");

  // Run every 2 minutes
  setInterval(async () => {
    await checkWhaleMovements(client);
  }, 2 * 60 * 1000);

  // Run once on startup after 20 seconds
  setTimeout(async () => {
    await checkWhaleMovements(client);
  }, 20 * 1000);
}

async function checkWhaleMovements(client: Client) {
  try {
    console.log(`[${new Date().toLocaleTimeString()}] Checking whale movements...`);

    // Get all tracked tokens from watchlist
    const { data: watchlist } = await supabase
      .from("watchlist")
      .select("mint")
      .limit(20);

    if (!watchlist || watchlist.length === 0) {
      console.log("No tokens in watchlist to monitor for whales");
      return;
    }

    const uniqueMints = [...new Set(watchlist.map((w) => w.mint))];
    console.log(`Monitoring ${uniqueMints.length} token(s) for whale activity`);

    const channelId = process.env.CHANNEL_WHALE_MOVES;
    if (!channelId) {
      console.log("CHANNEL_WHALE_MOVES not set in .env");
      return;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      console.log("Could not find whale moves channel");
      return;
    }

    for (const mint of uniqueMints) {
      try {
        // Get recent transactions for this token using Helius
        const response = await fetch(
          `https://api.helius.xyz/v0/addresses/${mint}/transactions?api-key=${heliusApiKey}&limit=20`
        );
        const transactions = (await response.json()) as any[];

        if (!transactions || transactions.length === 0) {
          continue;
        }

        // Get token price from DexScreener
        const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        const dexData = (await dexResponse.json()) as any;
        
        let tokenPrice = 0;
        let tokenName = "Unknown";
        let tokenSymbol = "???";
        
        if (dexData.pairs && dexData.pairs.length > 0) {
          tokenPrice = parseFloat(dexData.pairs[0].priceUsd) || 0;
          tokenName = dexData.pairs[0].baseToken?.name || "Unknown";
          tokenSymbol = dexData.pairs[0].baseToken?.symbol || "???";
        }

        for (const tx of transactions) {
          // Skip if we've already alerted this transaction
          const { data: existing } = await supabase
            .from("whale_moves")
            .select("id")
            .eq("signature", tx.signature)
            .single();

          if (existing) continue;

          // Check token transfers in this transaction
          const tokenTransfers = tx.tokenTransfers || [];
          
          for (const transfer of tokenTransfers) {
            if (transfer.mint !== mint) continue;

            const amount = transfer.tokenAmount || 0;
            const usdValue = amount * tokenPrice;

            if (usdValue >= WHALE_THRESHOLD_USD) {
              console.log(`Whale detected! ${tokenSymbol}: $${usdValue.toFixed(2)}`);

              // Save to database
              await supabase.from("whale_moves").insert({
                signature: tx.signature,
                mint,
                wallet: transfer.fromUserAccount || transfer.toUserAccount,
                amount,
                usd_value: usdValue,
                type: transfer.fromUserAccount ? "sell" : "buy",
              });

              // Determine if buy or sell
              const isSell = transfer.fromUserAccount && transfer.fromUserAccount.length > 0;
              const wallet = isSell ? transfer.fromUserAccount : transfer.toUserAccount;
              const shortWallet = wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : "Unknown";

              const embed = new EmbedBuilder()
                .setTitle(`🐋 Whale ${isSell ? "Sell" : "Buy"} Detected!`)
                .setDescription(`**${tokenName} (${tokenSymbol})**`)
                .addFields(
                  { name: "Amount", value: `${amount.toLocaleString()} ${tokenSymbol}`, inline: true },
                  { name: "Value", value: `$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, inline: true },
                  { name: "Wallet", value: `\`${shortWallet}\``, inline: true },
                  { name: "Mint", value: `\`${mint}\``, inline: false }
                )
                .setColor(isSell ? 0xFF0000 : 0x00FF00)
                .setURL(`https://solscan.io/tx/${tx.signature}`)
                .setTimestamp();

              await channel.send({ embeds: [embed] });
            }
          }
        }

        // Small delay between tokens
        await new Promise((r) => setTimeout(r, 1000));
      } catch (error) {
        console.error(`Error checking whale moves for ${mint}:`, error);
      }
    }

    console.log(`[${new Date().toLocaleTimeString()}] Finished checking whale movements`);
  } catch (error) {
    console.error("Error in whale worker:", error);
  }
}