//broadcast feature
// Import required modules
const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf('YOUR_BOT_API_TOKEN');

// Store user IDs
const usersFile = 'users.json';

// Load existing users or initialize empty array
let users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];

// Save users to JSON
const saveUsers = () => fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

// Capture new users
bot.start((ctx) => {
  if (!users.includes(ctx.chat.id)) {
    users.push(ctx.chat.id);
    saveUsers();
  }
  ctx.reply('Welcome! You are now subscribed to broadcasts.');
});

// Admin command to broadcast a message
bot.command('broadcast', (ctx) => {
  const adminId = YOUR_ADMIN_USER_ID; // Replace with your Telegram ID

  if (ctx.chat.id !== adminId) {
    return ctx.reply('Unauthorized!');
  }

  const message = ctx.message.text.split(' ').slice(1).join(' ');

  if (!message) return ctx.reply('Usage: /broadcast Your message here');

  let success = 0, failed = 0;

  users.forEach((userId) => {
    bot.telegram.sendMessage(userId, message)
      .then(() => success++)
      .catch(() => failed++);
  });

  ctx.reply(`Broadcast started: Sending to ${users.length} users.`);
});

// Start the bot
bot.launch();

console.log('Bot is running...');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

