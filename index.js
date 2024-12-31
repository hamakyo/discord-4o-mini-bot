require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,  // これが特に重要
  ],
});

// 4o-mini APIへのリクエスト関数
async function get4oMiniResponse(message) {
  try {
    const response = await axios.post('https://api.4o-mini.com/v1/chat', {  // 正しいエンドポイントURL
      message: message,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.API_KEY}`,
        'Content-Type': 'application/json',
      }
    });
    return response.data.response;
  } catch (error) {
    console.error('API Error:', error);
    return 'すみません、APIとの通信中にエラーが発生しました。';
  }
}

// Botが起動したときのイベント
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// メッセージを受信したときのイベント
client.on('messageCreate', async (message) => {
  // Botのメッセージは無視
  if (message.author.bot) return;

  // メンションされた場合のみ応答
  if (message.mentions.has(client.user)) {
    try {
      // タイピングインジケータを表示
      await message.channel.sendTyping();

      // メンションを除去してメッセージ本文を取得
      const content = message.content.replace(/<@!\d+>/g, '').trim();
      
      // 4o-mini APIからの応答を取得
      const response = await get4oMiniResponse(content);
      
      // 応答を送信
      await message.reply(response);
    } catch (error) {
      console.error('Error:', error);
      await message.reply('エラーが発生しました。しばらく待ってからお試しください。');
    }
  }
});

// エラーハンドリング
client.on('error', error => {
  console.error('Discord client error:', error);
});

// Botを起動
client.login(process.env.DISCORD_TOKEN);