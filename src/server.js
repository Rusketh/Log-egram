const CONFIG = require('./config');

const { Database } = require("./database");

const Telegram = require("./telegram");

const Groups = require("./groups");

const Users = require("./users");

const Messages = require("./messages");

/******************************************************************************************
 * Express Modules
 */

const express = require('express');

const path = require('path');

const fs = require('fs');

const crypto = require('crypto');

const cookieParser = require('cookie-parser');

/******************************************************************************************
 * Create Sessions Table
 */

Database.exec(`
    CREATE TABLE IF NOT EXISTS Sessions (
        session_id VARCHAR(64) PRIMARY KEY,
        user_id DOUBLE NOT NULL,
        auth_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

/******************************************************************************************
 * Sessions
 */

const insert = Database.prepare(`
    INSERT INTO Sessions (session_id, user_id, auth_date) VALUES (?, ?, ?)
`);

const get = Database.prepare(`SELECT * FROM Sessions WHERE session_id = ?`);

const remove = Database.prepare(`DELETE FROM Sessions WHERE session_id = ?`);

/******************************************************************************************
 * Define Web Application with Express
 */

const WebApp = express();

WebApp.use(express.json());

WebApp.use(cookieParser());

/******************************************************************************************
 * Telegram SSO
 */

const Secret = crypto.createHash('sha256').update(CONFIG.telegram.token).digest();

const checkAuth = async (req, res, next) => {
    const sessionId = req.cookies.session_id;

    req.user = null;

    if (!sessionId)
        return next();
    
    const session = get.get(sessionId);

    if (session)
        req.user = Users.byID(session.user_id);

    next();
};

const forceAuth = async(req, res, next) => {
    if (!req.user)
        return res.status(403).redirect('api/auth/login');
    
    next();
};

WebApp.get('/api/auth/redirect', (req, res) => {
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.query;

    if (!hash || !id || !auth_date)
        return res.status(400).json({ status: false, error: "Failed to auth via telegram." });

    // Verify Hash
    const dataCheckArr = [];
    if (auth_date) dataCheckArr.push(`auth_date=${auth_date}`);
    if (first_name) dataCheckArr.push(`first_name=${first_name}`);
    if (id) dataCheckArr.push(`id=${id}`);
    if (last_name) dataCheckArr.push(`last_name=${last_name}`);
    if (photo_url) dataCheckArr.push(`photo_url=${photo_url}`);
    if (username) dataCheckArr.push(`username=${username}`);

    dataCheckArr.sort();

    const hmac = crypto.createHmac('sha256', Secret).update(dataCheckArr.join('\n')).digest('hex');

    if (hmac !== hash)
        return res.status(403).redirect('/nope');

    if (Date.now() / 1000 - auth_date > 86400)
        return res.status(403).redirect('/nope');


    const sessionId = crypto.randomBytes(32).toString('hex');

    insert.run(sessionId, id, auth_date);

    Users.setPhoto(id, photo_url);

    res.cookie('session_id', sessionId, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });

    res.redirect('/');
});

WebApp.get('/api/auth/logout', checkAuth, forceAuth, (req, res) => {
    const sessionId = req.cookies.session_id;

    if (sessionId) remove.run(sessionId);

    res.clearCookie('session_id');

    res.redirect('/');
});

/******************************************************************************************
 * Web Pages
 */

WebApp.use('/assets', express.static(path.join(__dirname, "views/assets")));

const login_html = fs.readFileSync(path.join(__dirname, "views/login.html"), 'utf8');

WebApp.get("/api/auth/login", checkAuth, async (req, res) => {
    
    if (req.user)
        return res.redirect("/");

    let html = login_html;

    html = html.replace('${botname}', Telegram.bot.username);

    html = html.replace('${url}', CONFIG.server.url || `http://localhost:${CONFIG.server.port}`);

    res.send(html);
});

const index_html = fs.readFileSync(path.join(__dirname, "views/index.html"), 'utf8');

WebApp.get("/", checkAuth, forceAuth, async (req, res) => {
    let html = index_html;

    html = html.replace('${user_id}', req.user.user_id);
    html = html.replace('${user_name}', req.user.user_name);
    html = html.replace('${user_photo}', req.user.photo_url);

    res.send(html);
});

/******************************************************************************************
 * Util Functions
 */

const filterByGroupAdmin = (user, groups) => {
    if (user.user_admin)
        return groups;

    const results = [ ];

    const cache = { };

    for(let group of groups)
    {
        let cached = cache[group.group_id];

        if (cached == null)
            cached = cache[group.group_id] = Telegram.isAdmin(group, user);

        if (cached != true)
            results.push(group);
    }

    return results;
}

/******************************************************************************************
 * API End Points: Users
 */

WebApp.get('/api/users', checkAuth, async (req, res) => {

    if (!req.user)
        return req.status(400).json({ status: false, error: "Not logged in." });

    let users = req.query.search ? Users.query(req.query.search) : Users.all();

    //TODO: Filter users 

    return res.json({status: true, users});
});

WebApp.get('/api/users/:group_id', checkAuth, async (req, res) => {

    if (!req.user)
        return req.status(403).json({ status: false, error: "Not logged in." });

    if (!Telegram.isAdmin({group_id: req.params.group_id}, req.user))
        return req.status(403).json({ status: false, error: "Invalid permissions." });

    let users = Users.memberOf(req.params.group_id);

    return res.json({status: true, users});
});

/******************************************************************************************
 * API End Points: Groups
 */

WebApp.get('/api/groups', checkAuth, async (req, res) => {

    if (!req.user)
        return req.status(403).json({ status: false, error: "Not logged in." });

    let groups = req.query.search ? Groups.query(req.query.search) : Groups.all();
    
    groups = filterByGroupAdmin(req.user, groups);

    return res.json({status: true, groups});
});

/******************************************************************************************
 * API End Points: Messages
 */

WebApp.get('/api/messages/', checkAuth, async (req, res) => {

    if (!req.user)
        return req.status(403).json({ status: false, error: "Not logged in." });

    let [messages, total] = await Messages.query({
        from: req.query.from,
        to: req.query.to,
        message_id: req.query.message_id,
        group_id: req.query.group_id,
        user_id: req.query.user_id,
        include_stickers: req.query.include_stickers == "true",
        include_attachments: req.query.include_attachments == "true",
        activity: req.query.activity,
        page: req.query.page,
        limit: req.query.limit || 0
    });

    messages = filterByGroupAdmin(req.user, messages);

    return res.json({status: true, messages, page: req.params.page, total});
});


/******************************************************************************************
 * Start Server
 */

WebApp.listen(CONFIG.server.port, () => {
    console.log(`Server running on ${CONFIG.server.port}`);
});

/******************************************************************************************
 * Exports
 */

module.exports = { WebApp }