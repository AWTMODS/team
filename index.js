require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const bot = new Telegraf('8172383815:AAG37FSq_wkyxb6qhNPpD4-SDG5XhmvOsIg'); // Securely load bot token from .env
const adminId = 1626509050; // Replace with your Telegram ID

const usersFile = 'users.json';
let users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];

// Function to save users
const saveUsers = () => fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

// **Command: Register users with /start**
bot.start((ctx) => {
    const userId = ctx.from.id;
    if (!users.includes(userId)) {
        users.push(userId);
        saveUsers();
    }
    ctx.reply(`✅ Welcome! our bot is working`);
});

// **Command: Broadcast message or media**
bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== adminId) {
        return ctx.reply('Unauthorized!');
    }

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

// **Ensure video directory exists**
const videoDir = path.join(__dirname, 'videos');
if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir);
}

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

// **Function to download and save files**
async function downloadFile(fileId, savePath) {
    try {
        const fileUrl = (await bot.telegram.getFileLink(fileId)).href; // Correctly get file URL
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream',
        });

        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(savePath);
            response.data.pipe(writer);

            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        console.error("Error downloading file:", error);
        throw new Error("File download failed.");
    }
}

// **Handle Video Uploads**
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
        const newFilePath = path.join(videoDir, fileName);
        await downloadFile(fileId, newFilePath); // Correctly download file

        videosList.push({ fileName, filePath: newFilePath, uploadedAt: new Date().toISOString() });
        updateVideosFile();

        ctx.reply(`✅ Video uploaded and saved as ${fileName}.`);
    } catch (error) {
        ctx.reply("❌ Failed to upload video.");
    }
});

// **Start bot**
bot.launch();
console.log('🚀 Bot is running...');

// **Graceful shutdown**
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
