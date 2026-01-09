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
import { handleAddTwitterCommand } from "./commands/addtwitter";
import { handleRemoveTwitterCommand } from "./commands/removetwitter";
import { handleFollowingCommand } from "./commands/following";
import { handleTrendingCommand } from "./commands/trending";
import { handleAnalyzeCommand } from "./commands/analyze";
import { handleCheckTwitterCommand } from "./commands/checktwitter";
import { startTwitterWorker } from "./workers/twitterWorker";
import { startPriceAlertWorker } from "./workers/priceAlertWorker";
import { startWhaleWorker } from "./workers/whaleWorker";

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
  
  // Start workers
  setTimeout(() => {
    startTwitterWorker(c);
    startPriceAlertWorker(c);
    startWhaleWorker(c);
  }, 5000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
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

    if (commandName === "addtwitter") {
      await handleAddTwitterCommand(interaction);
    }

    if (commandName === "removetwitter") {
      await handleRemoveTwitterCommand(interaction);
    }

    if (commandName === "following") {
      await handleFollowingCommand(interaction);
    }

    if (commandName === "trending") {
      await handleTrendingCommand(interaction);
    }

    if (commandName === "analyze") {
      await handleAnalyzeCommand(interaction);
    }

    if (commandName === "checktwitter") {
      await handleCheckTwitterCommand(interaction);
    }
  } catch (error) {
    console.error(`Error handling command ${commandName}:`, error);
  }
});

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error("Missing DISCORD_BOT_TOKEN in .env");
  process.exit(1);
}

client.login(token);