const Telegram = require('./telegram');

const { Database } = require('./database');

/******************************************************************************************
 * Attachment Cache
 */

Database.exec(`
    CREATE TABLE IF NOT EXISTS Files (
        file_id VARCHAR(256) PRIMARY KEY,
        file_path VARCHAR(256) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

const insert_cached = Database.prepare(` 
    INSERT INTO Files (
        file_id, file_path, timestamp
    ) VALUES ( ?, ?, CURRENT_TIMESTAMP )
    ON CONFLICT(file_id) DO UPDATE SET
        file_path = file_path,
        timestamp = excluded.timestamp
`);

const get_chached = Database.prepare(`
    SELECT * FROM Files WHERE file_id = ? AND timestamp > DATETIME('now', '-46 minutes')
`);

const clear_cache = Database.prepare(`
    DELETE FROM Files WHERE timestamp < DATETIME('now', '-60 minutes')
`);

/******************************************************************************************
 * Get Attachment
 */

const getUrl = async (id) => {

    let attachment = get_chached.get(id);

    if (attachment)
        return attachment.file_path;

    const path = await Telegram.bot.getFileLink(id);

    if (path)
        insert_cached.run(id, path)

    return path;
};

/******************************************************************************************
 * Attachment Database
 */

Database.exec(`
    CREATE TABLE IF NOT EXISTS Attachments (
        message_uuid VARCHAR(16),
        file_id VARCHAR(256),
        file_name VARCHAR(256),
        mime_type VARCHAR(256),
        file_unique_id VARCHAR(16),
        file_size DOUBLE,
        thumb VARCHAR(256),
        PRIMARY KEY (file_id, message_uuid)
    )
`);

const insert = Database.prepare(`
    INSERT INTO Attachments (
        message_uuid, file_id, file_name, mime_type, file_unique_id, file_size, thumb
    ) VALUES ( ?, ?, ?, ?, ?, ?, ? )
    ON CONFLICT(file_id, message_uuid) DO NOTHING
`);

const get = Database.prepare(`SELECT * FROM Attachments WHERE message_uuid = ?`);

const fetch = async (uuid) => {
    const row = get.get(uuid);

    if (!row)
        return;

    row.file_url = await getUrl(row.file_id);

    if (row.thumb)
        row.thumb_url = await getUrl(row.thumb);

    return row;
}

/******************************************************************************************
 * Clean Database
 */

setInterval(() => clear_cache.run(), 60 * 60 * 1000);

/******************************************************************************************
 * Exports
 */

module.exports = {
    insert: (uuid, att) => insert.run(uuid, att.file_id, att.file_name || "", att.mime_type || "", att.file_unique_id || "", att.file_size || 0, att.thumb?.file_id || ""),
    getUrl,
    fetch
};