import { Client, GatewayIntentBits, Events } from "discord.js";
import dotenv from "dotenv";
import { handleCaCommand } from "./commands/ca";
import { handleTrackCommand } from "./commands/track";
import { handleUntrackCommand } from "./commands/untrack";
import { handleWatchlistCommand } from "./commands/watchlist";
import { handleLaunchesCommand } from "./commands/launches";
import { handlePulseCommand } from "./commands/pulse";
import { handleAlertsCommand } from "./commands/alerts";
import { handleSetAlertCommand } from "./commands/setalert";
import { handleRemoveAlertCommand } from "./commands/removealert";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Solcerer is online! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ping") {
    await interaction.reply("Pong!");
  }

  if (commandName === "ca") {
    await handleCaCommand(interaction);
  }

  if (commandName === "track") {
    await handleTrackCommand(interaction);
  }

  if (commandName === "untrack") {
    await handleUntrackCommand(interaction);
  }

  if (commandName === "watchlist") {
    await handleWatchlistCommand(interaction);
  }

  if (commandName === "launches") {
    await handleLaunchesCommand(interaction);
  }

  if (commandName === "pulse") {
    await handlePulseCommand(interaction);
  }

  if (commandName === "alerts") {
    await handleAlertsCommand(interaction);
  }

  if (commandName === "setalert") {
    await handleSetAlertCommand(interaction);
  }

  if (commandName === "removealert") {
    await handleRemoveAlertCommand(interaction);
  }
});

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error("Missing DISCORD_BOT_TOKEN in .env");
  process.exit(1);
}

client.login(token);