const { Database } = require("./database");

//const Attachments = require("./attachments");

/******************************************************************************************
 * Create Tables
 */

Database.exec(`
    CREATE TABLE IF NOT EXISTS Users (
        user_id DOUBLE PRIMARY KEY,
        user_name VARCHAR(256) NOT NULL,
        first_name VARCHAR(256) DEFAULT NULL,
        last_name VARCHAR(256) DEFAULT NULL,
        user_admin INT DEFAULT 0,
        photo_url VARCHAR(256) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

Database.exec(`
    CREATE TABLE IF NOT EXISTS GroupMembers (
        group_id DOUBLE NOT NULL,
        user_id DOUBLE NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id)
    )
`);

/********************************************************************
 * Database Search
 ********************************************************************/

const byID = Database.prepare("SELECT * FROM Users WHERE user_id = ?");

const query = Database.prepare("SELECT * FROM Users WHERE user_name LIKE ? OR first_name LIKE ? OR last_name LIKE ? LIMIT 50");

const all = Database.prepare("SELECT * FROM Users");

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
    insertUser.run(user.id, user.username, user.first_name || "", user.last_name || "");
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
    insertGroupMember.run(group.id, user.id);
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

    const user = byID.get(id);

    if (!user) return false;

    return user.user_admin === 1;
};

/********************************************************************
 * Photos
 ********************************************************************/

const setPhoto = Database.prepare("UPDATE Users SET photo_url = ? WHERE user_id = ?");

/*const updatePhoto = async (user) => {
    const res = await fetch(`https://api.telegram.org/bot${CONFIG.telegram.token}/getUserProfilePhotos?user_id=${user.id || user.user_id}`);

    const data = await res.json();

    if (!data.ok)
        return;

    const photo = data.result.photos[0][0];
    
    setPhoto.run(photo.file_id, user.id || user.user_id);

    return await Attachments.getFile(photo.file_id);
};*/

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
    byID: (id) => byID.get(id),
    query: (search) => query.all(`%${search}%`, `%${search}%`, `%${search}%`),
    setAdmin: (id, value) => setAdmin.run(value ? 0 : 1, id),
    setPhoto: (id, value) => setPhoto.run(value, id),
    memberOf: (group_id) => memberOf.all(group_id),
    all: () => all.all(),
    registerGroupMember,
    registerUser,
    isAdmin,
    query,
};