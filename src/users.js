const { Database, Encrypt, Decrypt, Hash } = require('./database');

//const Attachments = require("./attachments");

/******************************************************************************************
 * Create Tables
 */

Database.exec(`
    CREATE TABLE IF NOT EXISTS Users (
        user_id VARCHAR(128) PRIMARY KEY,
        user_name VARCHAR(512) NOT NULL,
        first_name VARCHAR(512) DEFAULT NULL,
        last_name VARCHAR(512) DEFAULT NULL,
        user_admin INT DEFAULT 0,
        photo_url VARCHAR(256) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

Database.exec(`
    CREATE TABLE IF NOT EXISTS GroupMembers (
        group_id DOUBLE NOT NULL,
        user_id VARCHAR(128) NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id)
    )
`);

/********************************************************************
 * Database Search
 ********************************************************************/

const _byID = Database.prepare("SELECT * FROM Users WHERE user_id = ?");

const byID = (id) => {
    const user = _byID.get(Hash(id));

    if (user) {
        user.user_name = Decrypt(user.user_name);
        user.first_name = Decrypt(user.first_name);
        user.last_name = Decrypt(user.last_name);
    }

    return user;
};

const _all = Database.prepare("SELECT * FROM Users LIMIT ? OFFSET ?");

const all = (limit = 1000, page = 0) => _all.all(limit, limit * page).map(user => {
    user.user_name = Decrypt(user.user_name);
    user.first_name = Decrypt(user.first_name);
    user.last_name = Decrypt(user.last_name);
    return user;
});

const query = (query) => all().filter(user => user.user_name.includes(query) || user.first_name.includes(query) || user.last_name.includes(query));

/********************************************************************
 * Insert Users
 ********************************************************************/

const insertUser = Database.prepare(`
    INSERT INTO Users (
        user_id, user_name, first_name, last_name
    ) VALUES ( ?, ?, ?, ? )
    ON CONFLICT(user_id) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP,
        user_name = excluded.user_name,
        first_name = excluded.first_name,
        last_name = excluded.last_name
`);

const registerUser = (user) => {
    if (!user) return;
    insertUser.run(Hash(user.id), Encrypt(user.username), Encrypt(user.first_name || ""), Encrypt(user.last_name || ""));
};

/********************************************************************
 * Insert Group Members
 ********************************************************************/

const insertGroupMember = Database.prepare(`
    INSERT INTO GroupMembers (
        group_id, user_id
    ) VALUES ( ?, ? )
    ON CONFLICT(group_id, user_id) DO NOTHING
`);

const registerGroupMember = (group, user) => {
    if (!group || !user) return;
    insertGroupMember.run(group.id, Hash(user.id));
};

/********************************************************************
 * Membership Search
 ********************************************************************/

const memberOf = Database.prepare(`
    SELECT Users.* FROM Users 
    INNER JOIN GroupMembers ON Users.user_id = GroupMembers.user_id 
    WHERE GroupMembers.group_id = ?
`);

/********************************************************************
 * Admin
 ********************************************************************/

const setAdmin = Database.prepare("UPDATE Users SET user_admin = ? WHERE user_id = ?");

const isAdmin = ({ id }) => {
    if (!id) return false;

    const user = byID.get(Hash(id));

    if (!user) return false;

    return user.user_admin === 1;
};

/********************************************************************
 * Cleanup
 ********************************************************************/

const removeOldUsers = Database.prepare(`DELETE FROM Users WHERE created_at < datetime('now', '-? days')`);

const removeOldGroupMembers = Database.prepare(`DELETE FROM GroupMembers WHERE joined_at < datetime('now', '-? days')`);

setInterval(() => {
    if (!CONFIG.retention.days || CONFIG.retention.days < 1)
        return;

    removeOldUsers.run(CONFIG.retention.days);

    removeOldGroupMembers.run(CONFIG.retention.days);

    console.log(`Cleaned up old users and group members older than ${CONFIG.retention.days} days.`);
}, 24 * 60 * 60 * 1000);

/********************************************************************
 * Exports
 ********************************************************************/

module.exports = {
    setAdmin: (id, value) => setAdmin.run(value ? 0 : 1, Hash(id)),
    memberOf: (group_id) => memberOf.all(group_id),
    registerGroupMember,
    registerUser,
    isAdmin,
    query,
    byID,
    all
};

