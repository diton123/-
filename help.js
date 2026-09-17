// events/help.js

const {
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const content = message.content.trim();

    if (
      content !== '!도움말' &&
      content !== '!명령어'
    ) {
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📖 디톤 관리봇 도움말')
      .setDescription(
        '디톤 관리봇에서 사용할 수 있는 명령어입니다.'
      )
      .addFields(
        {
          name: '🤖 기본',
          value: [
            '`!봇상태` — 봇 상태 및 핑 확인',
            '`!핑` — 봇 핑 확인',
            '`!서버정보` — 서버 정보 확인',
            '`!유저정보 @유저` — 유저 정보 확인',
          ].join('\n'),
        },

        {
          name: '🛡️ 관리',
          value: [
            '`!청소 <개수>` — 메시지 삭제',
            '`!킥 @유저 [사유]` — 유저 추방',
            '`!밴 @유저 [사유]` — 유저 차단',
            '`!뮤트 @유저 <분>` — 유저 타임아웃',
            '`!경고 @유저 [사유]` — 경고 추가',
            '`!경고조회 @유저` — 경고 확인',
          ].join('\n'),
        },

        {
          name: '🔐 보안',
          value: [
            '`!화리추가 @유저` — 화이트리스트 추가',
            '`!화리제거 @유저` — 화이트리스트 제거',
            '`!로그` — 관리 로그 확인',
          ].join('\n'),
        },

        {
          name: '👑 오너 / 관리자',
          value: [
            '`!리스트` — 오너/관리자 목록',
            '`!오너등록` — 오너 등록',
            '`!관리자등록` — 관리자 라이선스 등록',
            '`!관리자발급 @유저` — 관리자 라이선스 발급',
            '`!관리자제거 @유저` — 관리자 제거',
            '`!설정패널` — 관리자 권한 설정',
          ].join('\n'),
        },

        {
          name: '🎙️ 음성',
          value: [
            '`!음성랭킹` — 음성 활동 랭킹',
            '`!음성로그` — 음성 입장/퇴장 로그',
            '`!음성랭크채팅` — 음성 랭킹 채널 설정',
          ].join('\n'),
        },

        {
          name: '🎫 라이선스',
          value: [
            '관리자 라이선스는 `diton_` + 6자리 숫자 형식입니다.',
            '라이선스 등록은 DM 버튼을 통해 진행됩니다.',
          ].join('\n'),
        }
      )
      .setFooter({
        text: '디톤 관리봇 • !도움말 / !명령어',
      })
      .setTimestamp();

    await message.reply({
      embeds: [embed],
    });
  },
};
