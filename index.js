//broadcast feature
// Import required modules
const { Telegraf } = require('telegraf');
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
      bot.telegram.sendMessage(userId, `${message}\n\n📌 Your ID: ${userId}`)
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
        ]).then(() => success++).catch(() => failed++);
      });
      return ctx.reply(`Broadcasting ${type}: Sending to ${users.length} users.`);
    }
  }
});




// Directory to save videos
const videoDir = path.join(__dirname, 'videos');
if (!fs.existsSync(videoDir)) {
  fs.mkdirSync(videoDir);
}

// Load existing videos from videos.js if it exists
let videosList = [];
const videosFilePath = path.join(__dirname, 'videos.js');
if (fs.existsSync(videosFilePath)) {
  try {
    videosList = require(videosFilePath).videos;
  } catch (err) {
    console.error("Error loading videos.js:", err);
  }
}

// Function to update the videos.js file
function updateVideosFile() {
  const fileContent = module.exports = {\n  videos: ${JSON.stringify(videosList, null, 2)}\n};\n;
  fs.writeFileSync(videosFilePath, fileContent);
}

// Listen for any message
bot.on('message', async (msg) => {
  // Allow only the admin to upload videos
  if (msg.from.id !== adminId) {
    return;
  }

  let fileId;
  let fileName;

  // Check if the message contains a video or a document with a video MIME type
  if (msg.video) {
    fileId = msg.video.file_id;
    // Use the file_name if provided or generate a default name
    fileName = msg.video.file_name || video_${Date.now()}.mp4;
  } else if (msg.document) {
    if (msg.document.mime_type && msg.document.mime_type.startsWith('video/')) {
      fileId = msg.document.file_id;
      fileName = msg.document.file_name || video_${Date.now()};
    } else {
      bot.sendMessage(adminId, "The document is not recognized as a video.");
      return;
    }
  } else {
    return; // Not a video or valid document
  }

  try {
    // Download the file to the videoDir folder (bot.downloadFile returns the local path)
    const tempFilePath = await bot.downloadFile(fileId, videoDir);
    
    // Define the final destination path using the provided or generated fileName
    const newFilePath = path.join(videoDir, fileName);
    fs.renameSync(tempFilePath, newFilePath);

    // Store video details in the list
    videosList.push({
      fileName,
      filePath: newFilePath,
      uploadedAt: new Date()
    });
    updateVideosFile();

    bot.sendMessage(adminId, `Video uploaded and saved as ${fileName}`);
  } catch (error) {
    console.error("Error downloading or saving file:", error);
    bot.sendMessage(adminId, "Failed to upload video.");
  }
});
// Start the bot
bot.launch();

console.log('Bot is running...');

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
