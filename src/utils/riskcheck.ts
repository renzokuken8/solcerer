import dotenv from "dotenv";

dotenv.config();

const heliusApiKey = process.env.HELIUS_API_KEY;
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

export interface RiskFlags {
  mintAuthorityEnabled: boolean;
  freezeAuthorityEnabled: boolean;
  lpLocked: boolean;
  lpBurned: boolean;
  topHolderPercent: number;
  isHoneypot: boolean;
  honeypotReason: string | null;
  riskScore: number;
  flags: string[];
}

async function checkHoneypot(mint: string): Promise<{ isHoneypot: boolean; reason: string | null }> {
  try {
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const TEST_AMOUNT = 1000000;
    
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${mint}&outputMint=${SOL_MINT}&amount=${TEST_AMOUNT}&slippageBps=5000`;
    
    const response = await fetch(quoteUrl);
    const data = (await response.json()) as any;
    
    if (!response.ok || !data || data.error) {
      // Try reverse - maybe it's too new
      const reverseUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${mint}&amount=${TEST_AMOUNT}&slippageBps=5000`;
      const reverseResponse = await fetch(reverseUrl);
      const reverseData = (await reverseResponse.json()) as any;
      
      if (!reverseResponse.ok || !reverseData || reverseData.error) {
        return { isHoneypot: false, reason: "No Jupiter route (very new or low liquidity)" };
      }
      
      return { isHoneypot: false, reason: "Can buy but sell not verified" };
    }
    
    // Check for extreme price impact
    const priceImpact = parseFloat(data.priceImpactPct || "0");
    
    if (priceImpact > 50) {
      return { isHoneypot: true, reason: `Extreme sell impact: ${priceImpact.toFixed(1)}%` };
    }
    
    if (priceImpact > 20) {
      return { isHoneypot: false, reason: `High sell impact: ${priceImpact.toFixed(1)}%` };
    }
    
    if (priceImpact > 10) {
      return { isHoneypot: false, reason: `Sell impact: ${priceImpact.toFixed(1)}%` };
    }
    
    return { isHoneypot: false, reason: null };
  } catch (error) {
    console.error("Error checking honeypot:", error);
    return { isHoneypot: false, reason: "Could not verify sellability" };
  }
}

async function checkDeployerHistory(mint: string): Promise<{ hasRugged: boolean; rugCount: number; deployer: string | null }> {
  try {
    // Get token creation transaction to find deployer
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [mint, { limit: 100 }],
      }),
    });

    const data = (await response.json()) as any;
    
    if (!data.result || data.result.length === 0) {
      return { hasRugged: false, rugCount: 0, deployer: null };
    }

    // Get the last (oldest) transaction - this is likely the creation
    const firstTx = data.result[data.result.length - 1];
    
    // Get transaction details to find deployer
    const txResponse = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [firstTx.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
      }),
    });

    const txData = (await txResponse.json()) as any;
    
    if (!txData.result) {
      return { hasRugged: false, rugCount: 0, deployer: null };
    }

    // Get the fee payer (deployer)
    const deployer = txData.result.transaction?.message?.accountKeys?.[0]?.pubkey;
    
    if (!deployer) {
      return { hasRugged: false, rugCount: 0, deployer: null };
    }

    // Check how many tokens this deployer has created
    const deployerTokensResponse = await fetch(
      `https://api.helius.xyz/v0/addresses/${deployer}/transactions?api-key=${heliusApiKey}&limit=100`
    );
    
    const deployerTxs = (await deployerTokensResponse.json()) as any[];
    
    // Count token creations
    let tokenCount = 0;
    if (Array.isArray(deployerTxs)) {
      tokenCount = deployerTxs.filter(tx => 
        tx.type === "TOKEN_MINT" || 
        tx.type === "CREATE" ||
        tx.description?.toLowerCase().includes("create") ||
        tx.description?.toLowerCase().includes("mint")
      ).length;
    }
    
    // If deployer has created many tokens, flag as suspicious
    if (tokenCount > 10) {
      return { hasRugged: true, rugCount: tokenCount, deployer };
    }

    return { hasRugged: false, rugCount: tokenCount, deployer };
  } catch (error) {
    console.error("Error checking deployer history:", error);
    return { hasRugged: false, rugCount: 0, deployer: null };
  }
}

