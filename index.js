//broadcast feature
// Import required modules
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf('8172383815:AAG37FSq_wkyxb6qhNPpD4-SDG5XhmvOsIg');

// Store user IDs
const usersFile = 'users.json';

// Load existing users or initialize empty array
let users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];

// Save users to JSON
const saveUsers = () => fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

// Admin command to broadcast a message or media
bot.command('broadcast', async (ctx) => {
  const adminId = 1626509050; // Replace with your Telegram ID

  if (ctx.chat.id !== adminId) {
    return ctx.reply('Unauthorized!');
  }

  if (ctx.message.text) {
    const message = ctx.message.text.split(' ').slice(1).join(' ');

    if (!message) return ctx.reply('Usage: /broadcast Your message here');

    let success = 0, failed = 0;

    users.forEach((userId) => {
      bot.telegram.sendMessage(userId, `${message}\n\n📌 Your ID: ${userId}`, Markup.inlineKeyboard([
        Markup.button.callback('🎥 Get Videos', 'get_videos')
      ]))
        .then(() => success++)
        .catch(() => failed++);
    });

    ctx.reply(`Broadcast started: Sending to ${users.length} users.`);
  }

  // Broadcast media (photo, video, document, audio)
  const mediaType = ['photo', 'video', 'document', 'audio'];

  for (const type of mediaType) {
    if (ctx.message[type]) {
      let success = 0, failed = 0;
      users.forEach((userId) => {
        bot.telegram.sendChatAction(userId, 'upload_document');
        bot.telegram.sendMediaGroup(userId, [
          {
            type: type,
            media: ctx.message[type][0].file_id,
            caption: `${ctx.message.caption || ''}\n\n📌 Your ID: ${userId}`
          }
        ]).then(() => {
          bot.telegram.sendMessage(userId, '🎥 Get Videos', Markup.inlineKeyboard([
            Markup.button.callback('🎥 Get Videos', 'get_videos')
          ]));
          success++;
        }).catch(() => failed++);
      });
      return ctx.reply(`Broadcasting ${type}: Sending to ${users.length} users.`);
    }
  }
});

// Handle video button click
bot.action('get_videos', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('🎥 Here is the video list (Feature coming soon!)');
});

// Start the bot
bot.launch();

console.log('Bot is running...');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
