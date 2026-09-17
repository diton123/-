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
  console.error('❌ DISCORD_TOKEN이 없습니다.');
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error('❌ CLIENT_ID가 없습니다.');
  process.exit(1);
}

const commands = [];
const root = __dirname;

const files = fs
  .readdirSync(root)
  .filter(file =>
    file.endsWith('.js') &&
    file !== 'index.js' &&
    file !== 'deploy-commands.js'
  );

for (const file of files) {
  try {
    const fullPath = path.join(root, file);
    const command = require(fullPath);

    if (
      command &&
      command.data &&
      typeof command.execute === 'function'
    ) {
      commands.push(
        command.data.toJSON()
      );

      console.log(
        `✅ 등록 준비: /${command.data.name}`
      );
    }

  } catch (err) {
    console.log(
      `⚠️ ${file} 건너뜀: ${err.message}`
    );
  }
}

console.log('');
console.log(
  `📦 총 ${commands.length}개의 슬래시 명령어 발견`
);

const rest = new REST({
  version: '10',
}).setToken(DISCORD_TOKEN);

(async () => {
  try {
    if (GUILD_ID) {
      console.log(
        `🚀 서버 명령어 등록 중: ${GUILD_ID}`
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

      console.log('✅ 서버 명령어 등록 완료');
    } else {
      console.log(
        '🌍 전역 명령어 등록 중...'
      );

      await rest.put(
        Routes.applicationCommands(
          CLIENT_ID
        ),
        {
          body: commands,
        }
      );

      console.log('✅ 전역 명령어 등록 완료');
    }

  } catch (err) {
    console.error(
      '❌ 명령어 등록 실패:',
      err
    );

    process.exit(1);
  }
})();
