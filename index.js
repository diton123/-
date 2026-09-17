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
  logger.error('DISCORD_TOKEN 환경변수가 설정되어 있지 않습니다.');
  process.exit(1);
}

// 기본 오너 데이터 준비
try {
  seedOwners();
} catch (err) {
  logger.error('오너 데이터 초기화 실패', err);
}

// ==============================
// Discord Client
// ==============================

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

// ==============================
// 공통 파일 로더
// ==============================

function safeReadJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    logger.warn(`폴더가 없습니다: ${dir}`);
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.js'));
}

// ==============================
// Slash Commands
// ==============================

client.commands = new Collection();

const commandsPath = path.join(
  __dirname,
  'commands'
);

for (const file of safeReadJsFiles(commandsPath)) {
  try {
    const filePath = path.join(
      commandsPath,
      file
    );

    const command = require(filePath);

    if (
      command &&
      command.data &&
      typeof command.execute === 'function'
    ) {
      client.commands.set(
        command.data.name,
        command
      );

      logger.log(
        `슬래시 명령어 로드: ${command.data.name}`
      );
    }
  } catch (err) {
    logger.error(
      `슬래시 명령어 로드 실패: ${file}`,
      err
    );
  }
}

logger.log(
  `${client.commands.size}개의 슬래시 명령어를 로드했습니다.`
);

// ==============================
// Prefix Commands
// ==============================

client.prefixCommands = new Collection();

const prefixCommandsPath = path.join(
  __dirname,
  'commands-prefix'
);

for (const file of safeReadJsFiles(prefixCommandsPath)) {
  try {
    const filePath = path.join(
      prefixCommandsPath,
      file
    );

    const command = require(filePath);

    if (
      command &&
      command.name &&
      typeof command.execute === 'function'
    ) {
      client.prefixCommands.set(
        command.name,
        command
      );

      logger.log(
        `접두사 명령어 로드: !${command.name}`
      );
    }
  } catch (err) {
    logger.error(
      `접두사 명령어 로드 실패: ${file}`,
      err
    );
  }
}

logger.log(
  `${client.prefixCommands.size}개의 접두사 명령어를 로드했습니다.`
);

// ==============================
// Events
// ==============================

const eventsPath = path.join(
  __dirname,
  'events'
);

for (const file of safeReadJsFiles(eventsPath)) {
  try {
    const filePath = path.join(
      eventsPath,
      file
    );

    const event = require(filePath);

    if (
      !event ||
      !event.name ||
      typeof event.execute !== 'function'
    ) {
      logger.warn(
        `잘못된 이벤트 형식: ${file}`
      );
      continue;
    }

    const handler = (...args) => {
      try {
        return event.execute(
          ...args,
          client
        );
      } catch (err) {
        logger.error(
          `이벤트 실행 오류: ${event.name}`,
          err
        );
      }
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
      `이벤트 로드: ${event.name} (${file})`
    );

  } catch (err) {
    logger.error(
      `이벤트 로드 실패: ${file}`,
      err
    );
  }
}

// ==============================
// 봇 상태
// ==============================

client.once('ready', () => {
  logger.log(
    `🤖 로그인 완료: ${client.user.tag}`
  );

  logger.log(
    `📡 서버 수: ${client.guilds.cache.size}`
  );

  logger.log(
    `⚙️ Prefix 명령어: ${client.prefixCommands.size}개`
  );

  logger.log(
    `🔧 Slash 명령어: ${client.commands.size}개`
  );

  client.user.setPresence({
    activities: [
      {
        name: '디톤 관리중',
        type: 0,
      },
    ],
    status: 'online',
  });
});

// ==============================
// !봇상태
//
// messageCreate는 이미
// events/messageCreate.js에서 처리하므로
// 여기서는 별도의 messageCreate 이벤트를
// 만들지 않습니다.
// ==============================

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (
    !message.guild &&
    message.content.trim() !== '!봇상태'
  ) {
    return;
  }

  if (
    message.content.trim() !== '!봇상태'
  ) {
    return;
  }

  try {
    const getUptime = () => {
      const totalSeconds = Math.floor(
        (client.uptime || 0) / 1000
      );

      const days = Math.floor(
        totalSeconds / 86400
      );

      const hours = Math.floor(
        (totalSeconds % 86400) / 3600
      );

      const minutes = Math.floor(
        (totalSeconds % 3600) / 60
      );

      const seconds =
        totalSeconds % 60;

      return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
    };

    const getStatus = () => {
      return client.isReady()
        ? '🟢 온라인'
        : '🔴 오프라인';
    };

    const createStatus = () => {
      const ping = Math.round(
        client.ws.ping
      );

      const timestamp =
        Math.floor(Date.now() / 1000);

      return [
        '🤖 **디톤 관리봇 상태**',
        '',
        `상태: **${getStatus()}**`,
        `📡 핑: **${ping}ms**`,
        `⏱️ 가동시간: **${getUptime()}**`,
        `🕐 확인: <t:${timestamp}:T>`,
      ].join('\n');
    };

    const statusMessage =
      await message.reply(
        createStatus()
      );

    const timer = setInterval(
      async () => {
        try {
          await statusMessage.edit(
            createStatus()
          );
        } catch {
          clearInterval(timer);
        }
      },
      5000
    );

    setTimeout(() => {
      clearInterval(timer);
    }, 5 * 60 * 1000);

  } catch (err) {
    logger.error(
      '!봇상태 처리 실패',
      err
    );
  }
});

// ==============================
// Discord 오류
// ==============================

client.on('error', (err) => {
  logger.error(
    'Discord Client 오류',
    err
  );
});

client.on('warn', (info) => {
  logger.warn(info);
});

client.on('shardError', (err) => {
  logger.error(
    'Shard 오류',
    err
  );
});

client.on(
  'shardReconnecting',
  (id) => {
    logger.warn(
      `Shard ${id} 재연결 중`
    );
  }
);

client.on(
  'shardResume',
  (id, replayed) => {
    logger.log(
      `Shard ${id} 재연결 완료 (${replayed}개 이벤트 재생)`
    );
  }
);

// ==============================
// Process 오류
// ==============================

process.on(
  'unhandledRejection',
  (reason) => {
    logger.error(
      '처리되지 않은 Promise 거부',
      reason
    );
  }
);

process.on(
  'uncaughtException',
  (err) => {
    logger.error(
      '처리되지 않은 예외',
      err
    );
  }
);

// ==============================
// 로그인
// ==============================

client.login(
  process.env.DISCORD_TOKEN
).catch((err) => {
  logger.error(
    'Discord 로그인 실패',
    err
  );

  process.exit(1);
});