export async function checkTokenRisks(mint: string): Promise<RiskFlags> {
  const flags: string[] = [];
  let riskScore = 0;

  let mintAuthorityEnabled = false;
  let freezeAuthorityEnabled = false;
  let lpLocked = false;
  let lpBurned = false;
  let topHolderPercent = 0;
  let isHoneypot = false;
  let honeypotReason: string | null = null;

  try {
    // Get token account info
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [mint, { encoding: "jsonParsed" }],
      }),
    });

    const data = (await response.json()) as any;
    
    if (data.result?.value?.data?.parsed?.info) {
      const info = data.result.value.data.parsed.info;
      
      // Check mint authority
      if (info.mintAuthority) {
        mintAuthorityEnabled = true;
        flags.push("⚠️ Mint authority NOT revoked");
        riskScore += 25;
      }

      // Check freeze authority
      if (info.freezeAuthority) {
        freezeAuthorityEnabled = true;
        flags.push("⚠️ Freeze authority enabled");
        riskScore += 25;
      }
    }

    // Get top holders
    const largestResponse = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenLargestAccounts",
        params: [mint],
      }),
    });

    const largestData = (await largestResponse.json()) as any;
    
    if (largestData.result?.value && largestData.result.value.length > 0) {
      const totalSupply = largestData.result.value.reduce((sum: number, acc: any) => {
        return sum + parseFloat(acc.amount);
      }, 0);

      const topHolder = parseFloat(largestData.result.value[0].amount);
      topHolderPercent = Math.round((topHolder / totalSupply) * 100);

      if (topHolderPercent > 50) {
        flags.push(`🚨 Top holder owns ${topHolderPercent}%`);
        riskScore += 30;
      } else if (topHolderPercent > 20) {
        flags.push(`⚠️ Top holder owns ${topHolderPercent}%`);
        riskScore += 15;
      } else {
        flags.push(`✅ Top holder owns ${topHolderPercent}%`);
      }
    }

    // Check honeypot
    const honeypotResult = await checkHoneypot(mint);
    isHoneypot = honeypotResult.isHoneypot;
    honeypotReason = honeypotResult.reason;
    
    if (isHoneypot) {
      flags.push(`🚨 HONEYPOT: ${honeypotReason}`);
      riskScore += 50;
    } else if (honeypotReason) {
      flags.push(`⚠️ ${honeypotReason}`);
    } else {
      flags.push("✅ Sellable (not a honeypot)");
    }

    // Check deployer history
    const deployerResult = await checkDeployerHistory(mint);
    if (deployerResult.hasRugged) {
      flags.push(`🚨 Serial deployer (${deployerResult.rugCount}+ tokens created)`);
      riskScore += 30;
    } else if (deployerResult.rugCount > 3) {
      flags.push(`⚠️ Deployer created ${deployerResult.rugCount} tokens`);
      riskScore += 10;
    } else if (deployerResult.deployer) {
      flags.push(`✅ Deployer history clean`);
    }

  } catch (error) {
    console.error("Error checking token risks:", error);
    flags.push("❓ Could not verify all risks");
  }

  // Add positive flags at the top
  if (!mintAuthorityEnabled) {
    flags.unshift("✅ Mint authority revoked");
  }
  if (!freezeAuthorityEnabled) {
    flags.unshift("✅ Freeze authority revoked");
  }

  return {
    mintAuthorityEnabled,
    freezeAuthorityEnabled,
    lpLocked,
    lpBurned,
    topHolderPercent,
    isHoneypot,
    honeypotReason,
    riskScore: Math.min(riskScore, 100),
    flags,
  };
}