require('dotenv').config();

const fs = require('fs');
const path = require('path');
const Module = require('module');
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  ActivityType
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) process.exit(console.error('❌ DISCORD_TOKEN 없음'));

const ROOT = __dirname;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();
client.prefixCommands = new Collection();

/* 루트 파일의 ../utils 경로 호환 */
const oldLoad = Module._load;
Module._load = function(req, parent, main) {
  const m = req.match(/^(?:\.\.\/utils\/|\.\/utils\/)(.+)$/);
  if (m) {
    const file = path.join(ROOT, m[1] + '.js');
    if (fs.existsSync(file)) return oldLoad(file, parent, main);
  }
  return oldLoad(req, parent, main);
};

const events = new Set([
  'ready','messageCreate','messageDelete','messageUpdate',
  'interactionCreate','guildMemberAdd','guildMemberRemove',
  'guildMemberUpdate','voiceStateUpdate','presenceUpdate',
  'channelCreate','channelDelete','channelUpdate',
  'roleCreate','roleDelete','roleUpdate','guildCreate',
  'guildDelete','error','warn','shardReconnecting','shardResume'
]);

const files = fs.readdirSync(ROOT)
  .filter(x => x.endsWith('.js') && !['index.js','deploy-commands.js'].includes(x));

/* 명령어 */
for (const file of files) {
  try {
    const x = require(path.join(ROOT, file));

    if (x?.data?.name && typeof x.execute === 'function') {
      client.commands.set(x.data.name, x);
      console.log(`✅ /${x.data.name}`);
    } else if (
      typeof x?.name === 'string' &&
      typeof x.execute === 'function' &&
      !events.has(x.name)
    ) {
      client.prefixCommands.set(x.name.toLowerCase(), x);
      console.log(`✅ !${x.name}`);
    }
  } catch (e) {
    console.log(`⚠️ ${file}: ${e.message}`);
  }
}

/* 이벤트 */
for (const file of files) {
  try {
    const x = require(path.join(ROOT, file));
    if (!events.has(x?.name) || x.name === 'ready') continue;

    const run = (...args) =>
      Promise.resolve(x.execute(...args, client))
        .catch(e => console.error(`❌ ${x.name}:`, e));

    x.once ? client.once(x.name, run) : client.on(x.name, run);
    console.log(`📌 ${x.name}`);
  } catch {}
}

/* 봇 시작 */
client.once('ready', async () => {
  console.log(`🤖 ${client.user.tag} ONLINE`);
  console.log(`🏠 서버 ${client.guilds.cache.size}개`);
  console.log(`⚡ 명령어 ${client.commands.size}개`);

  try {
    const store = require('./adminStore');
    store.seedOwners?.();
  } catch {}

  const commands = [...client.commands.values()]
    .filter(x => x.data?.toJSON)
    .map(x => x.data.toJSON());

  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.commands.set(commands);
    } catch (e) {
      console.error(`❌ ${guild.name}: ${e.message}`);
    }
  }

  const status = [
    '패밀리 관리중',
    '디톤님 도와주는중',
    '방송중',
    '듣는중'
  ];

  let i = 0;
  const setStatus = () => {
    client.user.setActivity(status[i], {
      type: ActivityType.Playing
    });
    i = (i + 1) % status.length;
  };

  setStatus();
  setInterval(setStatus, 10000);
});

/* 오류 */
client.on('error', console.error);
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(TOKEN);
