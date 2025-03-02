require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf('8172383815:AAG37FSq_wkyxb6qhNPpD4-SDG5XhmvOsIg'); // Securely load bot token from .env
const adminId = 1626509050; // Replace with your Telegram ID

const usersFile = 'users.json';
let users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];

const premiumUsersFile = 'premiumUsers.json';
let premiumUsers = fs.existsSync(premiumUsersFile) ? JSON.parse(fs.readFileSync(premiumUsersFile)) : [];

// Function to save users
const saveUsers = () => fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

// Function to save premium users
const savePremiumUsers = () => fs.writeFileSync(premiumUsersFile, JSON.stringify(premiumUsers, null, 2));

// **Command: Register users with /start**
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (!users.includes(userId)) {
        users.push(userId);
        saveUsers();
    }
    ctx.reply(`✅ Welcome! Our bot is working`);
});

// **Command: Add Premium User**
bot.command('addpremium', (ctx) => {
    if (ctx.from.id !== adminId) return ctx.reply('❌ Unauthorized!');

    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('Usage: /addpremium <user_id>');

    const userId = parseInt(args[1]);
    if (!users.includes(userId)) return ctx.reply('❌ User not found!');

    if (!premiumUsers.includes(userId)) {
        premiumUsers.push(userId);
        savePremiumUsers();
        ctx.reply(`✅ User ${userId} has been added as a premium subscriber.`);
    } else {
        ctx.reply(`⚠️ User ${userId} is already a premium subscriber.`);
    }
});

// **Command: Remove Premium User**
bot.command('removepremium', (ctx) => {
    if (ctx.from.id !== adminId) return ctx.reply('❌ Unauthorized!');

    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('Usage: /removepremium <user_id>');

    const userId = parseInt(args[1]);
    if (!premiumUsers.includes(userId)) return ctx.reply('❌ User is not a premium subscriber.');

    premiumUsers = premiumUsers.filter(id => id !== userId);
    savePremiumUsers();
    ctx.reply(`✅ User ${userId} has been removed from premium subscription.`);
});

// **Command: Check Premium Status**
bot.command('checkpremium', (ctx) => {
    const userId = ctx.from.id;
    if (premiumUsers.includes(userId)) {
        ctx.reply(`✅ You are a premium subscriber.`);
    } else {
        ctx.reply(`❌ You are not a premium subscriber. Subscribe to access premium features.`);
    }
});

// **Command: Broadcast message or media**
bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== adminId) return ctx.reply('Unauthorized!');

    const message = ctx.message.text.split(' ').slice(1).join(' ');
    if (!message) return ctx.reply('Usage: /broadcast Your message here');

    let success = 0, failed = 0;

    for (const userId of users) {
        try {
            await bot.telegram.sendMessage(userId, `${message}\n\n📌 Your ID: ${userId}`);
            success++;
        } catch (error) {
            failed++;
        }
    }

    ctx.reply(`✅ Broadcast completed: Sent to ${success} users, Failed: ${failed}.`);
});

// **Load videos list**
let videosList = [];
const videosFilePath = path.join(__dirname, 'videos.json');
if (fs.existsSync(videosFilePath)) {
    try {
        videosList = JSON.parse(fs.readFileSync(videosFilePath));
    } catch (err) {
        console.error("Error loading videos.json:", err);
    }
}

// **Function to update videos.json**
const updateVideosFile = () => {
    fs.writeFileSync(videosFilePath, JSON.stringify(videosList, null, 2));
};

// **Handle Video Uploads (Stores Only File ID)**
bot.on('message', async (ctx) => {
    if (ctx.from.id !== adminId) return; // Only admin can upload videos

    let fileId, fileName;
    if (ctx.message.video) {
        fileId = ctx.message.video.file_id;
        fileName = ctx.message.video.file_name || `video_${Date.now()}.mp4`;
    } else if (ctx.message.document && ctx.message.document.mime_type.startsWith('video/')) {
        fileId = ctx.message.document.file_id;
        fileName = ctx.message.document.file_name || `video_${Date.now()}`;
    } else {
        return; // Not a video, ignore
    }

    try {
        videosList.push({ fileName, fileId, uploadedAt: new Date().toISOString() });
        updateVideosFile();

        ctx.reply(`✅ Video received and stored. File ID: \`${fileId}\``);
    } catch (error) {
        ctx.reply("❌ Failed to save video.");
    }
});

// **Command: Get Premium Videos**
bot.command('getvideos', (ctx) => {
    const userId = ctx.from.id;
    if (!premiumUsers.includes(userId)) {
        return ctx.reply('❌ You must be a premium subscriber to access videos.');
    }

    if (videosList.length === 0) {
        return ctx.reply('📂 No videos available.');
    }

    for (const video of videosList) {
        bot.telegram.sendVideo(userId, video.fileId, { caption: `🎬 ${video.fileName}` });
    }
});

// **Start bot**
bot.launch();
console.log('🚀 Bot is running...');

// **Graceful shutdown**
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
