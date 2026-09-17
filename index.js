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

/* =====================================================
   환경변수
===================================================== */

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN 환경변수가 없습니다.');
  process.exit(1);
}

/* =====================================================
   기본 경로
===================================================== */

const ROOT = __dirname;

/* =====================================================
   utils 경로 자동 호환
   -----------------------------------------------------
   현재 저장소 구조:
   /logger.js
   /permissions.js
   /database.js
   /adminStore.js

   기존 파일:
   ../utils/logger
   ../utils/permissions
   ../utils/database
   ../utils/adminStore

   위 두 구조를 모두 사용할 수 있도록 처리합니다.
===================================================== */

const originalModuleLoad = Module._load;

Module._load = function (request, parent, isMain) {
  const match = request.match(
    /^(?:\.\.\/utils|\.\/utils)\/(.+)$/
  );

  if (match) {
    const target = match[1];

    const candidates = [
      path.join(ROOT, target),
      path.join(ROOT, `${target}.js`),
      path.join(ROOT, `${target}.json`)
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return originalModuleLoad(
          candidate,
          parent,
          isMain
        );
      }
    }
  }

  return originalModuleLoad(
    request,
    parent,
    isMain
  );
};

/* =====================================================
   Discord Client
===================================================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ],

  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember
  ]
});

/* =====================================================
   Collection
===================================================== */

client.commands = new Collection();
client.prefixCommands = new Collection();

/* =====================================================
   Discord 이벤트 목록
===================================================== */

const DISCORD_EVENTS = new Set([
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
  'shardResume'
]);

/* =====================================================
   루트 JS 파일 검색
===================================================== */

function getRootFiles() {
  return fs
    .readdirSync(ROOT)
    .filter(file => {
      return (
        file.endsWith('.js') &&
        file !== 'index.js' &&
        file !== 'deploy-commands.js'
      );
    });
}

/* =====================================================
   안전한 require
===================================================== */

function loadModule(file) {
  try {
    return require(
      path.join(ROOT, file)
    );
  } catch (error) {
    console.error(
      `⚠️ ${file} 로드 실패: ${error.message}`
    );

    return null;
  }
}

/* =====================================================
   모듈 분류
===================================================== */

const rootFiles = getRootFiles();

/* =====================================================
   1차 로딩
   - Slash Commands
   - Prefix Commands
===================================================== */

for (const file of rootFiles) {
  const mod = loadModule(file);

  if (!mod) {
    continue;
  }

  /* -------------------------------------------------
     Slash Command
  ------------------------------------------------- */

  if (
    mod.data &&
    typeof mod.execute === 'function' &&
    mod.data.name
  ) {
    const commandName =
      String(mod.data.name).toLowerCase();

    client.commands.set(
      commandName,
      mod
    );

    console.log(
      `✅ 슬래시 명령어 로드: /${commandName}`
    );

    continue;
  }

  /* -------------------------------------------------
     Discord Event
  ------------------------------------------------- */

  if (
    typeof mod.name === 'string' &&
    DISCORD_EVENTS.has(mod.name)
  ) {
    continue;
  }

  /* -------------------------------------------------
     Prefix Command
     
     지원 형식:

     module.exports = {
       name: '핑',
       execute(message, args, client) {}
     }

     또는

     module.exports = {
       name: '경고',
       aliases: ['warn'],
       execute(message, args, client) {}
     }
  ------------------------------------------------- */

  if (
    typeof mod.name === 'string' &&
    typeof mod.execute === 'function'
  ) {
    const commandName =
      mod.name
        .replace(/^!/, '')
        .trim()
        .toLowerCase();

    if (!commandName) {
      continue;
    }

    client.prefixCommands.set(
      commandName,
      mod
    );

    console.log(
      `✅ 접두사 명령어 로드: !${commandName}`
    );

    /* aliases */

    if (Array.isArray(mod.aliases)) {
      for (const alias of mod.aliases) {
        if (!alias) {
          continue;
        }

        const aliasName =
          String(alias)
            .replace(/^!/, '')
            .trim()
            .toLowerCase();

        if (!aliasName) {
          continue;
        }

        client.prefixCommands.set(
          aliasName,
          mod
        );

        console.log(
          `↳ 별칭 로드: !${aliasName}`
        );
      }
    }
  }
}

