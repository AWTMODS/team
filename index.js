require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

const bot = new Telegraf('8172383815:AAG37FSq_wkyxb6qhNPpD4-SDG5XhmvOsIg'); // Securely load bot token from .env
const adminId = 1626509050; // Replace with your Telegram ID
const adminGroupId = -1002471429799; // Replace with your admin group ID (supergroup)

const usersFile = 'users.json';
let users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];

const premiumUsersFile = 'premiumUsers.json';
let premiumUsers = fs.existsSync(premiumUsersFile) ? JSON.parse(fs.readFileSync(premiumUsersFile)) : [];

// Track daily video requests for each user
const dailyVideoRequestsFile = 'dailyVideoRequests.json';
let dailyVideoRequests = fs.existsSync(dailyVideoRequestsFile) ? JSON.parse(fs.readFileSync(dailyVideoRequestsFile)) : {};

// Function to save users
const saveUsers = () => fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

// Function to save premium users
const savePremiumUsers = () => fs.writeFileSync(premiumUsersFile, JSON.stringify(premiumUsers, null, 2));

// Function to save daily video requests
const saveDailyVideoRequests = () => fs.writeFileSync(dailyVideoRequestsFile, JSON.stringify(dailyVideoRequests, null, 2));

// Reset daily video requests at midnight
const resetDailyVideoRequests = () => {
    dailyVideoRequests = {};
    saveDailyVideoRequests();
};

// Schedule reset at midnight
const rule = new schedule.RecurrenceRule();
rule.hour = 0;
rule.minute = 0;
rule.second = 0;
schedule.scheduleJob(rule, resetDailyVideoRequests);

// **Command: Register users with /start**
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (!users.includes(userId)) {
        users.push(userId);
        saveUsers();
    }
    ctx.reply('✅ Welcome! Our bot is working', Markup.inlineKeyboard([
        Markup.button.callback('Get Videos', 'get_videos'),
        Markup.button.callback('Purchase Premium', 'purchase_premium') // Add "Purchase Premium" button
    ]));
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
        ctx.reply('✅ You are a premium subscriber.');
    } else {
        ctx.reply('❌ You are not a premium subscriber. Subscribe to access premium features.');
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

        ctx.reply(`✅ Video received and stored. File ID: ${fileId}`);
    } catch (error) {
        ctx.reply("❌ Failed to save video.");
    }
});

// **Handle Inline Button Callback**
bot.action('get_videos', async (ctx) => {
    const userId = ctx.from.id;

    // Check if user is premium
    if (premiumUsers.includes(userId)) {
        // Premium users get unlimited videos
        if (videosList.length === 0) {
            return ctx.reply('📂 No videos available.');
        }

        for (const video of videosList) {
            if (!video.fileId) {
                console.error(`Invalid fileId for video: ${video.fileName}`);
                continue;
            }
            try {
                await ctx.replyWithVideo(video.fileId, { caption: `🎬 ${video.fileName}` });
            } catch (error) {
                console.error(`Failed to send video ${video.fileName}:`, error);
            }
        }
        return;
    }

    // Non-premium users have a daily limit
    if (!dailyVideoRequests[userId]) {
        dailyVideoRequests[userId] = 0;
    }

    if (dailyVideoRequests[userId] >= 5) {
        return ctx.reply('❌ You have reached your daily limit of 5 videos. Upgrade to premium for unlimited access.', Markup.inlineKeyboard([
            Markup.button.callback('Upgrade to Premium', 'upgrade_to_premium')
        ]));
    }

    // Send videos up to the limit
    const videosToSend = videosList.slice(0, 5 - dailyVideoRequests[userId]);
    if (videosToSend.length === 0) {
        return ctx.reply('📂 No videos available.');
    }

    for (const video of videosToSend) {
        if (!video.fileId) {
            console.error(`Invalid fileId for video: ${video.fileName}`);
            continue;
        }
        try {
            await ctx.replyWithVideo(video.fileId, { caption: `🎬 ${video.fileName}` });
        } catch (error) {
            console.error(`Failed to send video ${video.fileName}:`, error);
        }
    }

    // Update daily video requests
    dailyVideoRequests[userId] += videosToSend.length;
    saveDailyVideoRequests();

    if (dailyVideoRequests[userId] >= 5) {
        ctx.reply('⚠️ You have reached your daily limit of 5 videos. Upgrade to premium for unlimited access.', Markup.inlineKeyboard([
            Markup.button.callback('Upgrade to Premium', 'upgrade_to_premium')
        ]));
    }
});

// Handle "Purchase Premium" button
bot.action('purchase_premium', async (ctx) => {
    const userId = ctx.from.id;

    console.log(`[INFO] User ${userId} clicked "Purchase Premium"`);

    // Send QR code image from server
    await ctx.replyWithPhoto({ source: './qr_code.jpg' }, {
        caption: 'Please send the payment proof after completing the payment.',
    });

    const paymentProofHandler = async (ctx) => {
        try {
            if (ctx.from.id === userId && ctx.message.photo) {
                const proof = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                console.log('[INFO] Payment proof file ID:', proof);

                const user = ctx.from;
                const adminMessage = `💳 *Payment Proof Received*\n👤 *Name:* ${user.first_name}\n🆔 *User ID:* ${user.id}\n👥 *Username:* @${user.username || 'N/A'}\n🔗 [Open Profile](https://t.me/${user.username || user.id})`;

                await bot.telegram.sendPhoto(adminGroupId, proof, {
                    caption: adminMessage,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[{ text: 'Verify', callback_data: `verify_${userId}` }]],
                    },
                });

                console.log('[SUCCESS] Payment proof sent to admin group');
                await ctx.reply('Payment proof received. Admins will verify it shortly.');

                bot.off('message', paymentProofHandler);
            }
        } catch (err) {
            console.error('[ERROR] Failed to process payment proof:', err);
            await ctx.reply('There was an error processing your payment proof. Please try again later.');
        }
    };

    bot.on('message', paymentProofHandler);

    setTimeout(() => {
        console.log('[INFO] Payment proof listener timed out');
        bot.off('message', paymentProofHandler);
        ctx.reply('Payment proof submission timed out. Please try again if needed.');
    }, 300000); // 5 minutes timeout
});

// Handle "Verify" button in admin group
bot.action(/verify_(\d+)/, async (ctx) => {
    const userId = parseInt(ctx.match[1], 10);
    const user = users.find((u) => u.id === userId);

    if (user) {
        user.premium = true;
        saveUsers();

        await ctx.reply('Payment verified. User is now premium.');
        await bot.telegram.sendMessage(userId, 'Thank you for purchasing premium!');
    } else {
        await ctx.reply('User not found in the database.');
    }
});

// **Start bot**
bot.launch();
console.log('🚀 Bot is running...');

// **Graceful shutdown**
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
