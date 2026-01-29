const { Database } = require("./database");

/******************************************************************************************
 * Create Tables
 */

Database.exec(`
    CREATE TABLE IF NOT EXISTS Groups (
        group_id DOUBLE PRIMARY KEY,
        group_name VARCHAR(256) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

/********************************************************************
 * Database Search
 ********************************************************************/

const byID = Database.prepare("SELECT * FROM Groups WHERE group_id = ?");

const query = Database.prepare("SELECT * FROM Groups WHERE group_name LIKE ? LIMIT 50");

const all = Database.prepare("SELECT * FROM Groups");

/********************************************************************
 * Insert Groups
 ********************************************************************/

const insertGroup = Database.prepare(`
    INSERT INTO Groups (
        group_id, group_name
    ) VALUES ( ?, ? )
    ON CONFLICT(group_id) DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP,
        group_name = excluded.group_name
`);

const registerGroup = (group) => {
    if (!group) return;
    insertGroup.run(group.id, group.title);
};

/********************************************************************
 * Exports
 ********************************************************************/

module.exports = {
    query: (search) => query.all(`%${search}%`),
    byID: (id) => byID.get(id),
    all: () => all.all(),
    registerGroup,
    query
};
