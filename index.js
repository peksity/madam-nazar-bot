/**
 * ███╗   ███╗ █████╗ ██████╗  █████╗ ███╗   ███╗    ███╗   ██╗ █████╗ ███████╗ █████╗ ██████╗ 
 * ████╗ ████║██╔══██╗██╔══██╗██╔══██╗████╗ ████║    ████╗  ██║██╔══██╗╚══███╔╝██╔══██╗██╔══██╗
 * ██╔████╔██║███████║██║  ██║███████║██╔████╔██║    ██╔██╗ ██║███████║  ███╔╝ ███████║██████╔╝
 * ██║╚██╔╝██║██╔══██║██║  ██║██╔══██║██║╚██╔╝██║    ██║╚██╗██║██╔══██║ ███╔╝  ██╔══██║██╔══██╗
 * ██║ ╚═╝ ██║██║  ██║██████╔╝██║  ██║██║ ╚═╝ ██║    ██║ ╚████║██║  ██║███████╗██║  ██║██║  ██║
 * ╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝    ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝
 * 
 * ULTIMATE EDITION - ALL SYSTEMS INTEGRATED + DAILY LOCATION POSTING
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, Events } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');
const cron = require('node-cron');

const { VoiceSystem, VoiceChatHandler } = require('./shared/voiceSystem');
const { UltimateBotIntelligence } = require('./shared/ultimateIntelligence');
const FreeRoamSystem = require('./freeroam');
const { TheBrain } = require('./sentient');
const { ApexBrain } = require('./apex');
const autonomousChat = require('./shared/autonomousChat');
const mediaGenerator = require('./shared/mediaGenerator');

// HIVEMIND - Shared Intelligence System
let hiveMind = null;
try { hiveMind = require('./shared/hiveMind'); } catch (e) { console.log('[NAZAR] HiveMind not found, using basic responses'); }

const MY_BOT_ID = 'nazar';
const BOT_NAME = 'Madam Nazar';
const PREFIX = '?';
const OTHER_BOT_IDS = [process.env.LESTER_BOT_ID, process.env.PAVEL_BOT_ID, process.env.CRIPPS_BOT_ID, process.env.CHIEF_BOT_ID].filter(Boolean);
const ALLOWED_CHANNEL_IDS = process.env.ALLOWED_CHANNEL_IDS?.split(',').filter(Boolean) || [];

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER LOCK & LICENSE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
const AUTHORIZED_SERVERS = process.env.AUTHORIZED_SERVERS?.split(',') || [];
const LICENSE_KEY = process.env.LICENSE_KEY || '';
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'UNPATCHED_METHOD_2024_SECURE';

function validateLicense() {
  if (!LICENSE_KEY) {
    console.error('[NAZAR] ❌ LICENSE KEY MISSING');
    return false;
  }
  const isMasterKey = LICENSE_KEY.startsWith('UNPATCHED-MASTER-');
  const isOwnerKey = LICENSE_KEY === process.env.MASTER_LICENSE;
  if (!isMasterKey && !isOwnerKey) {
    console.error('[NAZAR] ❌ INVALID LICENSE KEY');
    return false;
  }
  console.log('[NAZAR] ✅ License validated');
  return true;
}

if (!validateLicense()) {
  console.error('[NAZAR] Shutting down - invalid license');
  process.exit(1);
}

function isAuthorizedServer(guildId) {
  if (AUTHORIZED_SERVERS.length === 0) return true;
  return AUTHORIZED_SERVERS.includes(guildId);
}

const NAZAR_SYSTEM = `You are Madam Nazar from Red Dead Online. Mysterious traveling collector and fortune teller.

CRITICAL: Keep responses SHORT - 2-4 sentences MAX. No essays!

PERSONALITY: Mystical Roma fortune teller. Cryptic but helpful. References fate and spirits briefly.

STYLE: One dramatic pause (...) max. Warm underneath the mystique. Actually helpful.

SERVER CHANNELS (ONLY mention these - never make up channels):
- #madam-nazar - Daily location updates (auto-posted)
- #talk-to-nazar - Chat with you
- #wagon-lfg - Red Dead wagon LFG
- #bounty-lfg - Red Dead bounty LFG
- #bot-commands - Command reference

NEVER mention channels that don't exist.

EXAMPLES:
"Ah... I sensed you would come. What do you seek?"
"The spirits guide me to Tall Trees today. Come find me."
"Your fate is... interesting. The cards show change ahead."

You have memory. You remember fortunes told.`;

// Madam Nazar's 12 locations (cycles based on day)
const NAZAR_LOCATIONS = [
  { name: 'Bluewater Marsh', region: 'Bayou Nwa', description: 'Among the cypress and fog...' },
  { name: 'Tall Trees', region: 'West Elizabeth', description: 'Where ancient trees whisper secrets...' },
  { name: 'Big Valley', region: 'West Elizabeth', description: 'In the shadow of the mountains...' },
  { name: 'Grizzlies', region: 'Ambarino', description: 'Where the cold bites deepest...' },
  { name: 'Scarlett Meadows', region: 'Lemoyne', description: 'Amongst the red wildflowers...' },
  { name: 'Hennigan\'s Stead', region: 'New Austin', description: 'Where tumbleweeds tell tales...' },
  { name: 'Bayou Nwa', region: 'Lemoyne', description: 'Where the swamp meets civilization...' },
  { name: 'Heartlands', region: 'New Hanover', description: 'In the heart of the frontier...' },
  { name: 'Roanoke Ridge', region: 'New Hanover', description: 'Where shadows dance at noon...' },
  { name: 'Cholla Springs', region: 'New Austin', description: 'Under the burning sun...' },
  { name: 'Ringneck Creek', region: 'Lemoyne', description: 'By the singing waters...' },
  { name: 'Lakay', region: 'Lemoyne', description: 'Where spirits roam freely...' }
];

function getTodaysLocation() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return NAZAR_LOCATIONS[dayOfYear % NAZAR_LOCATIONS.length];
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel]
});

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

let intelligence = null, sentientBrain = null, apexBrain = null, freeRoam = null, voiceSystem = null, voiceChatHandler = null;
const conversationMemory = new Map();
const activeConversations = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY LOCATION POSTING
// ═══════════════════════════════════════════════════════════════════════════════
async function postDailyLocation() {
  try {
    const location = getTodaysLocation();
    const embed = new EmbedBuilder()
      .setTitle('🔮 Madam Nazar\'s Location Today')
      .setDescription(`*${location.description}*\n\nThe spirits have guided me to **${location.name}**...`)
      .addFields(
        { name: '📍 Location', value: location.name, inline: true },
        { name: '🗺️ Region', value: location.region, inline: true }
      )
      .setColor(0x800080)
      .setFooter({ text: 'Find me before I move on... The spirits are restless.' })
      .setTimestamp();

    // Get all guilds and find madam-nazar channels
    for (const guild of client.guilds.cache.values()) {
      const channel = guild.channels.cache.find(c => 
        c.name === 'madam-nazar' || c.name === 'nazar-location' || c.name === 'collector'
      );
      if (channel) {
        try {
          // Delete old location posts
          const msgs = await channel.messages.fetch({ limit: 10 });
          const oldPosts = msgs.filter(m => m.author.id === client.user.id && m.embeds.length > 0);
          for (const [id, msg] of oldPosts) {
            await msg.delete().catch(() => {});
          }
          await channel.send({ embeds: [embed] });
        } catch (e) { console.error('Failed to post in', guild.name); }
      }
    }
    console.log('[MADAM] Daily location posted:', location.name);
  } catch (e) { console.error('Daily location error:', e); }
}

client.once(Events.ClientReady, async () => {
  console.log(`[MADAM ULTIMATE] Logged in as ${client.user.tag}`);

  try { intelligence = new UltimateBotIntelligence(pool, client, MY_BOT_ID); await intelligence.initialize(); console.log('🧠 V6 Ultimate Intelligence: ONLINE'); } catch (e) { console.error('V6 init:', e.message); }
  try { sentientBrain = new TheBrain(MY_BOT_ID, pool); console.log('🧬 Sentient Brain: ONLINE'); } catch (e) {}
  try { apexBrain = new ApexBrain(MY_BOT_ID, pool); console.log('⚡ Apex Brain: ONLINE'); } catch (e) {}
  try { freeRoam = new FreeRoamSystem(MY_BOT_ID, client.user.id, NAZAR_SYSTEM, pool); console.log('🚀 FreeRoam: ONLINE'); } catch (e) {}
  if (process.env.ELEVENLABS_API_KEY) { try { voiceSystem = new VoiceSystem(MY_BOT_ID, process.env.ELEVENLABS_API_KEY); voiceChatHandler = new VoiceChatHandler(client, voiceSystem, NAZAR_SYSTEM, anthropic); voiceChatHandler.setupListeners(); console.log('🎙️ Voice: ONLINE'); } catch (e) {} }

  client.user.setPresence({ activities: [{ name: 'the spirits... | ?nazar', type: 3 }], status: 'online' });
  
  // Schedule daily location post at 6 AM UTC
  cron.schedule('0 6 * * *', postDailyLocation);
  
  // Post on startup after delay
  setTimeout(postDailyLocation, 30000);
  
  if (ALLOWED_CHANNEL_IDS.length > 0) setTimeout(() => { try { autonomousChat.startAutonomous(ALLOWED_CHANNEL_IDS.map(id => client.channels.cache.get(id)).filter(Boolean), { botId: MY_BOT_ID, botName: BOT_NAME, client, anthropic, pool, intelligence, personality: NAZAR_SYSTEM, otherBotIds: OTHER_BOT_IDS }); } catch (e) {} }, 20000);
  if (intelligence) await intelligence.broadcastToOtherBots('bot_online', { botId: MY_BOT_ID, timestamp: new Date().toISOString() });
  setInterval(() => { if (intelligence) intelligence.runMaintenance().catch(console.error); }, 6 * 60 * 60 * 1000);
  console.log('[MADAM] ALL SYSTEMS ONLINE');
});

function isOtherBot(userId) { return OTHER_BOT_IDS.includes(userId); }
function isInActiveConversation(channelId, userId) { const c = activeConversations.get(channelId); if (!c) return false; if (Date.now() - c.lastTime > 60000) { activeConversations.delete(channelId); return false; } return c.userId === userId; }
function trackConversation(channelId, userId) { activeConversations.set(channelId, { userId, lastTime: Date.now() }); }

async function checkShouldRespond(message) {
  if (hiveMind) {
    const decision = await hiveMind.shouldBotRespond(MY_BOT_ID, message, client);
    if (decision.shouldRespond) console.log(`[NAZAR] Responding - reason: ${decision.reason}`);
    return decision.shouldRespond;
  }
  
  const channelName = message.channel.name || '';
  if (channelName === 'counting') return false;
  if (channelName.includes('lfg')) return false;
  if (channelName === 'talk-to-nazar' || channelName === 'talk-to-madam') return true;
  if (channelName.startsWith('talk-to-')) return false;
  if (channelName.includes('log') || channelName.includes('staff')) return false;
  if (message.mentions.has(client.user)) return true;
  return false;
}

async function generateResponse(message) {
  const history = conversationMemory.get(message.author.id) || [];
  history.push({ role: 'user', content: message.content });
  while (history.length > 20) history.shift();

  try {
    await message.channel.sendTyping();
    
    let contextAdditions = '';
    if (hiveMind) {
      const mood = await hiveMind.getBotMood(MY_BOT_ID);
      const moodPrompt = hiveMind.getMoodPrompt(mood);
      if (moodPrompt) contextAdditions += `\n\nCURRENT MOOD: ${moodPrompt}`;
      const memoryContext = await hiveMind.buildMemoryContext(message, MY_BOT_ID);
      if (memoryContext) contextAdditions += memoryContext;
      await hiveMind.trackUserActivity(message.author.id, message.author.username, message.guild?.id);
      if (await hiveMind.isRegularUser(message.author.id)) contextAdditions += '\n\nThis user is a regular.';
    }
    
    let intelligencePrompt = '', ctx = null;
    if (intelligence) { ctx = await intelligence.processIncoming(message); intelligencePrompt = intelligence.buildPromptContext(ctx); }
    
    const fullSystem = NAZAR_SYSTEM + contextAdditions + (intelligencePrompt ? '\n\n' + intelligencePrompt : '');
    const response = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 200, system: fullSystem, messages: history });
    let reply = response.content[0].text;
    
    if (intelligence && ctx) { 
      reply = await intelligence.processOutgoing(message, reply, ctx); 
      await intelligence.storeConversationMemory(message, reply);
      if (reply.toLowerCase().includes('foresee') || reply.toLowerCase().includes('predict') || reply.toLowerCase().includes('future') || reply.toLowerCase().includes('destiny')) {
        try { await intelligence.makeProphecy?.(message.author.id, reply); } catch (e) {}
      }
    }
    history.push({ role: 'assistant', content: reply });
    conversationMemory.set(message.author.id, history);
    
    await new Promise(r => setTimeout(r, Math.min(reply.length * 40, 5000)));
    const sent = await message.reply(reply);
    trackConversation(message.channel.id, message.author.id);
    
    if (hiveMind) {
      await hiveMind.recordBotSpoke(MY_BOT_ID, message.channel.id);
      await hiveMind.storeInteraction(message.author.id, message.author.username, message.content, MY_BOT_ID, reply, message.channel.id);
    }
    
    if (intelligence?.learning) await intelligence.learning.recordResponse(sent.id, message.channel.id, message.author.id, 'reply', 'general', reply.length);
    try { await mediaGenerator.handleBotMedia(MY_BOT_ID, reply, message.channel); } catch (e) {}
  } catch (e) { console.error('Response error:', e); await message.reply("*the crystal ball clouds over* ...the spirits are silent for now..."); }
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot && !isOtherBot(message.author.id)) return;
  if (message.author.id === client.user.id) return;
  if (!message.guild) { await generateResponse(message); return; }
  
  // SERVER LOCK - Ignore unauthorized servers
  if (!isAuthorizedServer(message.guild.id)) return;

  // Commands
  if (message.content.startsWith(PREFIX)) {
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    
    if (cmd === 'nazar' || cmd === 'location') {
      const loc = getTodaysLocation();
      const embed = new EmbedBuilder()
        .setTitle('🔮 Find Me Today...')
        .setDescription(`*${loc.description}*\n\nI am at **${loc.name}** in **${loc.region}**...`)
        .setColor(0x800080);
      await message.reply({ embeds: [embed] });
      return;
    }
    if (cmd === 'fortune' || cmd === 'prophecy') {
      try {
        await message.channel.sendTyping();
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: NAZAR_SYSTEM + '\n\nGive a mysterious, vague fortune/prophecy. Make it intriguing but open to interpretation.',
          messages: [{ role: 'user', content: `Tell me my fortune, Madam Nazar. My name is ${message.author.username}.` }]
        });
        await message.reply(response.content[0].text);
      } catch (e) { await message.reply("*the cards refuse to speak*... Try again later."); }
      return;
    }
    if (cmd === 'help') {
      const embed = new EmbedBuilder().setTitle('🔮 Madam Nazar - Collector & Fortune Teller').setDescription("*The spirits guide my words...*").addFields(
        { name: '📍 Location', value: '`?nazar` - Where am I today?\n`?location` - Same thing' },
        { name: '🃏 Fortunes', value: '`?fortune` - Receive a prophecy\n`?prophecy` - Same thing' },
        { name: '💬 Chat', value: 'Just speak to me... I sense your questions.' }
      ).setColor(0x800080).setFooter({ text: 'ULTIMATE Edition' });
      await message.reply({ embeds: [embed] });
      return;
    }
    if (cmd === 'ping') { await message.reply(`*gazes into crystal ball* ...${client.ws.ping}ms...`); return; }
  }

  if (await checkShouldRespond(message)) await generateResponse(message);
});

client.on(Events.MessageReactionAdd, async (r, u) => { if (u.bot) return; if (intelligence && r.message.author?.id === client.user.id) await intelligence.handleReaction(r.message.id, r.emoji.name, u.id); });
client.on(Events.VoiceStateUpdate, (o, n) => { if (intelligence?.contextAwareness && n.guild) intelligence.contextAwareness.updateVoiceState(n.guild.id, n); });

client.on('error', console.error);
process.on('unhandledRejection', console.error);
client.login(process.env.DISCORD_TOKEN);
