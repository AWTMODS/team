require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');
const QRCode = require('qrcode'); // Add this package to generate QR codes

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN);
const adminId = parseInt(process.env.ADMIN_ID);
const adminGroupId = parseInt(process.env.ADMIN_GROUP_ID);

// File paths
const usersFile = 'users.json';
const premiumUsersFile = 'premiumUsers.json';
const dailyVideoRequestsFile = 'dailyVideoRequests.json';
const videosFilePath = path.join(__dirname, 'videos.json');

// Helper functions to load/save data
const loadData = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
const saveData = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Data storage
let users = loadData(usersFile);
let premiumUsers = loadData(premiumUsersFile);
let dailyVideoRequests = loadData(dailyVideoRequestsFile);
let videosList = loadData(videosFilePath);

// Reset daily video requests at midnight
schedule.scheduleJob('0 0 * * *', () => {
    dailyVideoRequests = {};
    saveData(dailyVideoRequestsFile, dailyVideoRequests);
});

// Start command
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (!users.includes(userId)) {
        users.push(userId);
        saveData(usersFile, users);
    }
    ctx.reply('✅ Welcome! Our bot is working', Markup.inlineKeyboard([
        Markup.button.callback('Get Videos', 'get_videos'),
        Markup.button.callback('Purchase Premium', 'purchase_premium')
    ]));
});

// Admin check utility
const isAdmin = (id) => id === adminId;

// Add Premium User
bot.command('addpremium', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('❌ Unauthorized!');

    const userId = parseInt(ctx.message.text.split(' ')[1]);
    if (!userId || !users.includes(userId)) return ctx.reply('❌ Invalid user ID!');

    if (!premiumUsers.includes(userId)) {
        premiumUsers.push(userId);
        saveData(premiumUsersFile, premiumUsers);
        ctx.reply(`✅ User ${userId} is now a premium subscriber.`);
    } else {
        ctx.reply(`⚠️ User ${userId} is already a premium subscriber.`);
    }
});

// Remove Premium User
bot.command('removepremium', (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('❌ Unauthorized!');

    const userId = parseInt(ctx.message.text.split(' ')[1]);
    if (!userId || !premiumUsers.includes(userId)) return ctx.reply('❌ User not found!');

    premiumUsers = premiumUsers.filter(id => id !== userId);
    saveData(premiumUsersFile, premiumUsers);
    ctx.reply(`✅ User ${userId} is no longer a premium subscriber.`);
});

// Check Premium Status
bot.command('checkpremium', (ctx) => {
    const userId = ctx.from.id;
    ctx.reply(premiumUsers.includes(userId) ? '✅ You are a premium subscriber.' : '❌ You are not a premium subscriber.');
});

// Broadcast Message
bot.command('broadcast', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.reply('❌ Unauthorized!');

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

// Handle Video Uploads
bot.on('message', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    let fileId, fileName;
    if (ctx.message.video) {
        fileId = ctx.message.video.file_id;
        fileName = ctx.message.video.file_name || `video_${Date.now()}.mp4`;
    } else if (ctx.message.document && ctx.message.document.mime_type.startsWith('video/')) {
        fileId = ctx.message.document.file_id;
        fileName = ctx.message.document.file_name || `video_${Date.now()}`;
    } else {
        return;
    }

    videosList.push({ fileName, fileId, uploadedAt: new Date().toISOString() });
    saveData(videosFilePath, videosList);

    ctx.reply(`✅ Video saved. File ID: ${fileId}`);
});

// Get Videos
bot.action('get_videos', async (ctx) => {
    const userId = ctx.from.id;
    const isPremium = premiumUsers.includes(userId);

    const userRequests = dailyVideoRequests[userId] || 0;
    if (!isPremium && userRequests >= 5) {
        return ctx.reply('❌ Daily limit reached. Upgrade to premium.', Markup.inlineKeyboard([
            Markup.button.callback('Upgrade to Premium', 'purchase_premium')
        ]));
    }

    const videosToSend = isPremium ? videosList : videosList.slice(0, 5 - userRequests);
    for (const video of videosToSend) {
        await ctx.replyWithVideo(video.fileId, { caption: `🎬 ${video.fileName}` });
    }

    dailyVideoRequests[userId] = (dailyVideoRequests[userId] || 0) + videosToSend.length;
    saveData(dailyVideoRequestsFile, dailyVideoRequests);
});

// Handle Purchase Premium Button
bot.action('purchase_premium', async (ctx) => {
    const userId = ctx.from.id;

    // Generate a QR code (for example, a payment link)
    const paymentLink = 'https://your-payment-link.com'; // Replace with your actual payment link
    const qrCodePath = path.join(__dirname, 'qr.png');

    QRCode.toFile(qrCodePath, paymentLink, { type: 'png' }, async (err) => {
        if (err) {
            console.error('Error generating QR code:', err);
            return ctx.reply('❌ Failed to generate QR code. Please try again later.');
        }

        // Send the QR code to the user
        await ctx.replyWithPhoto({ source: qrCodePath }, { caption: 'Scan this QR code to complete your premium purchase.' });
    });
});

// Start bot
bot.launch();
console.log('🚀 Bot is running...');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
