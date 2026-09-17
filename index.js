// index.js
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} = require('discord.js');

const logger = require('./utils/logger');
const { seedOwners } = require('./utils/adminStore');

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN이 없습니다.');
  process.exit(1);
}

try {
  seedOwners();
} catch (err) {
  console.error('❌ 오너 데이터 초기화 실패:', err);
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

client.commands = new Collection();
client.prefixCommands = new Collection();

const ROOT = __dirname;

function loadModule(filePath, type) {
  try {
    delete require.cache[require.resolve(filePath)];

    const mod = require(filePath);

    if (!mod) return null;

    if (type === 'slash') {
      if (
        mod.data &&
        typeof mod.execute === 'function'
      ) {
        client.commands.set(
          mod.data.name,
          mod
        );

        logger.log(
          `✅ 슬래시 명령어 로드: /${mod.data.name}`
        );

        return mod;
      }
    }

    if (type === 'prefix') {
      if (
        mod.name &&
        typeof mod.execute === 'function'
      ) {
        client.prefixCommands.set(
          mod.name,
          mod
        );

        logger.log(
          `✅ 접두사 명령어 로드: !${mod.name}`
        );

        return mod;
      }
    }

    return null;
  } catch (err) {
    logger.error(
      `❌ 모듈 로드 실패: ${filePath}`,
      err
    );
    return null;
  }
}

function loadDirectory(dir, type) {
  if (!fs.existsSync(dir)) return;

  const files = fs
    .readdirSync(dir)
    .filter(file => file.endsWith('.js'));

  for (const file of files) {
    loadModule(
      path.join(dir, file),
      type
    );
  }
}

// =====================================
// 명령어 로드
// =====================================

// 기존 구조
loadDirectory(
  path.join(ROOT, 'commands'),
  'slash'
);

loadDirectory(
  path.join(ROOT, 'commands-prefix'),
  'prefix'
);

// 현재 저장소 루트 구조
const rootFiles = fs
  .readdirSync(ROOT)
  .filter(file => file.endsWith('.js'));

for (const file of rootFiles) {
  const fullPath = path.join(ROOT, file);

  // index.js 자신은 제외
  if (file === 'index.js') continue;

  // 이벤트 파일은 아래 이벤트 로더에서 처리
  const eventNames = [
    'ready.js',
    'messageCreate.js',
    'messageDelete.js',
    'messageUpdate.js',
    'interactionCreate.js',
    'guildMemberAdd.js',
    'guildMemberRemove.js',
    'guildMemberUpdate.js',
    'shardReconnecting.js',
    'shardResume.js',
  ];

  if (eventNames.includes(file)) continue;

  // slash 명령어
  loadModule(fullPath, 'slash');

  // prefix 명령어
  loadModule(fullPath, 'prefix');
}

logger.log(
  `📊 슬래시 명령어 ${client.commands.size}개`
);

logger.log(
  `📊 접두사 명령어 ${client.prefixCommands.size}개`
);

// =====================================
// 이벤트 로드
// =====================================

const eventFiles = [
  'ready.js',
  'messageCreate.js',
  'messageDelete.js',
  'messageUpdate.js',
  'interactionCreate.js',
  'guildMemberAdd.js',
  'guildMemberRemove.js',
  'guildMemberUpdate.js',
  'shardReconnecting.js',
  'shardResume.js',
];

for (const file of eventFiles) {
  const fullPath = path.join(
    ROOT,
    file
  );

  if (!fs.existsSync(fullPath)) continue;

  try {
    delete require.cache[
      require.resolve(fullPath)
    ];

    const event = require(fullPath);

    if (
      !event ||
      !event.name ||
      typeof event.execute !== 'function'
    ) {
      logger.warn(
        `⚠️ 이벤트 형식 오류: ${file}`
      );
      continue;
    }

    const handler = (...args) => {
      Promise.resolve(
        event.execute(...args, client)
      ).catch(err => {
        logger.error(
          `❌ 이벤트 실행 오류: ${event.name}`,
          err
        );
      });
    };

    if (event.once) {
      client.once(
        event.name,
        handler
      );
    } else {
      client.on(
        event.name,
        handler
      );
    }

    logger.log(
      `✅ 이벤트 로드: ${event.name}`
    );

  } catch (err) {
    logger.error(
      `❌ 이벤트 로드 실패: ${file}`,
      err
    );
  }
}

// =====================================
// !봇상태
// =====================================

client.on(
  'messageCreate',
  async message => {
    if (message.author.bot) return;

    if (
      message.content.trim() !==
      '!봇상태'
    ) {
      return;
    }

    const uptime = () => {
      const seconds = Math.floor(
        (client.uptime || 0) / 1000
      );

      const days = Math.floor(
        seconds / 86400
      );

      const hours = Math.floor(
        (seconds % 86400) / 3600
      );

      const minutes = Math.floor(
        (seconds % 3600) / 60
      );

      const secs = seconds % 60;

      return `${days}일 ${hours}시간 ${minutes}분 ${secs}초`;
    };

    const status = () => {
      return [
        '🤖 **디톤 관리봇 상태**',
        '',
        `🟢 상태: **온라인**`,
        `📡 핑: **${client.ws.ping}ms**`,
        `⏱️ 가동시간: **${uptime()}**`,
        `🏠 서버: **${client.guilds.cache.size}개**`,
        `⚙️ Prefix 명령어: **${client.prefixCommands.size}개**`,
        `🔧 Slash 명령어: **${client.commands.size}개**`,
        `🕐 확인: <t:${Math.floor(Date.now() / 1000)}:T>`,
      ].join('\n');
    };

    try {
      const reply =
        await message.reply(status());

      const timer = setInterval(
        async () => {
          try {
            await reply.edit(
              status()
            );
          } catch {
            clearInterval(timer);
          }
        },
        5000
      );

      setTimeout(
        () => clearInterval(timer),
        5 * 60 * 1000
      );

    } catch (err) {
      logger.error(
        '!봇상태 처리 실패',
        err
      );
    }
  }
);

// =====================================
// Discord 오류
// =====================================

client.on(
  'error',
  err => {
    logger.error(
      'Discord Client 오류',
      err
    );
  }
);

client.on(
  'warn',
  info => {
    logger.warn(info);
  }
);

client.on(
  'shardError',
  err => {
    logger.error(
      'Shard 오류',
      err
    );
  }
);

process.on(
  'unhandledRejection',
  reason => {
    logger.error(
      '처리되지 않은 Promise 거부',
      reason
    );
  }
);

process.on(
  'uncaughtException',
  err => {
    logger.error(
      '처리되지 않은 예외',
      err
    );
  }
);

// =====================================
// 로그인
// =====================================

client.login(
  process.env.DISCORD_TOKEN
).then(() => {
  logger.log(
    '✅ Discord 로그인 요청 완료'
  );
}).catch(err => {
  logger.error(
    '❌ Discord 로그인 실패',
    err
  );

  process.exit(1);
});