/* =====================================================
   관리자 Store 초기화
===================================================== */

try {
  const adminStore =
    require(
      path.join(ROOT, 'adminStore.js')
    );

  if (
    adminStore &&
    typeof adminStore.seedOwners === 'function'
  ) {
    adminStore.seedOwners();

    console.log(
      '👑 오너 데이터 초기화 완료'
    );
  }
} catch (error) {
  console.error(
    '⚠️ 관리자 Store 초기화 실패:',
    error.message
  );
}

/* =====================================================
   로딩 결과
===================================================== */

console.log('');
console.log('====================================');
console.log('📦 명령어 로딩 결과');
console.log('====================================');
console.log(
  `⚡ 슬래시 명령어: ${client.commands.size}개`
);
console.log(
  `⌨️ 접두사 명령어: ${client.prefixCommands.size}개`
);
console.log('====================================');
console.log('');

/* =====================================================
   이벤트 로드
===================================================== */

for (const file of rootFiles) {
  const mod = loadModule(file);

  if (!mod) {
    continue;
  }

  if (
    typeof mod.name !== 'string' ||
    typeof mod.execute !== 'function'
  ) {
    continue;
  }

  if (!DISCORD_EVENTS.has(mod.name)) {
    continue;
  }

  /*
    아래 3개는 index.js에서 직접 처리합니다.
  */

  if (
    mod.name === 'ready' ||
    mod.name === 'messageCreate' ||
    mod.name === 'interactionCreate'
  ) {
    continue;
  }

  try {
    if (mod.once) {
      client.once(
        mod.name,
        (...args) => {
          Promise.resolve(
            mod.execute(...args, client)
          ).catch(error => {
            console.error(
              `❌ 이벤트 ${mod.name} 오류:`,
              error
            );
          });
        }
      );
    } else {
      client.on(
        mod.name,
        (...args) => {
          Promise.resolve(
            mod.execute(...args, client)
          ).catch(error => {
            console.error(
              `❌ 이벤트 ${mod.name} 오류:`,
              error
            );
          });
        }
      );
    }

    console.log(
      `✅ 이벤트 로드: ${mod.name}`
    );

  } catch (error) {
    console.error(
      `❌ 이벤트 등록 실패: ${mod.name}`,
      error
    );
  }
}

/* =====================================================
   READY
===================================================== */

client.once(
  'ready',
  async () => {

    console.log('');
    console.log(
      '===================================='
    );
    console.log(
      '🤖 디톤 패밀리 관리봇'
    );
    console.log(
      '===================================='
    );

    console.log(
      `👤 로그인: ${client.user.tag}`
    );

    console.log(
      '🟢 상태: ONLINE'
    );

    console.log(
      `🏠 서버: ${client.guilds.cache.size}개`
    );

    console.log(
      `⚡ 슬래시: ${client.commands.size}개`
    );

    console.log(
      `⌨️ 접두사: ${client.prefixCommands.size}개`
    );

    console.log(
      '===================================='
    );

    /* ===============================================
       Slash Commands 서버 등록
    =============================================== */

    const slashCommands = [
      ...client.commands.values()
    ]
      .filter(command => {
        return (
          command.data &&
          typeof command.data.toJSON === 'function'
        );
      })
      .map(command => {
        return command.data.toJSON();
      });

    for (
      const guild
      of client.guilds.cache.values()
    ) {

      try {

        await guild.commands.set(
          slashCommands
        );

        console.log(
          `✅ 슬래시 등록 완료: ${guild.name} (${slashCommands.length}개)`
        );

      } catch (error) {

        console.error(
          `❌ ${guild.name} 슬래시 등록 실패:`,
          error.message
        );
      }
    }

    /* ===============================================
       상태메시지
    =============================================== */

    const statuses = [
      '패밀리 관리중',
      '디톤님 도와주는중',
      '방송중',
      '듣는중'
    ];

    let statusIndex = 0;

    function updateStatus() {

      if (!client.user) {
        return;
      }

      client.user.setActivity(
        statuses[statusIndex],
        {
          type: ActivityType.Playing
        }
      );

      statusIndex =
        (statusIndex + 1) %
        statuses.length;
    }

    updateStatus();

    setInterval(
      updateStatus,
      10000
    );
  }
);

