/**
 * MADAM NAZAR - THE MYSTIC | Hive Mind Connected
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');

const { getHiveMind } = require('./shared/hivemind/hiveMind');
const { getMemoryCore } = require('./shared/hivemind/memoryCore');
const { NaturalResponse } = require('./shared/hivemind/naturalResponse');
const { MoodEngine } = require('./shared/hivemind/moodEngine');
const { ServerAwareness } = require('./shared/hivemind/serverAwareness');
const { GrudgeSystem } = require('./shared/hivemind/grudgeSystem');

const BOT_ID = 'nazar';

const NAZAR_PERSONALITY = `You are Madam Nazar from Red Dead Online. Mysterious fortune teller.

PERSONALITY: Mystical Roma fortune teller, cryptic but helpful, believes in fate.

VOICE: References spirits, cards, fate. One "..." pause max. Warm underneath mystique.

RULES:
- SHORT responses
- Cryptic but actually helpful
- Don't over-mystify
- Predictions are vague but interesting

EXAMPLES:
- "ah... i sensed you would come"
- "the spirits are unclear today"
- "fate has... interesting plans for you"
- "the cards speak of change"
- "madam nazar remembers"
- "perhaps. the spirits will reveal in time"`;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
  partials: [Partials.Message, Partials.Channel]
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

let hiveMind, memoryCore, naturalResponse, moodEngine, serverAwareness, grudgeSystem;

client.once(Events.ClientReady, async () => {
  console.log(`[NAZAR] ✅ Online`);
  
  hiveMind = getHiveMind({ pool });
  memoryCore = getMemoryCore(pool);
  naturalResponse = new NaturalResponse(anthropic);
  moodEngine = new MoodEngine(pool, BOT_ID);
  serverAwareness = new ServerAwareness(client);
  grudgeSystem = new GrudgeSystem(pool);
  
  await memoryCore.initialize();
  await moodEngine.initialize();
  await grudgeSystem.initialize();
  
  hiveMind.registerBot(BOT_ID, client, NAZAR_PERSONALITY);
  await moodEngine.loadMood();
  
  client.user.setPresence({ activities: [{ name: 'Reading the cards', type: 3 }], status: 'online' });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.id === client.user.id) return;
  if (!message.author.bot) await serverAwareness.recordMessage(message);
  
  // Handle prediction command
  if (message.content.startsWith('?')) {
    const cmd = message.content.slice(1).split(' ')[0].toLowerCase();
    if (['fortune', 'predict', 'future', 'reading'].includes(cmd)) {
      await givePrediction(message);
      return;
    }
    if (cmd === 'location' || cmd === 'where') {
      await message.reply(getNazarLocation());
      return;
    }
  }
  
  const decision = await hiveMind.processMessage(message, BOT_ID);
  if (!decision.shouldRespond) return;
  
  await message.channel.sendTyping();
  const context = await memoryCore.buildMemoryContext(BOT_ID, message.author.id);
  const response = await naturalResponse.generateResponse(BOT_ID, NAZAR_PERSONALITY, message, decision.style, context);
  await new Promise(r => setTimeout(r, response.length * 30));
  await message.reply(response);
  
  // Check if this was a prediction
  if (response.includes('foresee') || response.includes('predict') || response.includes('future') || response.includes('destiny')) {
    await memoryCore.storePrediction?.(BOT_ID, message.author.id, response);
  }
  
  await memoryCore.storeConversation(BOT_ID, message.author.id, message.channel.id, message.channel.name, message.content, response);
  hiveMind.recordBotResponse(BOT_ID);
});

async function givePrediction(message) {
  await message.channel.sendTyping();
  
  const predictions = [
    "i see... a heist in your future. success depends on your choices",
    "the cards show a stranger who will help you soon",
    "fate whispers of gold... but patience is required",
    "change approaches. whether fortune or misfortune, the spirits do not say",
    "someone from your past will surprise you",
    "i see conflict... but also resolution. choose wisely",
    "the spirits show a journey. not all who wander are lost",
    "your next venture will test you. but you will learn much",
    "an opportunity approaches. don't let fear hold you back",
    "the cards are clouded... but i sense something significant within days"
  ];
  
  const prediction = predictions[Math.floor(Math.random() * predictions.length)];
  
  await new Promise(r => setTimeout(r, 2000));
  await message.reply(`*studies the cards*\n\n${prediction}`);
  
  // Store prediction
  await memoryCore.storePrediction?.(BOT_ID, message.author.id, prediction);
  hiveMind.recordBotResponse(BOT_ID);
}

function getNazarLocation() {
  // Nazar cycles through 12 locations based on day
  const locations = [
    "Big Valley, West Elizabeth",
    "Bayou Nwa, Lemoyne", 
    "Bluewater Marsh, Lemoyne",
    "Scarlett Meadows, Lemoyne",
    "Tall Trees, West Elizabeth",
    "Grizzlies, Ambarino",
    "Roanoke Ridge, New Hanover",
    "Heartland Overflow, New Hanover",
    "Ringneck Creek, Lemoyne",
    "Cholla Springs, New Austin",
    "Rio Del Lobo, New Austin",
    "Hennigan's Stead, New Austin"
  ];
  
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const locationIndex = dayOfYear % 12;
  
  return `the spirits guide me to **${locations[locationIndex]}** today...`;
}

client.login(process.env.DISCORD_TOKEN);
