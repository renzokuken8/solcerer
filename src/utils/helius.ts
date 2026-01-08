import dotenv from "dotenv";

dotenv.config();

const heliusApiKey = process.env.HELIUS_API_KEY;

if (!heliusApiKey) {
  console.error("Missing HELIUS_API_KEY in .env");
  process.exit(1);
}

const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

export async function getTokenInfo(mint: string) {
  const response = await fetch(HELIUS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAsset",
      params: { id: mint },
    }),
  });

  const data = (await response.json()) as { result: any };
  return data.result;
}

export async function getTokenHolders(mint: string) {
  const response = await fetch(
    `https://api.helius.xyz/v0/token-metadata?api-key=${heliusApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintAccounts: [mint] }),
    }
  );

  const data = (await response.json()) as any[];
  return data[0];
}