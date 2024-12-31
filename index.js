require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

// チャンネルごとの会話履歴を保存するためのMap
const conversationHistory = new Map();

// 会話履歴の制限（トークン数節約のため）
const MAX_HISTORY_LENGTH = 10;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// 会話履歴を管理する関数
function manageConversationHistory(channelId, userMessage, botResponse) {
  if (!conversationHistory.has(channelId)) {
    conversationHistory.set(channelId, []);
  }

  const history = conversationHistory.get(channelId);
  
  // 新しいメッセージを追加
  history.push(
    { role: "user", content: userMessage },
    { role: "assistant", content: botResponse }
  );

  // 履歴が長すぎる場合、古いメッセージを削除
  while (history.length > MAX_HISTORY_LENGTH) {
    history.shift();
  }

  conversationHistory.set(channelId, history);
}

// 4o-mini APIへのリクエスト関数
async function get4oMiniResponse(channelId, message) {
  try {
    // 現在のチャンネルの会話履歴を取得
    const history = conversationHistory.get(channelId) || [];
    
    // APIリクエストの準備
    const messages = [
      // システムメッセージを追加（オプション）
      { role: "system", content: "あなたは親切で役立つAIアシスタントです。" },
      // 過去の会話履歴を追加
      ...history,
      // 新しいユーザーメッセージを追加
      { role: "user", content: message }
    ];

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4o-mini",
      messages: messages
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const botResponse = response.data.choices[0].message.content;
    
    // 会話履歴を更新
    manageConversationHistory(channelId, message, botResponse);
    
    return botResponse;
  } catch (error) {
    console.error('API Error:', error.response?.data);
    console.error('Status:', error.response?.status);
    console.error('Headers:', error.response?.headers);
    return 'すみません、APIとの通信中にエラーが発生しました。';
  }
}

// 会話履歴をリセットするコマンド
async function resetConversation(channelId) {
  conversationHistory.delete(channelId);
  return "会話履歴をリセットしました。";
}

// Botが起動したときのイベント
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// 最後に処理したメッセージIDを保存
const processedMessages = new Set();

// メッセージを受信したときのイベント
client.on('messageCreate', async (message) => {
  // Botのメッセージは無視
  if (message.author.bot) return;

  // 直接のメンションのみに反応するように修正
  if (!message.mentions.users.first()) return;
  if (message.mentions.users.first().id !== client.user.id) return;

  // 既に処理済みのメッセージは無視
  if (processedMessages.has(message.id)) return;
  processedMessages.add(message.id);

  // 古いメッセージIDを削除（メモリ管理）
  if (processedMessages.size > 100) {
    const oldestId = processedMessages.values().next().value;
    processedMessages.delete(oldestId);
  }

  try {
    await message.channel.sendTyping();
    const content = message.content
      .replace(/<@!?\d+>/g, '')
      .trim();
    
    if (!content) return;

    if (content.toLowerCase() === 'reset' || content.toLowerCase() === 'リセット') {
      const response = await resetConversation(message.channelId);
      await message.reply(response);
      return;
    }

    const response = await get4oMiniResponse(message.channelId, content);
    await message.reply(response);
  } catch (error) {
    console.error('Error:', error);
    await message.reply('エラーが発生しました。しばらく待ってからお試しください。');
  }
});

// エラーハンドリング
client.on('error', error => {
  console.error('Discord client error:', error);
});

// Botを起動
client.login(process.env.DISCORD_TOKEN);