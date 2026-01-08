export interface PumpFunToken {
  mint: string;
  name: string;
  symbol: string;
  image?: string;
  price?: number;
  volume24h?: number;
}

export async function scrapePumpFunLaunches(): Promise<PumpFunToken[]> {
  try {
    // Use DEX Screener API to get latest Solana tokens
    const response = await fetch("https://api.dexscreener.com/token-profiles/latest/v1", {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.log("DEX Screener response not OK:", response.status);
      return [];
    }

    const data = (await response.json()) as any[];
    
    // Filter for Solana tokens only
    const solanaTokens = data
      .filter((token: any) => token.chainId === "solana")
      .slice(0, 10);

    return solanaTokens.map((token: any) => ({
      mint: token.tokenAddress,
      name: token.description || "Unknown",
      symbol: token.tokenAddress.slice(0, 6) + "...",
      image: token.icon || undefined,
    }));
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return [];
  }
}