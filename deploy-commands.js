// deploy-commands.js
// Discord 슬래시 명령어 등록기
// commands/ 폴더 + 저장소 루트의 슬래시 명령어를 모두 검색합니다.

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  REST,
  Routes,
} = require('discord.js');

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
} = process.env;

if (!DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN 환경변수가 없습니다.');
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error('❌ CLIENT_ID 환경변수가 없습니다.');
  process.exit(1);
}

const commands = [];
const commandNames = new Set();

function loadCommand(filePath) {
  try {
    delete require.cache[require.resolve(filePath)];

    const command = require(filePath);

    if (
      !command ||
      !command.data ||
      typeof command.data.toJSON !== 'function'
    ) {
      return;
    }

    const json = command.data.toJSON();

    if (!json.name) return;

    // 같은 명령어가 중복 등록되는 것을 방지
    if (commandNames.has(json.name)) {
      console.log(`⚠️ 중복 명령어 무시: /${json.name}`);
      return;
    }

    commandNames.add(json.name);
    commands.push(json);

    console.log(`✅ 발견: /${json.name}`);
  } catch (err) {
    console.error(
      `❌ 명령어 파일 로드 실패: ${filePath}`,
      err
    );
  }
}

// =====================================
// 1. commands/ 폴더 검색
// =====================================

const commandsPath = path.join(
  __dirname,
  'commands'
);

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    loadCommand(
      path.join(commandsPath, file)
    );
  }
}

// =====================================
// 2. 저장소 루트 검색
// =====================================

const rootFiles = fs
  .readdirSync(__dirname)
  .filter(file =>
    file.endsWith('.js') &&
    file !== 'index.js' &&
    file !== 'deploy-commands.js'
  );

for (const file of rootFiles) {
  loadCommand(
    path.join(__dirname, file)
  );
}

// =====================================
// 등록
// =====================================

console.log('');
console.log(
  `📦 총 ${commands.length}개의 슬래시 명령어를 찾았습니다.`
);

if (commands.length === 0) {
  console.warn(
    '⚠️ 등록할 슬래시 명령어가 없습니다.'
  );
}

const rest = new REST({
  version: '10',
}).setToken(DISCORD_TOKEN);

(async () => {
  try {
    if (GUILD_ID) {
      console.log(
        `🔄 서버 전용 명령어 등록 중: ${GUILD_ID}`
      );

      await rest.put(
        Routes.applicationGuildCommands(
          CLIENT_ID,
          GUILD_ID
        ),
        {
          body: commands,
        }
      );

      console.log(
        `✅ ${commands.length}개의 명령어를 서버에 등록했습니다.`
      );
      console.log(
        '⚡ 서버 전용 명령어이므로 즉시 반영됩니다.'
      );

    } else {
      console.log(
        '🔄 전역 슬래시 명령어 등록 중...'
      );

      await rest.put(
        Routes.applicationCommands(
          CLIENT_ID
        ),
        {
          body: commands,
        }
      );

      console.log(
        `✅ ${commands.length}개의 명령어를 전역 등록했습니다.`
      );

      console.log(
        'ℹ️ 전역 명령어는 Discord 반영까지 시간이 걸릴 수 있습니다.'
      );
    }

  } catch (err) {
    console.error(
      '❌ Discord 슬래시 명령어 등록 실패:',
      err
    );

    process.exit(1);
  }
})();
