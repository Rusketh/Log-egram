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

Database.exec(`
    CREATE TABLE IF NOT EXISTS Tokens (
        token VARCHAR(64) PRIMARY KEY,
        user_id DOUBLE NOT NULL,
        group_id DOUBLE DEFAULT NULL,
        message_id DOUBLE DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);

/******************************************************************************************
 * Sessions
 */

const insert = Database.prepare(`INSERT INTO Sessions (session_id, user_id, auth_date) VALUES (?, ?, ?)`);

const get = Database.prepare(`SELECT * FROM Sessions WHERE session_id = ?`);

const remove = Database.prepare(`DELETE FROM Sessions WHERE session_id = ?`);

/******************************************************************************************
 * Define Web Application with Express
 */

const WebApp = express();

WebApp.use(express.json());

WebApp.use(cookieParser());

/******************************************************************************************
 * Cookie Options
 */

const cookieOptions = {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 Day
    sameSite: 'lax',
    secure: true
};

/******************************************************************************************
 * Security
 */

WebApp.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https://*.telegram.org; video-src 'self' https://*.telegram.org;");
    next();
});


/******************************************************************************************
 * Middleware
 */

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

const forceAuth = async (req, res, next) => {
    if (!CONFIG.signin.with_telegram)
        return res.status(403).json({ status: false, error: "Login via Telegram is not enabled.\nUse /login to login with a link." });

    if (!req.user)
        return res.status(403).redirect('/api/auth/login');

    next();
};

const csrf = (req, res, next) => {
    const origin = req.get('origin') || req.get('referer');

    if (origin) {
        const url = new URL(origin);
        const serverUrl = new URL(CONFIG.server.url || `http://localhost:${CONFIG.server.port}`);

        if (url.hostname !== serverUrl.hostname)
            return res.status(403).json({ error: "Forbidden: CSRF check failed." });
    }

    next();
};

/******************************************************************************************
 * Logout
 */

WebApp.get('/api/auth/logout', checkAuth, forceAuth, (req, res) => {
    const sessionId = req.cookies.session_id;

    if (sessionId) remove.run(sessionId);

    res.clearCookie('session_id');

    res.redirect('/');
});

/******************************************************************************************
 * Telegram SSO
 */

const Secret = crypto.createHash('sha256').update(CONFIG.telegram.token).digest();

WebApp.get('/api/auth/redirect', (req, res) => {
    if (!CONFIG.signin.with_telegram)
        return res.status(403).json({ status: false, error: "Login via Telegram is not enabled." });

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

    res.cookie('session_id', sessionId, cookieOptions);

    res.redirect('/');
});

/******************************************************************************************
 * Telegram Login via Message
 */


const insertToken = Database.prepare(`INSERT INTO Tokens (token, user_id) VALUES (?, ?)`);

const removeToken = Database.prepare(`DELETE FROM Tokens WHERE token = ?`);

const clear_token = Database.prepare(`DELETE FROM Tokens WHERE created_at < datetime('now', '-1 hour')`);

const update_token_message = Database.prepare(`UPDATE Tokens SET group_id = ?, message_id = ? WHERE token = ?`);

const expired_tokens = Database.prepare(`SELECT * FROM Tokens WHERE created_at < datetime('now', '-1 hour')`);

const generateAccessLink = (msg) => {
    if (msg.chat.type !== 'private') {
        Telegram.bot.sendMessage(msg.chat.id, "Please use this command in a private chat with the bot.");
        return [false, null];
    }

    if (!Groups.all().some(async (group) => await Telegram.isAdmin(group, msg.from))) {
        Telegram.bot.sendMessage(msg.chat.id, "You must be an admin of at least one group the bot is in to use this command.");
        return [false, null];
    }

    console.log("Generating login token for", msg.from.username);

    const token = crypto.randomBytes(32).toString('hex');

    insertToken.run(token, msg.from.id);

    const url = CONFIG.server.url || `http://localhost:${CONFIG.server.port}`;

    return [true, `${url}/api/auth/token?token=${token}`, token];
};

