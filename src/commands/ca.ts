import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getTokenInfo } from "../utils/helius";
import { supabase } from "../utils/supabase";

export async function handleCaCommand(interaction: ChatInputCommandInteraction) {
  const mint = interaction.options.getString("mint", true);

  await interaction.deferReply();

  try {
    // Get token info from Helius
    const tokenInfo = await getTokenInfo(mint);

    const name = tokenInfo?.content?.metadata?.name || "Unknown";
    const symbol = tokenInfo?.content?.metadata?.symbol || "???";
    const image = tokenInfo?.content?.links?.image || null;

    // Get price data from DexScreener
    const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const dexData = (await dexResponse.json()) as any;
    
    let price = "N/A";
    let priceChange = "N/A";
    let marketCap = "N/A";
    let volume = "N/A";
    let liquidity = "N/A";
    let priceChange1h = "N/A";
    let buys1h = 0;
    let sells1h = 0;
    let pairAddress = "";
    let ath = "N/A";
    let age = "N/A";

    if (dexData.pairs && dexData.pairs.length > 0) {
      const pair = dexData.pairs[0];
      pairAddress = pair.pairAddress || "";
      
      price = pair.priceUsd ? `$${parseFloat(pair.priceUsd).toFixed(6)}` : "N/A";
      priceChange = pair.priceChange?.h24 ? `${pair.priceChange.h24 > 0 ? "+" : ""}${pair.priceChange.h24}%` : "N/A";
      priceChange1h = pair.priceChange?.h1 ? `${pair.priceChange.h1 > 0 ? "+" : ""}${pair.priceChange.h1}%` : "N/A";
      
      if (pair.marketCap) {
        marketCap = pair.marketCap > 1000000 
          ? `$${(pair.marketCap / 1000000).toFixed(2)}M` 
          : `$${(pair.marketCap / 1000).toFixed(2)}K`;
      }
      
      if (pair.volume?.h24) {
        volume = pair.volume.h24 > 1000000 
          ? `$${(pair.volume.h24 / 1000000).toFixed(2)}M` 
          : `$${(pair.volume.h24 / 1000).toFixed(2)}K`;
      }
      
      if (pair.liquidity?.usd) {
        liquidity = pair.liquidity.usd > 1000000 
          ? `$${(pair.liquidity.usd / 1000000).toFixed(2)}M` 
          : `$${(pair.liquidity.usd / 1000).toFixed(2)}K`;
      }

      if (pair.txns?.h1) {
        buys1h = pair.txns.h1.buys || 0;
        sells1h = pair.txns.h1.sells || 0;
      }

      // Calculate age
      if (pair.pairCreatedAt) {
        const created = new Date(pair.pairCreatedAt);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        age = `${diffDays}d`;
      }
    }

    // Save to database
    await supabase.from("tokens").upsert({
      mint,
      name,
      symbol,
      image,
      price: parseFloat(price.replace(/[$,]/g, "")) || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "mint" });

    // Build the embed similar to the bot you showed
    const statsText = [
      `├ USD   ${price} (${priceChange})`,
      `├ MC    ${marketCap}`,
      `├ Vol   ${volume}`,
      `├ LP    ${liquidity}`,
      `├ 1H    ${priceChange1h} 🅑 ${buys1h} Ⓢ ${sells1h}`,
      `└ Age   ${age}`,
    ].join("\n");

    const links = [
      `[DS](https://dexscreener.com/solana/${pairAddress || mint})`,
      `[GT](https://www.geckoterminal.com/solana/pools/${mint})`,
      `[EXP](https://solscan.io/token/${mint})`,
      `[𝕏](https://x.com/search?q=$${symbol}%20OR%20${mint}&src=typed_query&f=live)`,
    ].join(" • ");

    const tradeLinks = [
      `[AXI](https://axiom.trade/t/${mint})`,
      `[PHO](https://photon-sol.tinyastro.io/en/lp/${mint})`,
      `[GM](https://gmgn.ai/sol/token/${mint})`,
    ].join(" • ");

    const embed = new EmbedBuilder()
      .setTitle(`${name} ($${symbol})`)
      .setDescription(`\`${mint}\`\n#SOL | ${age}`)
      .addFields(
        { name: "📊 Stats", value: `\`\`\`\n${statsText}\n\`\`\`` },
        { name: "🔗 Charts", value: links },
        { name: "💱 Trade", value: tradeLinks }
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