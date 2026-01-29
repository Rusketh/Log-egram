const CONFIG = require("./config");

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
 * Exports
 */

module.exports = { Database };