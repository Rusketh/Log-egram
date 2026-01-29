const TelegramBot = require('node-telegram-bot-api');

const crypto = require('node:crypto');

const CONFIG = require('./config');

/********************************************************************
 * Initialize Telegram Bot
 ********************************************************************/

const bot = new TelegramBot(CONFIG.telegram.token, { polling: true });

bot.getMe().then((me) => {
    console.log(`Bot started as ${me.username}`);
    bot.id = me.id;
    bot.username = me.username;
});

/********************************************************************
 * Admin Check
 ********************************************************************/

const isAdmin = async (group, user) => {
    const admins = await bot.getChatAdministrators(group.group_id || group.id);
    return admins.some((admin) => admin.user.id === user.user_id || user.id);
};

/********************************************************************
 * Commands
 ********************************************************************/

const Commands = {};

const registerCommand = (cmd, fn) => {
    Commands[cmd] = fn;
};

bot.on('message', async (message) => {
    if (!message.text || !message.text.startsWith('/'))
        return;

    if (message.chat.type !== 'private' && message.chat?.id)
        message.from.isAdmin = await isAdmin(message.chat, message.from);

    const args = message.text.toLowerCase().split(" ");
    const cmd = args.shift().substring(1);
    const fn = Commands[cmd];

    if (!fn)
        return;

    try {
        await fn(message, ...args);
    }
    catch (e) {
        console.error(`Error executing command ${cmd}:`);
        console.error(e);

        if (bot.chat?.id)
            bot.sendMessage(message.chat.id, "An error occurred while executing the command.");
    }
});

/********************************************************************
 * Callbacks
 ********************************************************************/

const Callbacks = {};

const registerCallback = (cmd, fn) => {
    Callbacks[cmd] = fn;
};

bot.on('callback_query', async (query) => {
    if (!query.data)
        return;

    if (query.message?.chat?.type !== 'private' && query.message?.chat?.id)
        query.from.isAdmin = await isAdmin(query.message.chat, query.from);

    const data = JSON.parse(query.data);

    try {
        const fn1 = Callbacks[data.cmd];
        if (fn1) return await fn1(query, data.data);
    }
    catch (e) {
        if (query.id)
            bot.answerCallbackQuery(query.id, { text: "An error occurred while executing the callback." });
        console.error(`Error executing callback ${cmd}:`);
        console.error(e);
    }
});

/********************************************************************
 * Utils
 ********************************************************************/

const Respond = (query, message, text) => {
    if (!query)
        return bot.sendMessage(message.chat.id, text);

    return bot.answerCallbackQuery(query.id, { text });
};


/********************************************************************
 * Utils
 ********************************************************************/



/********************************************************************
 * Exports
 ********************************************************************/

module.exports = {
    bot,
    isAdmin,
    registerCommand,
    registerCallback,
    Respond
};