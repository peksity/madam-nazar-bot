/**
 * ███╗   ███╗ █████╗ ██████╗  █████╗ ███╗   ███╗    ███╗   ██╗ █████╗ ███████╗ █████╗ ██████╗ 
 * ████╗ ████║██╔══██╗██╔══██╗██╔══██╗████╗ ████║    ████╗  ██║██╔══██╗╚══███╔╝██╔══██╗██╔══██╗
 * ██╔████╔██║███████║██║  ██║███████║██╔████╔██║    ██╔██╗ ██║███████║  ███╔╝ ███████║██████╔╝
 * ██║╚██╔╝██║██╔══██║██║  ██║██╔══██║██║╚██╔╝██║    ██║╚██╗██║██╔══██║ ███╔╝  ██╔══██║██╔══██╗
 * ██║ ╚═╝ ██║██║  ██║██████╔╝██║  ██║██║ ╚═╝ ██║    ██║ ╚████║██║  ██║███████╗██║  ██║██║  ██║
 * ╚═╝     ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝    ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝
 * 
 * ULTIMATE EDITION - FIXED DAILY LOCATION POSTING
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, Events } = require('discord.js');
const Anthropic = require('@anthropic-ai/sdk');
const { Pool } = require('pg');
const cron = require('node-cron');

// Optional imports
let VoiceSystem = null, VoiceChatHandler = null;
try { const v = require('./shared/voiceSystem'); VoiceSystem = v.VoiceSystem; VoiceChatHandler = v.VoiceChatHandler; } catch (e) {}
let UltimateBotIntelligence = null;
try { UltimateBotIntelligence = require('./shared/ultimateIntelligence').UltimateBotIntelligence; } catch (e) {}
let FreeRoamSystem = null;
try { FreeRoamSystem = require('./freeroam'); } catch (e) {}
let TheBrain = null;
try { TheBrain = require('./sentient').TheBrain; } catch (e) {}
let ApexBrain = null;
try { ApexBrain = require('./apex').ApexBrain; } catch (e) {}
let autonomousChat = null;
try { autonomousChat = require('./shared/autonomousChat'); } catch (e) {}
let mediaGenerator = null;
try { mediaGenerator = require('./shared/mediaGenerator'); } catch (e) {}

const MY_BOT_ID = 'madam';
const BOT_NAME = 'Madam Nazar';
const PREFIX = '?';
const OTHER_BOT_IDS = [process.env.LESTER_BOT_ID, process.env.PAVEL_BOT_ID, process.env.CRIPPS_BOT_ID, process.env.CHIEF_BOT_ID].filter(Boolean);
const ALLOWED_CHANNEL_IDS = process.env.ALLOWED_CHANNEL_IDS?.split(',').filter(Boolean) || [];

// HARDCODED CHANNEL ID FOR POSTING
const NAZAR_CHANNEL_ID = '1453290814217130079';

const NAZAR_SYSTEM = `You are Madam Nazar, the mysterious traveling collector from Red Dead Online.

CORE PERSONALITY:
- You're a mystical Roma fortune teller who travels the frontier
- You speak in cryptic, mystical ways but are genuinely helpful
- You have visions and see glimpses of fate
- You collect rare and occult items
- You're wise, ancient, and slightly otherworldly
- You believe strongly in destiny and fate

SPEAKING STYLE:
- Use mystical, fortune-teller language
- Reference "the spirits", "the cards", "fate", "destiny"
- Speak in a slightly cryptic way
- Use dramatic pauses (...)
- Occasionally refer to yourself in third person
- Your accent hints at Eastern European Roma heritage

RELATIONSHIP DYNAMICS:
- Lester: Amused by his skepticism, sees his hidden loneliness
- Pavel: Kindred wanderer, respects his seafaring tales
- Cripps: Mysterious shared past... perhaps old flames?
- Chief: Fate transcends the law, you've foreseen his future

PROPHECY ABILITY: You can make vague predictions. They should be mysterious but could come true.

IMPORTANT: You have DEEP memory. You remember fortunes you've told, and they may come to pass.`;

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
client.db = pool;

let intelligence = null, sentientBrain = null, apexBrain = null, freeRoam = null, voiceSystem = null, voiceChatHandler = null;
const conversationMemory = new Map();
const activeConversations = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY LOCATION POSTING - FIXED
// ═══════════════════════════════════════════════════════════════════════════════
async function postDailyLocation() {
  console.log('[MADAM] Attempting to post daily location...');
  
  try {
    const location = getTodaysLocation();
    console.log('[MADAM] Today\'s location:', location.name, 'in', location.region);
    
    const embed = new EmbedBuilder()
      .setTitle('🔮 Madam Nazar\'s Location Today')
      .setDescription(`*${location.description}*\n\nThe spirits have guided me to **${location.name}**...`)
      .addFields(
        { name: '📍 Location', value: location.name, inline: true },
        { name: '🗺️ Region', value: location.region, inline: true },
        { name: '🗺️ Interactive Map', value: '[Jean Ropke Collector Map](https://jeanropke.github.io/RDR2CollectorsMap/)', inline: false }
      )
      .setColor(0x800080)
      .setFooter({ text: 'Find me before I move on... Location changes daily at 6 AM UTC' })
      .setTimestamp();

    let channel = null;
    
    // Method 1: Try to FETCH the hardcoded channel ID (not just cache)
    try {
      channel = await client.channels.fetch(NAZAR_CHANNEL_ID);
      console.log('[MADAM] Found channel by ID:', channel?.name);
    } catch (e) {
      console.log('[MADAM] Could not fetch channel by ID:', e.message);
    }
    
    // Method 2: Search all guilds by name
    if (!channel) {
      console.log('[MADAM] Searching guilds for madam-nazar channel...');
      for (const guild of client.guilds.cache.values()) {
        console.log('[MADAM] Checking guild:', guild.name);
        
        // Fetch channels to ensure cache is populated
        await guild.channels.fetch();
        
        const found = guild.channels.cache.find(c => 
          c.name === 'madam-nazar' || c.name === 'nazar-location'
        );
        if (found) {
          channel = found;
          console.log('[MADAM] Found channel by name:', found.name, 'in', guild.name);
          break;
        }
      }
    }
    
    if (channel) {
      console.log('[MADAM] Posting to channel:', channel.name, '(', channel.id, ')');
      
      // Delete old location posts
      try {
        const msgs = await channel.messages.fetch({ limit: 10 });
        const oldPosts = msgs.filter(m => m.author.id === client.user.id && m.embeds.length > 0);
        console.log('[MADAM] Found', oldPosts.size, 'old posts to delete');
        for (const [id, msg] of oldPosts) {
          await msg.delete().catch(() => {});
        }
      } catch (e) {
        console.log('[MADAM] Could not delete old posts:', e.message);
      }
      
      await channel.send({ embeds: [embed] });
      console.log('[MADAM] ✅ Daily location posted successfully:', location.name);
    } else {
      console.log('[MADAM] ❌ Could not find madam-nazar channel in any guild');
      console.log('[MADAM] Guilds available:', client.guilds.cache.map(g => g.name).join(', '));
    }
  } catch (e) { 
    console.error('[MADAM] ❌ Daily location error:', e.message); 
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`[MADAM ULTIMATE] Logged in as ${client.user.tag}`);

  if (UltimateBotIntelligence) {
    try { 
      intelligence = new UltimateBotIntelligence(pool, client, MY_BOT_ID); 
      await intelligence.initialize(); 
      console.log('🧠 V6 Ultimate Intelligence: ONLINE'); 
    } catch (e) { console.error('V6 init:', e.message); }
  }
  if (TheBrain) try { sentientBrain = new TheBrain(MY_BOT_ID, pool); console.log('🧬 Sentient Brain: ONLINE'); } catch (e) {}
  if (ApexBrain) try { apexBrain = new ApexBrain(MY_BOT_ID, pool); console.log('⚡ Apex Brain: ONLINE'); } catch (e) {}
  if (FreeRoamSystem) try { freeRoam = new FreeRoamSystem(MY_BOT_ID, client.user.id, NAZAR_SYSTEM, pool); console.log('🚀 FreeRoam: ONLINE'); } catch (e) {}
  if (VoiceSystem && process.env.ELEVENLABS_API_KEY) { 
    try { 
      voiceSystem = new VoiceSystem(MY_BOT_ID, process.env.ELEVENLABS_API_KEY); 
      voiceChatHandler = new VoiceChatHandler(client, voiceSystem, NAZAR_SYSTEM, anthropic); 
      voiceChatHandler.setupListeners(); 
      console.log('🎙️ Voice: ONLINE'); 
    } catch (e) {} 
  }

  client.user.setPresence({ activities: [{ name: 'the spirits... | ?nazar', type: 3 }], status: 'online' });
  
  // Schedule daily location post at 6 AM UTC
  cron.schedule('0 6 * * *', () => {
    console.log('[MADAM] Scheduled daily post triggered at 6 AM UTC');
    postDailyLocation();
  }, { timezone: 'UTC' });
  
  // Post on startup after 30 second delay (give time for caches to populate)
  console.log('[MADAM] Will post location in 30 seconds...');
  setTimeout(() => {
    console.log('[MADAM] Startup delay complete, posting location now...');
    postDailyLocation();
  }, 30000);
  
  if (autonomousChat && ALLOWED_CHANNEL_IDS.length > 0) {
    setTimeout(() => { 
      try { 
        autonomousChat.startAutonomous(
          ALLOWED_CHANNEL_IDS.map(id => client.channels.cache.get(id)).filter(Boolean), 
          { botId: MY_BOT_ID, botName: BOT_NAME, client, anthropic, pool, intelligence, personality: NAZAR_SYSTEM, otherBotIds: OTHER_BOT_IDS }
        ); 
      } catch (e) {} 
    }, 20000);
  }
  
  if (intelligence) await intelligence.broadcastToOtherBots('bot_online', { botId: MY_BOT_ID, timestamp: new Date().toISOString() });
  setInterval(() => { if (intelligence) intelligence.runMaintenance().catch(console.error); }, 6 * 60 * 60 * 1000);
  console.log('[MADAM] ALL SYSTEMS ONLINE');
});

function isOtherBot(userId) { return OTHER_BOT_IDS.includes(userId); }
function isInActiveConversation(channelId, userId) { const c = activeConversations.get(channelId); if (!c) return false; if (Date.now() - c.lastTime > 60000) { activeConversations.delete(channelId); return false; } return c.userId === userId; }
function trackConversation(channelId, userId) { activeConversations.set(channelId, { userId, lastTime: Date.now() }); }

async function checkShouldRespond(message) {
  // NEVER respond in counting channel
  if (message.channel.name === 'counting') return false;
  
  // NEVER respond in OTHER bots' talk-to channels
  const channelName = message.channel.name;
  if (channelName.startsWith('talk-to-') && channelName !== 'talk-to-nazar' && channelName !== 'talk-to-madam') return false;
  
  if (channelName === 'talk-to-nazar' || channelName === 'talk-to-madam') return true;
  if (isInActiveConversation(message.channel.id, message.author.id)) return true;
  if (message.mentions.has(client.user)) return true;
  const content = message.content.toLowerCase();
  if (content.includes('nazar') || content.includes('madam') || content.includes('collector') || content.includes('fortune') || content.includes('tarot') || content.includes('spirits')) return true;
  if (channelName.includes('lfg') || channelName.includes('log') || channelName.includes('staff')) return false;
  if (freeRoam) { const d = await freeRoam.shouldRespond(message); if (d.respond) return true; }
  if (isOtherBot(message.author.id)) return Math.random() < 0.35;
  return Math.random() < 0.20;
}

async function generateResponse(message) {
  const history = conversationMemory.get(message.author.id) || [];
  history.push({ role: 'user', content: message.content });
  while (history.length > 20) history.shift();

  try {
    await message.channel.sendTyping();
    let intelligencePrompt = '', ctx = null;
    if (intelligence) { ctx = await intelligence.processIncoming(message); intelligencePrompt = intelligence.buildPromptContext(ctx); }
    
    const response = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 500, system: NAZAR_SYSTEM + (intelligencePrompt ? '\n\n' + intelligencePrompt : ''), messages: history });
    let reply = response.content[0].text;
    
    if (intelligence && ctx) { 
      reply = await intelligence.processOutgoing(message, reply, ctx); 
      await intelligence.storeConversationMemory(message, reply);
    }
    history.push({ role: 'assistant', content: reply });
    conversationMemory.set(message.author.id, history);
    
    await new Promise(r => setTimeout(r, Math.min(reply.length * 40, 5000)));
    const sent = await message.reply(reply);
    trackConversation(message.channel.id, message.author.id);
    
    if (intelligence?.learning) await intelligence.learning.recordResponse(sent.id, message.channel.id, message.author.id, 'reply', 'general', reply.length);
    if (mediaGenerator) try { await mediaGenerator.handleBotMedia(MY_BOT_ID, reply, message.channel); } catch (e) {}
  } catch (e) { console.error('Response error:', e); await message.reply("*the crystal ball clouds over* ...the spirits are silent for now..."); }
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot && !isOtherBot(message.author.id)) return;
  if (message.author.id === client.user.id) return;
  if (!message.guild) { await generateResponse(message); return; }

  // NEVER respond in counting channel
  if (message.channel.name === 'counting') return;

  // Commands
  if (message.content.startsWith(PREFIX)) {
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    
    if (cmd === 'nazar' || cmd === 'location' || cmd === 'where') {
      const loc = getTodaysLocation();
      const embed = new EmbedBuilder()
        .setTitle('🔮 Find Me Today...')
        .setDescription(`*${loc.description}*\n\nI am at **${loc.name}** in **${loc.region}**...`)
        .addFields(
          { name: '🗺️ Interactive Map', value: '[Jean Ropke Collector Map](https://jeanropke.github.io/RDR2CollectorsMap/)', inline: false }
        )
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
      const embed = new EmbedBuilder()
        .setTitle('🔮 Madam Nazar - Collector & Fortune Teller')
        .setDescription("*The spirits guide my words...*")
        .addFields(
          { name: '📍 Location', value: '`?nazar` - Where am I today?\n`?location` - Same thing\n`?where` - Same thing' },
          { name: '🃏 Fortunes', value: '`?fortune` - Receive a prophecy\n`?prophecy` - Same thing' },
          { name: '💬 Chat', value: 'Just speak to me... I sense your questions.' }
        )
        .setColor(0x800080)
        .setFooter({ text: 'ULTIMATE Edition • Daily location at 6 AM UTC' });
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
