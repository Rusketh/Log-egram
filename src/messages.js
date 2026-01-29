const crypto = require('crypto');

const Telegram = require('./telegram');

const { Database } = require('./database');

const Groups = require('./groups');

const Users = require('./users');

const Attachments = require("./attachments");

/******************************************************************************************
 * Create Tables
 */

Database.exec(`
    CREATE TABLE IF NOT EXISTS Messages (
        uuid VARCHAR(16) PRIMARY KEY,
        version INTEGER DEFAULT 1,
        group_id DOUBLE NOT NULL,
        group_name VARCHAR(256) DEFAULT NULL,
        poster_id DOUBLE NOT NULL,
        poster_name VARCHAR(256) NOT NULL,
        message_id DOUBLE NOT NULL,
        message_text TEXT DEFAULT NULL,
        reply_to_id DOUBLE DEFAULT NULL,
        sticker_id VARCHAR(256) DEFAULT NULL,
        activity VARCHAR(5) DEFAULT 'POST',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

/******************************************************************************************
 * Should Log
 */

const shouldLog = (message) => {
    if (!message) return false;
    if (message.text) return true;
    if (message.sticker) return true;
    if (message.photo) return true;
    if (message.voice) return true;
    if (message.video) return true;
    if (message.audio) return true;
    if (message.document) return true;
    return false;
};

/******************************************************************************************
 * Log new Posts
 */

const insert = Database.prepare(`
    INSERT INTO Messages (
        uuid, group_id, group_name, poster_id, poster_name, message_id, message_text, reply_to_id, sticker_id, version, activity
    ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )
`);

const addMessage = async (message, activity, version) => {    
    const uuid = crypto.randomUUID();

    let group_id = null;
    let group_name = null;
    let poster_id = null;
    let poster_name = null;
    let reply_to_id = null;
    let sticker_id = null;

    if (message.from) {
        Users.registerUser(message.from);
        poster_id = message.from.id;
        poster_name = message.from.username;
    }

    if (message.chat) {
        Groups.registerGroup(message.chat);
        group_id = message.chat.id;
        group_name = message.chat.title;
    }

    if (message.from && message.chat)
        Users.registerGroupMember(message.chat, message.from)

    if (message.reply_to_message)
        reply_to_id = message.reply_to_message.message_id;

    if (message.sticker)
        sticker_id = message.sticker.file_id;

    insert.run(
        uuid,
        group_id,
        group_name,
        poster_id,
        poster_name,
        message.message_id,
        message.text || message.caption || "",
        reply_to_id,
        sticker_id,
        version,
        activity
    );

    if (message.voice)
        Attachments.insert(uuid, message.voice);

    if(message.video)
        Attachments.insert(uuid, message.video);

    if (message.document)
        Attachments.insert(uuid, message.document);

    if (message.audio)
        Attachments.insert(uuid, message.audio);

    if (message.photo)
    {
        message.photo.sort((a, b) => a.file_size - b.file_size);
        
        const photo = message.photo[message.photo.length - 1];

        if (!photo.thumb) photo.thumb = message.photo[0].file_id;

        Attachments.insert(uuid, photo);
    }
};

/******************************************************************************************
 * Bot Events
 */

Telegram.bot.on('message', async (message) => {
    if (!shouldLog(message)) return;
    await addMessage(message, "POST", 0);
});

const getVersion = Database.prepare(`SELECT COUNT(*) AS total FROM Messages WHERE message_id = ? AND group_id = ?`);

Telegram.bot.on('edited_message', async (message) => {
    if (!shouldLog(message))
        return;

    if (!message.chat)
        return;

    const version = getVersion.get(message.message_id, message.chat.id).total + 1;

    await addMessage(message, "EDIT", version);
});

/******************************************************************************************
 * Query Function
 */

const countEdits = Database.prepare(`SELECT COUNT(*) as count FROM Messages WHERE group_id = ? AND message_id = ? AND activity = 'EDIT'`);

const countFiles = Database.prepare(`SELECT COUNT(*) as count FROM Attachments WHERE message_uuid = ?`);

const query = async ({from, to, group_id, user_id, message_id, activity, include_stickers, include_attachments, page, limit}) => {
   
    if (page && !limit)
        limit = 50;
    else if (limit && !page)
        page = 0;

    const conditions = [ ];
    const params = [ ];
    let i;

    let query = "FROM Messages";

    if (from)
    {
        conditions.push("timestamp >= ?");
        params.push(from);
    }

    if (to)
    {
        conditions.push("timestamp <= ?");
        params.push(to);
    }

    if (group_id)
    {
        conditions.push("group_id = ?");
        params.push(group_id);
    }

    if (user_id)
    {
        conditions.push("poster_id = ?");
        params.push(user_id);
    }

    if (message_id)
    {
        conditions.push("message_id = ?");
        params.push(message_id);
    }

    if (activity)
    {
        conditions.push("activity = ?");
        params.push(activity);
        i = params.length;
    }

    if (conditions.length > 0)
        query = `${query} WHERE ${conditions.join(" AND ")}`;

    let total = Database.prepare(`SELECT COUNT(*) as count ${query}`).get(...params).count;

    query = `${query} ORDER BY timestamp DESC`;

    if (limit)
    {
        query = `${query} LIMIT ?`;
        params.push(limit);
    }

    if (page && page > 0)
    {
        query = `${query} OFFSET ?`;
        params.push(page * page);
    }

    let rows = Database.prepare(`SELECT * ${query}`).all(...params);

    if (activity == "POST")
        rows.map(row => row.edit_count = countEdits.get(row.group_id, row.message_id)?.count || 0);

    if (include_stickers)
    {
        await Promise.all(rows
            .filter(row => row.sticker_id)
            .map(async (row) => row.sticker_path = await Attachments.getUrl(row.sticker_id))
        );
    }

    if (include_attachments)
        await Promise.all(rows.map(async (row) => row.attachments = await Attachments.all(row.uuid)));

    rows.map(row => row.file_count = row.attachments?.length || countFiles.get(row.uuid)?.count || 0);

    return [rows, total];
};

/******************************************************************************************
 * Exports
 */

module.exports = {
    query
};