if (CONFIG.signin.with_link) {
    Telegram.registerCommand('logs', async (msg) => {
        const url = CONFIG.server.url || `http://localhost:${CONFIG.server.port}`;

        Telegram.bot.sendMessage(msg.chat.id, `LogeGram: ${url}\nUse "/login" to generate an access link.\nUse /app to open in Telegram.`, { disable_web_page_preview: true });
    });

    Telegram.registerCommand('login', async (msg) => {

        const [status, url, token] = generateAccessLink(msg);

        if (!status)
            return;

        Telegram.bot.sendMessage(msg.chat.id, `Login here: ${url} (Valid for 1 hour)`, { disable_web_page_preview: true })
            .then((sent) => update_token_message.run(msg.chat.id, sent.message_id, token));
    });

    Telegram.registerCommand('app', async (msg) => {
        const [status, url, token] = generateAccessLink(msg);

        if (!status)
            return;

        const ulx = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Open in App",
                            web_app: { url }
                        }
                    ]
                ]
            }
        };

        Telegram.bot.sendMessage(msg.chat.id, "Click the button below to open LogEgram in Telegram:", ulx)
            .then((sent) => update_token_message.run(msg.chat.id, sent.message_id, token));
    });

    setInterval(() => {

        const expired = expired_tokens.all();

        if (!expired || expired.length == 0)
            return;

        for (let row of expired) {
            if (row.group_id && row.message_id)
                Telegram.bot.deleteMessage(row.group_id, row.message_id).catch(() => { });
        }

        clear_token.run();
    }, 30 * 60 * 1000);
}

WebApp.get('/api/auth/token', async (req, res) => {
    const { token } = req.query;

    if (!CONFIG.signin.with_link)
        return res.status(403).json({ status: false, error: "Login via token is not enabled." });

    if (!token)
        return res.status(400).json({ status: false, error: "Token is required." });

    const row = Database.prepare(`SELECT * FROM Tokens WHERE token = ?`).get(token);

    if (!row)
        return res.status(403).json({ status: false, error: "Invalid token." });

    if (row.group_id && row.message_id)
        Telegram.bot.deleteMessage(row.group_id, row.message_id).catch(() => { });

    const createdAt = new Date(row.created_at);

    if (Date.now() - createdAt.getTime() > 60 * 60 * 1000)
        return res.status(403).json({ status: false, error: "Token has expired." });

    removeToken.run(token);

    const sessionId = crypto.randomBytes(32).toString('hex');

    insert.run(sessionId, row.user_id, Date.now() / 1000);

    res.cookie('session_id', sessionId, cookieOptions);

    res.redirect('/');
});

/******************************************************************************************
 * Assets
 */

const publicOptions = {
    maxAge: '1d',
    immutable: true
};

const privateOptions = {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
    }
};

WebApp.use('/assets',
    express.static(path.join(__dirname, "views/public"), publicOptions),
    checkAuth,
    (req, res, next) => {
        if (!req.user)
            return res.status(401).send("Unauthorized");
        next();
    },
    express.static(path.join(__dirname, "views/private"), privateOptions),
    (req, res) => res.status(404).send("Not Found")
);

/******************************************************************************************
 * Web Pages
 */

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

const filterByGroupAdmin = async (user, groups) => {
    if (user.user_admin)
        return groups;

    const results = [];

    const cache = {};

    for (let group of groups) {
        let cached = cache[group.group_id];

        if (cached == null)
            cached = cache[group.group_id] = await Telegram.isAdmin(group, user, true);

        if (cached == true)
            results.push(group);
    }

    return results;
}

/******************************************************************************************
 * API End Points: Users
 */

WebApp.get('/api/users', csrf, checkAuth, async (req, res) => {

    if (!req.user)
        return res.status(400).json({ status: false, error: "Not logged in." });

    let users = req.query.search ? Users.query(req.query.search) : Users.all();

    return res.json({ status: true, users });
});

WebApp.get('/api/users/:group_id', checkAuth, async (req, res) => {

    if (!req.user)
        return res.status(403).json({ status: false, error: "Not logged in." });

    if (!Telegram.isAdmin({ group_id: req.params.group_id }, req.user, true))
        return res.status(403).json({ status: false, error: "Invalid permissions." });

    let users = Users.memberOf(req.params.group_id);

    return res.json({ status: true, users });
});

/******************************************************************************************
 * API End Points: Groups
 */

WebApp.get('/api/groups', csrf, checkAuth, async (req, res) => {

    if (!req.user)
        return res.status(403).json({ status: false, error: "Not logged in." });

    let groups = req.query.search ? Groups.query(req.query.search) : Groups.all();

    groups = await filterByGroupAdmin(req.user, groups);

    return res.json({ status: true, groups });
});

/******************************************************************************************
 * API End Points: Messages
 */

WebApp.get('/api/messages/', csrf, checkAuth, async (req, res) => {

    if (!req.user)
        return res.status(403).json({ status: false, error: "Not logged in." });

    let [messages, total] = await Messages.query({
        from: req.query.from,
        to: req.query.to,
        message_id: req.query.message_id,
        group_id: req.query.group_id,
        user_id: req.query.user_id,
        include_stickers: req.query.include_stickers == "true",
        include_attachments: req.query.include_attachments == "true",
        activity: req.query.activity,
        search_query: req.query.search_query,
        page: req.query.page,
        limit: req.query.limit || 0
    });

    messages = await filterByGroupAdmin(req.user, messages);

    return res.json({ status: true, messages, page: req.params.page, total });
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