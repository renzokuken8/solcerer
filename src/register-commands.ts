import { REST, Routes, SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if Solcerer is alive"),

  new SlashCommandBuilder()
    .setName("launches")
    .setDescription("Show the latest pump.fun token launches"),

  new SlashCommandBuilder()
    .setName("ca")
    .setDescription("Look up a token by contract address")
    .addStringOption((option) =>
      option
        .setName("mint")
        .setDescription("The Solana mint address")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("track")
    .setDescription("Add a token to your watchlist")
    .addStringOption((option) =>
      option
        .setName("mint")
        .setDescription("The Solana mint address")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("untrack")
    .setDescription("Remove a token from your watchlist")
    .addStringOption((option) =>
      option
        .setName("mint")
        .setDescription("The Solana mint address")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("watchlist")
    .setDescription("View your tracked tokens"),

  new SlashCommandBuilder()
    .setName("pulse")
    .setDescription("Get social sentiment for a token")
    .addStringOption((option) =>
      option
        .setName("mint")
        .setDescription("The Solana mint address")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("alerts")
    .setDescription("Manage your price alerts"),
].map((command) => command.toJSON());

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID in .env");
  process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands...`);

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    console.log("Commands registered successfully!");
  } catch (error) {
    console.error("Error registering commands:", error);
  }
})();