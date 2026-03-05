require("dotenv").config();
const { Client, GatewayIntentBits, ActivityType } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { scrapeEntries } = require("./scraper");
const { buildEntryEmbed } = require("./formatter");

// ─── Config ────────────────────────────────────────────────────────────────

const DISCORD_TOKEN    = process.env.DISCORD_TOKEN;
const CHANNEL_ID       = process.env.CHANNEL_ID;
const TRACKED_USERNAME = process.env.TRACKED_USERNAME || "Tracked User";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "60000", 10);
const SEEN_FILE        = path.join(__dirname, "seen_entries.json");

if (!DISCORD_TOKEN || !CHANNEL_ID) {
  console.error(
    "[bot] ERROR: Missing DISCORD_TOKEN or CHANNEL_ID in .env file.\n" +
    "Copy .env.example to .env and fill in your values."
  );
  process.exit(1);
}

// ─── State ─────────────────────────────────────────────────────────────────

function loadSeenIds() {
  try {
    if (fs.existsSync(SEEN_FILE)) {
      const raw = fs.readFileSync(SEEN_FILE, "utf8");
      return new Set(JSON.parse(raw));
    }
  } catch (e) {
    console.warn("[bot] Could not load seen_entries.json, starting fresh.");
  }
  return new Set();
}

function saveSeenIds(seenIds) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seenIds]), "utf8");
}

function fingerprintEntry(entry) {
  if (entry.id) return entry.id;
  // Build a key from the raw text content
  const key = entry.rawLines
    .filter((l) => l.length > 2)
    .slice(0, 12)
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return key || entry.rawText.slice(0, 200);
}

// ─── Discord client ─────────────────────────────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`[bot] Logged in as ${client.user.tag}`);
  client.user.setActivity("PrizePicks", { type: ActivityType.Watching });
  startPolling();
});

// ─── Polling loop ───────────────────────────────────────────────────────────

let seenIds = loadSeenIds();
let isPolling = false;

async function poll() {
  if (isPolling) {
    console.log("[bot] Previous poll still running, skipping...");
    return;
  }

  isPolling = true;

  try {
    console.log(`[bot] Polling at ${new Date().toLocaleTimeString()}...`);
    const entries = await scrapeEntries();

    if (entries.length === 0) {
      console.log("[bot] No entries found. Page may have changed structure.");
      return;
    }

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      console.error("[bot] Channel not found or not text-based.");
      return;
    }

    let newCount = 0;

    for (const entry of entries) {
      const fp = fingerprintEntry(entry);

      if (!seenIds.has(fp)) {
        console.log(`[bot] New entry detected: ${fp.slice(0, 60)}...`);
        seenIds.add(fp);

        const embed = buildEntryEmbed(entry, TRACKED_USERNAME);
        await channel.send({ embeds: [embed] });
        newCount++;

        // Delay between messages to avoid rate limits
        if (newCount < entries.length) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    if (newCount > 0) {
      saveSeenIds(seenIds);
      console.log(`[bot] Sent ${newCount} new entry alert(s).`);
    } else {
      console.log("[bot] No new entries.");
    }
  } catch (err) {
    console.error("[bot] Poll error:", err.message);
  } finally {
    isPolling = false;
  }
}

function startPolling() {
  console.log(`[bot] Starting poll loop every ${POLL_INTERVAL_MS / 1000}s`);

  // Run once on startup
  poll();

  // Then run on interval
  setInterval(poll, POLL_INTERVAL_MS);
}

// ─── Start ──────────────────────────────────────────────────────────────────

client.login(DISCORD_TOKEN);
