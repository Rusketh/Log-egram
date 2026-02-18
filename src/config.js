const assert = require("node:assert");
const fs = require("node:fs");


/*********************************************************************************
 * Create default CONFIG
 */

CONFIG = {
    telegram:
    {
        token: "",
        api_id: "",
        api_hash: ""
    },
    server:
    {
        url: "",
        port: ""
    },
    signin:
    {
        with_telegram: true,
        with_link: true
    },
    retention:
    {
        days: 90
    }
};

/*********************************************************************************
 * 
 */

DATA_DIR = "/data";

if (!fs.existsSync(DATA_DIR)) {
    DATA_DIR = "./data";
    assert(fs.existsSync(DATA_DIR), "Data directory not found.");
}

/*********************************************************************************
 * Load existing CONFIG file
 */

CONFIG_FILE = `${DATA_DIR}/config.json`;

try {
    if (fs.existsSync(CONFIG_FILE)) {
        console.log("Loading CONFIG File");

        CONFIG = Object.assign(CONFIG, JSON.parse(fs.readFileSync(CONFIG_FILE)));

        console.log("CONFIG File loaded sucessfully.");
    }
    else {
        console.warn("CONFIG File not found, a new one will be generated using enviroment data.");
    }
}
catch (error) {
    console.error("Warning: Error loading CONFIG.json server will not start.");
    throw error;
}

/*********************************************************************************
 * Validate CONFIG
 */

CONFIG.telegram.token = process.env.TELEGRAM_TOKEN || CONFIG.telegram.token;

assert(CONFIG.telegram.token, `No Telegram token defined.\nThis can set in CONFIG under "telegram.token" or as enviroment value TELEGRAM_TOKEN.`);

CONFIG.signin.with_telegram = process.env.SIGNIN_WITH_TELEGRAM || CONFIG.signin.with_telegram;

CONFIG.signin.with_link = process.env.SIGNIN_WITH_LINK || CONFIG.signin.with_link;

if (CONFIG.signin.with_telegram) {
    CONFIG.telegram.api_id = process.env.TELEGRAM_API_ID || CONFIG.telegram.api_id;

    assert(CONFIG.telegram.api_id, `No Telegram ApiId defined, required for signin with Telegram.\nThis can set in CONFIG under "telegram.api_id" or as enviroment value TELEGRAM_API_ID.`);

    CONFIG.telegram.api_hash = process.env.TELEGRAM_API_HASH || CONFIG.telegram.api_hash;

    assert(CONFIG.telegram.api_hash, `No Telegram ApiHash defined, required for signin with Telegram.\nThis can set in CONFIG under "telegram.api_hash" or as enviroment value TELEGRAM_API_HASH.`);
}

assert(CONFIG.signin.with_telegram || CONFIG.signin.with_link, `No signin method defined.\nThis can set in CONFIG under "signin.with_telegram" or "signin.with_link" or as enviroment value SIGNIN_WITH_TELEGRAM or SIGNIN_WITH_LINK.`);

CONFIG.server.port = process.env.SERVER_PORT || CONFIG.server.port;

assert(CONFIG.server.port, `No Server port defined.\nThis can set in CONFIG under "server.port" or as enviroment value SERVER_PORT.`);

CONFIG.server.url = process.env.SERVER_URL || CONFIG.server.url;

assert(CONFIG.server.url, `No Server url defined.\nThis can set in CONFIG under "server.url" or as enviroment value SERVER_URL.`);


//This is for when using a config file and not enviroment values.
process.env.DB_KEY = process.env.DB_KEY || CONFIG.database.key;

//Encryption Key is not saved to config file.
assert((!process.env.DB_KEY) || process.env.DB_KEY.length == 32, `Enviroment value DB_KEY must be 32 characters long, currently ${process.env.DB_KEY.length}.`);

if (!process.env.DB_KEY) console.warn("Enviroment value DB_KEY not set, DataBase will not use encryption!");

/*********************************************************************************
 * Save the CONFIG
 */

try {
    console.log("Saving CONFIG File");
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(CONFIG, undefined, 2));
}
catch (error) {
    console.error("Warning: Error saving CONFIG.json server will not start.");
    throw error;
}

/*********************************************************************************
 * Export CONFIG
 */

module.exports = CONFIG;
