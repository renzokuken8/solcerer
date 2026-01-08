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
  riskScore: number;
  flags: string[];
}

export async function checkTokenRisks(mint: string): Promise<RiskFlags> {
  const flags: string[] = [];
  let riskScore = 0;

  let mintAuthorityEnabled = false;
  let freezeAuthorityEnabled = false;
  let lpLocked = false;
  let lpBurned = false;
  let topHolderPercent = 0;

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

    // Get top holders using Helius DAS API
    const holdersResponse = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${heliusApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintAccounts: [mint], includeOffChain: true }),
    });

    const holdersData = (await holdersResponse.json()) as any;
    
    // Try to get holder info from another endpoint
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
      }
    }

  } catch (error) {
    console.error("Error checking token risks:", error);
    flags.push("❓ Could not verify all risks");
  }

  // Add positive flags
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
    riskScore: Math.min(riskScore, 100),
    flags,
  };
}