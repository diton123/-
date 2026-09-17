require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN이 없습니다.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
  ],

  partials: [
    Partials.Channel,
    Partials.Message,
  ],
});

/* =========================
   명령어
========================= */

client.commands = new Collection();
client.prefixCommands = new Collection();

const ROOT = __dirname;

const discordEvents = new Set([
  'ready',
  'messageCreate',
  'messageDelete',
  'messageUpdate',
  'interactionCreate',
  'guildMemberAdd',
  'guildMemberRemove',
  'guildMemberUpdate',
  'voiceStateUpdate',
  'presenceUpdate',
  'channelCreate',
  'channelDelete',
  'channelUpdate',
  'roleCreate',
  'roleDelete',
  'roleUpdate',
  'guildCreate',
  'guildDelete',
  'error',
  'warn',
  'shardReconnecting',
  'shardResume',
]);

function getRootJsFiles() {
  return fs
    .readdirSync(ROOT)
    .filter(file =>
      file.endsWith('.js') &&
      file !== 'index.js' &&
      file !== 'deploy-commands.js'
    );
}

/* =========================
   루트 명령어 자동 검색
========================= */

for (const file of getRootJsFiles()) {
  try {
    const fullPath = path.join(ROOT, file);
    const mod = require(fullPath);

    // Slash Command
    if (
      mod &&
      mod.data &&
      typeof mod.execute === 'function'
    ) {
      const name = mod.data.name;

      if (name) {
        client.commands.set(name, mod);
        console.log(`✅ 슬래시 명령어 로드: /${name}`);
      }
    }

    // Prefix Command
    if (
      mod &&
      typeof mod.name === 'string' &&
      typeof mod.execute === 'function' &&
      !discordEvents.has(mod.name)
    ) {
      client.prefixCommands.set(mod.name, mod);
      console.log(`✅ 접두사 명령어 로드: !${mod.name}`);
    }

  } catch (err) {
    console.log(`⚠️ ${file} 로드 건너뜀`);
    console.log(err.message);
  }
}

console.log(
  `📦 슬래시 명령어 ${client.commands.size}개 로드`
);

console.log(
  `📦 접두사 명령어 ${client.prefixCommands.size}개 로드`
);

/* =========================
   기존 이벤트 자동 로드
========================= */

for (const file of getRootJsFiles()) {
  try {
    const fullPath = path.join(ROOT, file);
    const mod = require(fullPath);

    if (
      !mod ||
      typeof mod.name !== 'string' ||
      typeof mod.execute !== 'function'
    ) {
      continue;
    }

    if (!discordEvents.has(mod.name)) {
      continue;
    }

    if (mod.name === 'messageCreate') continue;
    if (mod.name === 'interactionCreate') continue;
    if (mod.name === 'ready') continue;

    if (mod.once) {
      client.once(
        mod.name,
        (...args) => mod.execute(...args, client)
      );
    } else {
      client.on(
        mod.name,
        (...args) => mod.execute(...args, client)
      );
    }

    console.log(`✅ 이벤트 로드: ${mod.name}`);

  } catch (err) {
    console.log(`⚠️ 이벤트 ${file} 로드 실패: ${err.message}`);
  }
}

/* =========================
   READY
========================= */

client.once('ready', () => {
  console.log('');
  console.log('================================');
  console.log(`🤖 로그인 완료: ${client.user.tag}`);
  console.log(`🏠 서버 수: ${client.guilds.cache.size}`);
  console.log(`⚡ 슬래시 명령어: ${client.commands.size}개`);
  console.log(`⌨️ 접두사 명령어: ${client.prefixCommands.size}개`);
  console.log('================================');
});

/* =========================
   SLASH COMMAND
========================= */

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(
    interaction.commandName
  );

  if (!command) {
    return interaction.reply({
      content: '❌ 등록되지 않은 명령어입니다.',
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(
      `❌ /${interaction.commandName} 오류:`,
      err
    );

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({
        content: '❌ 명령어 실행 중 오류가 발생했습니다.',
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: '❌ 명령어 실행 중 오류가 발생했습니다.',
        ephemeral: true,
      }).catch(() => {});
    }
  }
});

/* =========================
   PREFIX COMMAND
========================= */

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.trim();

  if (!content.startsWith('!')) return;

  const args = content
    .slice(1)
    .trim()
    .split(/\s+/);

  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  const command =
    client.prefixCommands.get(commandName);

  if (!command) return;

  try {
    await command.execute(
      message,
      args,
      client
    );
  } catch (err) {
    console.error(
      `❌ !${commandName} 오류:`,
      err
    );

    await message.reply(
      '❌ 명령어 실행 중 오류가 발생했습니다.'
    ).catch(() => {});
  }
});

/* =========================
   !봇상태
========================= */

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.trim() !== '!봇상태') return;

  const formatUptime = () => {
    const total = Math.floor(
      (client.uptime || 0) / 1000
    );

    const days = Math.floor(total / 86400);

    const hours = Math.floor(
      (total % 86400) / 3600
    );

    const minutes = Math.floor(
      (total % 3600) / 60
    );

    const seconds = total % 60;

    return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
  };

  const getStatus = () => {
    return [
      `🤖 **현재 봇 상태는 🟢 온라인 입니다.**`,
      '',
      `📡 핑: **${client.ws.ping}ms**`,
      `⏱️ 가동시간: **${formatUptime()}**`,
      `👥 서버: **${client.guilds.cache.size}개**`,
      `🔧 슬래시 명령어: **${client.commands.size}개**`,
      `⌨️ 접두사 명령어: **${client.prefixCommands.size}개**`,
      `🔄 마지막 확인: <t:${Math.floor(Date.now() / 1000)}:T>`,
    ].join('\n');
  };

  try {
    const msg = await message.reply(
      getStatus()
    );

    const timer = setInterval(async () => {
      try {
        await msg.edit(getStatus());
      } catch {
        clearInterval(timer);
      }
    }, 5000);

    setTimeout(() => {
      clearInterval(timer);
    }, 5 * 60 * 1000);

  } catch (err) {
    console.error('!봇상태 오류:', err);
  }
});

/* =========================
   오류 처리
========================= */

process.on(
  'unhandledRejection',
  err => {
    console.error('❌ Unhandled Rejection:', err);
  }
);

process.on(
  'uncaughtException',
  err => {
    console.error('❌ Uncaught Exception:', err);
  }
);

client.on('error', err => {
  console.error('❌ Discord Client Error:', err);
});

/* =========================
   LOGIN
========================= */

client.login(TOKEN).catch(err => {
  console.error('❌ Discord 로그인 실패');
  console.error(err);
  process.exit(1);
});
