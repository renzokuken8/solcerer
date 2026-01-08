import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getTokenInfo } from "../utils/helius";
import { supabase } from "../utils/supabase";
import { checkTokenRisks } from "../utils/riskcheck";

async function findMintBySymbol(query: string): Promise<string | null> {
  try {
    const searchQuery = query.replace("$", "").toUpperCase();
    const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${searchQuery}`);
    const data = (await response.json()) as any;
    
    if (data.pairs && data.pairs.length > 0) {
      const solanaPair = data.pairs.find((p: any) => p.chainId === "solana");
      if (solanaPair) {
        return solanaPair.baseToken.address;
      }
    }
    return null;
  } catch (error) {
    console.error("Error searching for token:", error);
    return null;
  }
}

export async function handleCaCommand(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString("mint", true);
  const userId = interaction.user.id;
  const username = interaction.user.username;

  await interaction.deferReply();

  try {
    let mint = query;
    const isMint = query.length > 30 && !query.includes(" ");
    
    if (!isMint) {
      const foundMint = await findMintBySymbol(query);
      if (!foundMint) {
        await interaction.editReply(`Could not find token: ${query}`);
        return;
      }
      mint = foundMint;
    }

    // Get token info from Helius
    const tokenInfo = await getTokenInfo(mint);

    const name = tokenInfo?.content?.metadata?.name || "Unknown";
    const symbol = tokenInfo?.content?.metadata?.symbol || "???";
    const image = tokenInfo?.content?.links?.image || null;

    // Get risk flags
    const risks = await checkTokenRisks(mint);

    // Get price data from DexScreener
    const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    const dexData = (await dexResponse.json()) as any;
    
    let price = "N/A";
    let priceChange = "N/A";
    let marketCap = "N/A";
    let marketCapRaw = 0;
    let volume = "N/A";
    let liquidity = "N/A";
    let priceChange1h = "N/A";
    let buys1h = 0;
    let sells1h = 0;
    let pairAddress = "";
    let age = "N/A";

    if (dexData.pairs && dexData.pairs.length > 0) {
      const pair = dexData.pairs[0];
      pairAddress = pair.pairAddress || "";
      
      price = pair.priceUsd ? `$${parseFloat(pair.priceUsd).toFixed(6)}` : "N/A";
      priceChange = pair.priceChange?.h24 ? `${pair.priceChange.h24 > 0 ? "+" : ""}${pair.priceChange.h24}%` : "N/A";
      priceChange1h = pair.priceChange?.h1 ? `${pair.priceChange.h1 > 0 ? "+" : ""}${pair.priceChange.h1}%` : "N/A";
      
      if (pair.marketCap) {
        marketCapRaw = pair.marketCap;
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

      if (pair.pairCreatedAt) {
        const created = new Date(pair.pairCreatedAt);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        age = `${diffDays}d`;
      }
    }

    // Check if token exists in database
    const { data: existingToken } = await supabase
      .from("tokens")
      .select("first_scanned_by, first_scanned_mc, first_scanned_at")
      .eq("mint", mint)
      .single();

    let firstScannedBy = existingToken?.first_scanned_by || username;
    let firstScannedMc = existingToken?.first_scanned_mc || marketCap;
    let firstScannedAt = existingToken?.first_scanned_at || new Date().toISOString();

    // Save to database
    await supabase.from("tokens").upsert({
      mint,
      name,
      symbol,
      image,
      price: parseFloat(price.replace(/[$,]/g, "")) || null,
      market_cap: marketCapRaw || null,
      liquidity: parseFloat(liquidity.replace(/[$,KM]/g, "")) || null,
      mint_authority_revoked: !risks.mintAuthorityEnabled,
      freeze_authority_revoked: !risks.freezeAuthorityEnabled,
      risk_score: risks.riskScore,
      risk_flags: risks.flags,
      first_scanned_by: firstScannedBy,
      first_scanned_mc: firstScannedMc,
      first_scanned_at: firstScannedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "mint" });

    // Build stats text
    const statsText = [
      `├ USD   ${price} (${priceChange})`,
      `├ MC    ${marketCap}`,
      `├ Vol   ${volume}`,
      `├ LP    ${liquidity}`,
      `├ 1H    ${priceChange1h} 🅑 ${buys1h} Ⓢ ${sells1h}`,
      `└ Age   ${age}`,
    ].join("\n");

    // Build risk text
    const riskColor = risks.riskScore > 50 ? 0xFF0000 : risks.riskScore > 25 ? 0xFFFF00 : 0x00FF00;
    const riskText = risks.flags.join("\n");

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
        { name: `🛡️ Risk Score: ${risks.riskScore}/100`, value: riskText },
        { name: "🔗 Charts", value: links },
        { name: "💱 Trade", value: tradeLinks },
        { name: "🔥 First Scanned", value: `**${firstScannedBy}** @ ${firstScannedMc}` }
      )
      .setColor(riskColor)
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