/* =====================================================
   Slash Command Handler
===================================================== */

client.on(
  'interactionCreate',
  async interaction => {

    /*
      버튼 / 모달 / 기타 interaction은
      기존 모듈이 처리할 수 있도록
      Chat Input Command만 여기서 처리합니다.
    */

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    const command =
      client.commands.get(
        interaction.commandName
      );

    if (!command) {

      if (!interaction.replied) {
        await interaction.reply({
          content:
            '❌ 등록되지 않은 명령어입니다.',
          ephemeral: true
        }).catch(() => {});
      }

      return;
    }

    try {

      await command.execute(
        interaction,
        client
      );

    } catch (error) {

      console.error(
        `❌ /${interaction.commandName} 오류:`,
        error
      );

      const reply = {
        content:
          '❌ 명령어 실행 중 오류가 발생했습니다.',
        ephemeral: true
      };

      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction
          .editReply(reply)
          .catch(() => {});

      } else {

        await interaction
          .reply(reply)
          .catch(() => {});
      }
    }
  }
);

/* =====================================================
   Prefix Command Handler
===================================================== */

client.on(
  'messageCreate',
  async message => {

    if (message.author.bot) {
      return;
    }

    if (!message.guild) {
      return;
    }

    const content =
      message.content
        .trim();

    /* ===============================================
       !도움말 / !명령어
       
       실제 help.js가 존재하면 help.js가 처리합니다.
       여기서는 help.js가 로드되지 않았을 경우를
       대비한 기본 도움말만 제공합니다.
    =============================================== */

    if (
      content === '!도움말' ||
      content === '!명령어'
    ) {

      const helpCommand =
        client.prefixCommands.get(
          '도움말'
        );

      /*
        help.js가 정상적으로 로드된 경우
        여기서 중복 응답하지 않습니다.
      */

      if (helpCommand) {
        return;
      }

      const embed =
        require('discord.js')
          .EmbedBuilder;

      const help =
        new embed()
          .setTitle(
            '📖 디톤 관리봇 도움말'
          )
          .setDescription(
            '디톤 패밀리 관리봇 명령어입니다.'
          )
          .addFields(
            {
              name: '🤖 기본',
              value: [
                '`!봇상태`',
                '`!핑`',
                '`!서버정보`',
                '`!유저정보 @유저`'
              ].join('\n')
            },
            {
              name: '⚠️ 경고',
              value: [
                '`!경고 @유저 사유`',
                '`!경고조회 @유저`',
                '`!경고초기화 @유저`'
              ].join('\n')
            },
            {
              name: '👑 오너 / 관리자',
              value: [
                '`!리스트`',
                '`!오너등록`',
                '`!관리자발급 @유저`',
                '`!관리자등록`',
                '`!관리자제거 @유저`',
                '`!설정패널`'
              ].join('\n')
            }
          )
          .setFooter({
            text:
              '디톤 패밀리 관리봇'
          })
          .setTimestamp();

      await message.reply({
        embeds: [help]
      }).catch(() => {});

      return;
    }

    /* ===============================================
       !봇상태
    =============================================== */

    if (
      content === '!봇상태'
    ) {

      const online =
        client.isReady();

      const status =
        online
          ? '🟢 온라인'
          : '🔴 오프라인';

      const guildCount =
        client.guilds.cache.size;

      const totalMembers =
        client.guilds.cache.reduce(
          (total, guild) => {
            return (
              total +
              (guild.memberCount || 0)
            );
          },
          0
        );

      const currentGuild =
        message.guild;

      let currentServerInfo =
        'DM에서 실행됨';

      if (currentGuild) {

        currentServerInfo = [
          `🏠 서버명: **${currentGuild.name}**`,
          `🆔 서버 ID: **${currentGuild.id}**`,
          `👥 서버 인원: **${currentGuild.memberCount}명**`,
          `📅 서버 생성일: <t:${Math.floor(currentGuild.createdTimestamp / 1000)}:D>`
        ].join('\n');
      }

      const guildList =
        client.guilds.cache
          .map(guild => {
            return (
              `• **${guild.name}** — ${guild.memberCount}명`
            );
          })
          .join('\n');

      const uptime =
        Math.floor(
          (client.uptime || 0) / 1000
        );

      const days =
        Math.floor(
          uptime / 86400
        );

      const hours =
        Math.floor(
          (uptime % 86400) / 3600
        );

      const minutes =
        Math.floor(
          (uptime % 3600) / 60
        );

      const seconds =
        uptime % 60;

      const uptimeText =
        `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;

      const text = [
        '🤖 **디톤 패밀리 관리봇 상태**',
        '',
        `📡 봇 상태: **${status}**`,
        `🏓 Discord Ping: **${client.ws.ping}ms**`,
        `⏱️ 가동시간: **${uptimeText}**`,
        '',
        '📊 **전체 서버 정보**',
        `🏠 연결된 서버: **${guildCount}개**`,
        `👥 전체 서버 인원: **${totalMembers}명**`,
        `⚡ 슬래시 명령어: **${client.commands.size}개**`,
        `⌨️ 접두사 명령어: **${client.prefixCommands.size}개**`,
        '',
        '📌 **현재 서버 정보**',
        currentServerInfo,
        '',
        '🌐 **연결된 서버 목록**',
        guildList ||
          '연결된 서버가 없습니다.',
        '',
        `🕐 확인시간: <t:${Math.floor(Date.now() / 1000)}:F>`
      ].join('\n');

      await message
        .reply(text)
        .catch(() => {});

      return;
    }

    /* ===============================================
       접두사 명령어가 아니면 종료
    =============================================== */

    if (
      !content.startsWith('!')
    ) {
      return;
    }

    /* ===============================================
       명령어 파싱
       
       !경고 @유저 사유
       !관리자발급 @유저
       !리스트
    =============================================== */

    const parts =
      content
        .slice(1)
        .trim()
        .split(/\s+/);

    const commandName =
      (
        parts.shift() ||
        ''
      )
        .toLowerCase();

    if (!commandName) {
      return;
    }

    const command =
      client.prefixCommands.get(
        commandName
      );

    if (!command) {

      /*
        알 수 없는 !명령어는
        조용히 무시합니다.
      */

      return;
    }

    try {

      await command.execute(
        message,
        parts,
        client
      );

    } catch (error) {

      console.error(
        `❌ !${commandName} 오류:`,
        error
      );

      await message
        .reply(
          '❌ 명령어 실행 중 오류가 발생했습니다.'
        )
        .catch(() => {});
    }
  }
);

/* =====================================================
   Discord Error
===================================================== */

client.on(
  'error',
  error => {

    console.error(
      '❌ Discord Client Error:',
      error
    );
  }
);

client.on(
  'warn',
  warning => {

    console.warn(
      '⚠️ Discord Warning:',
      warning
    );
  }
);

/* =====================================================
   Process Error
===================================================== */

process.on(
  'unhandledRejection',
  error => {

    console.error(
      '❌ Unhandled Rejection:',
      error
    );
  }
);

process.on(
  'uncaughtException',
  error => {

    console.error(
      '❌ Uncaught Exception:',
      error
    );
  }
);

/* =====================================================
   LOGIN
===================================================== */

client
  .login(TOKEN)
  .then(() => {

    console.log(
      '🔐 Discord 로그인 요청 완료'
    );

  })
  .catch(error => {

    console.error(
      '❌ Discord 로그인 실패:',
      error
    );

    process.exit(1);
  });
