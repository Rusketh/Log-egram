const CONFIG = require("./config");

const crypto = require('node:crypto');

/******************************************************************************************
 * Create Database
 */

const { DatabaseSync } = require('node:sqlite');

const Database = new DatabaseSync(`${DATA_DIR}/logegram.db`);

/******************************************************************************************
 * Configure Database
 */

Database.exec("PRAGMA journal_mode = WAL;");

Database.exec("PRAGMA synchronous = NORMAL;");

Database.exec("PRAGMA temp_store = MEMORY;");

Database.exec("PRAGMA foreign_keys = ON;");

/******************************************************************************************
 * Encryption
 */

const key = process.env.DB_KEY;
const cachedKey = key ? Buffer.from(key, "utf8") : null;

const Encrypt = function (data) {
    if (!data || data == "")
        return data;

    if (!key)
        return data.toString();

    const bytes = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", cachedKey, bytes);
    const garbage = cipher.update(data.toString(), "utf8", "hex") + cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    return `${bytes.toString("hex")}:${tag}:${garbage}`;
};

const Decrypt = function (garbage) {
    if (!garbage || garbage == "")
        return garbage;
    try {
        const [bytes, tag, data] = garbage.split(':');
        const decipher = crypto.createDecipheriv("aes-256-gcm", cachedKey, Buffer.from(bytes, "hex"));
        decipher.setAuthTag(Buffer.from(tag, "hex"));
        return decipher.update(data, "hex", "utf8") + decipher.final("utf8");
    } catch (e) {
        console.error("WARNING: Encryption Key changed or missing, output is garbage!");
    }
};

const Hash = function (data) {
    if (!data) return null;
    if (!key) return data.toString();
    return crypto.createHmac('sha256', cachedKey).update(data.toString()).digest("hex");
}


/******************************************************************************************
 * Exports
 */

module.exports = {
    Database,
    Encrypt,
    Decrypt,
    Hash
};