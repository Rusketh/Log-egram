# Log-egram

Log-egram is a powerful Telegram Message Logger & Viewer. It allows you to log messages from Telegram groups—including text, stickers, photos, voice notes, videos, audio files, and documents—and view them through a user-friendly web interface. It includes Telegram Single Sign-On (SSO) for secure access and search functionality to easily find past conversations.

## Features

-   **Comprehensive Logging**: Captures text messages, stickers, photos, voice notes, videos, audio files, documents, and tracks message edits with version history.
-   **Efficient Storage**: Media files and stickers are referenced via Telegram's servers, not stored locally, minimizing disk usage.
-   **Web Interface**: Browse and search logs via a clean, responsive web UI.
-   **Flexible Authentication**: Choose between Telegram SSO or secure one-time login links (or enable both).
-   **Group Management**: Filter logs by specific groups with admin-based access control.
-   **Search**: Powerful search capabilities to find messages by user, group, or content.

## Requirements

-   **Docker**: For containerized deployment.
-   **Reverse Proxy & SSL**: A reverse proxy (like Nginx, Traefik, or Caddy) with a valid SSL certificate (HTTPS) is **REQUIRED** if using Telegram SSO authentication. Token-based login can work over HTTP for local/testing environments.
-   **Telegram Bot Token**: Created via BotFather (required).
-   **Telegram API ID & Hash**: Only required if using Telegram SSO authentication (see Authentication Options below).
-   **Storage**: Adequate disk space for your data volume. Log storage grows with message volume—plan accordingly for active groups.

## Setup Guide

### 1. Telegram Bot Setup (The "Godfather" Part)

You need to create a bot to interact with Telegram.

1.  Open Telegram and search for **@BotFather**.
2.  Start a chat and send the command `/newbot`.
3.  Follow the prompts to assign a **Name** and a **Username** (must end in `bot`) for your bot.
4.  **Save the API Token** provided. You will need this for the `TELEGRAM_TOKEN` environment variable.

#### Critical Bot Settings
For the logger to work correctly, you must disable Group Privacy.

1.  Send `/mybots` to @BotFather.
2.  Select your bot from the list.
3.  Go to **Bot Settings** > **Group Privacy**.
4.  Select **Turn off**. (This allows the bot to see all messages in groups, not just commands).

#### Set Commands
To make the bot easy to use, set the following commands:

1.  Go to **Edit Bot** > **Edit Commands**.
2.  Send the following list:
    ```
    logs - Get the link to the web interface
    login - Generate a temporary login link
    app - Open the web app inside Telegram
    ```

### 2. Telegram API Setup (SSO)

You need your own Telegram API keys (API ID and API Hash). These are used for Telegram SSO authentication. **These keys must belong to the same person managing the bot.**

1.  Go to [my.telegram.org](https://my.telegram.org) and log in with your phone number.
2.  Click on **API development tools**.
3.  Fill in the form to create a new application:
    -   **App title**: Log-egram (or any name you prefer)
    -   **Short name**: logegram
    -   **Platform**: Web (or Other)
    -   **Description**: Telegram Logger
4.  Click **Create application**.
5.  **Copy the `App api_id` and `App api_hash`**. You will need these for the `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` variables.

## Installation via Docker

The easiest way to run Log-egram is using Docker.

### Docker Run Command

```bash
docker run -d \
  --name log-egram \
  -p 3000:3000 \
  -v ./data:/data \
  -e TELEGRAM_TOKEN="your_bot_token_here" \
  -e TELEGRAM_API_ID="your_api_id_here" \
  -e TELEGRAM_API_HASH="your_api_hash_here" \
  -e SERVER_PORT=3000 \
  -e SERVER_URL="https://your-domain.com" \
  ghcr.io/rusketh/log-egram/logegram:main
```

### Docker Compose Example

Create a `docker-compose.yml` file:

```yaml
services:
  log-egram:
    image: ghcr.io/rusketh/log-egram/logegram:main
    container_name: log-egram
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      - TELEGRAM_TOKEN=your_bot_token_here
      - TELEGRAM_API_ID=your_api_id_here
      - TELEGRAM_API_HASH=your_api_hash_here
      - SERVER_PORT=3000
      - SERVER_URL=https://your-domain.com
```

**Note**: Replace the environment variables with your actual values.

## Configuration Variables

| Variable | Description | Required |
| :--- | :--- | :--- |
| `TELEGRAM_TOKEN` | The bot token from @BotFather. | **Yes** |
| `TELEGRAM_API_ID` | Your Application API ID from my.telegram.org. | **Only if using Telegram SSO** |
| `TELEGRAM_API_HASH` | Your Application API Hash from my.telegram.org. | **Only if using Telegram SSO** |
| `SERVER_PORT` | The port the internal server listens on (default: 3000). | **Yes** |
| `SERVER_URL` | The public HTTPS URL of your instance (e.g., `https://logs.mysite.com`). Used for redirects and callbacks. | **Yes** |
| `SIGNIN_WITH_TELEGRAM` | Enable Telegram SSO login (default: `true`). | No |
| `SIGNIN_WITH_LINK` | Enable one-time token-based login via bot commands (default: `true`). | No |
| `RETENTION_DAYS` | Automatically delete messages older than X days (default: `90`). Set to `0` to disable. | No |

> [!IMPORTANT]
> **At least one authentication method must be enabled.** You can use Telegram SSO, token-based login, or both. If you disable Telegram SSO (`SIGNIN_WITH_TELEGRAM=false`), you do not need `TELEGRAM_API_ID` or `TELEGRAM_API_HASH`.

## Reverse Proxy & SSL

If using **Telegram SSO** authentication, your application **must** be accessible via HTTPS. You should set up a reverse proxy like Nginx, Traefik, or Apache to handle SSL termination and forward requests to the container's port (e.g., 3000).

If you're only using **token-based login** (`SIGNIN_WITH_TELEGRAM=false`), HTTPS is not strictly required, though still recommended for security.

-   **Nginx Example Snippet**:
    ```nginx
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    ```

Ensure your `SERVER_URL` matches the HTTPS domain you configure (e.g., `https://your-domain.com`).

## Usage

Once the bot is running and added to your groups, you can interact with it. The bot does **not** need admin privileges, but **Group Privacy must be turned OFF** in BotFather settings for the bot to see all messages.

### Commands

-   `/logs` - Sends you the direct link to your Log-egram web interface.
-   `/login` - Generates a secure, temporary login link with a one-time token. **(Private Chat Only)**
-   `/app` - Opens the web interface directly inside Telegram. **(Private Chat Only)**

### Authentication & One-Time Codes

For security, Log-egram utilizes a **One-Time Password (OTP)** system for logging in via the bot:

1.  **Private Only**: These commands only work in a private chat with the bot for security reasons.
2.  **Admin Check**: You must be an administrator of at least one group the bot is in to generate a login link.
3.  **One-Time Use**: The links generated by `/login` and `/app` contain a unique token that is valid for **one use only**.
4.  **Expiration**: The token expires automatically after **1 hour** if unused.

## Data Storage & Retention

Log-egram stores all data in the `/data` directory (or `./data` if `/data` doesn't exist):

-   **Database**: `logegram.db` (SQLite) - Contains messages, users, groups, sessions, and tokens
-   **Configuration**: `config.json` - Auto-generated from environment variables on first run
-   **Attachments Metadata**: File references are stored, but actual media is hosted on Telegram's servers

### Data Retention

Messages are automatically deleted after **90 days** by default. You can customize this with the `RETENTION_DAYS` environment variable:

-   Set to `0` to disable automatic cleanup (keep all messages forever)
-   Set to any positive number to delete messages older than that many days
-   Cleanup runs every 24 hours (starting from when the bot was launched)

> [!WARNING]
> **Plan your disk space accordingly.** While media files are not stored locally, the database grows with message volume. For active groups with thousands of messages per day, expect significant database growth over time.

## Authentication Options

Log-egram supports two authentication methods that can be used independently or together:

### Telegram SSO (Single Sign-On)

Best for users who want seamless login using their Telegram account.

-   **Requires**: `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` from my.telegram.org
-   **Requires**: HTTPS with valid SSL certificate
-   **Enable**: Set `SIGNIN_WITH_TELEGRAM=true` (default)
-   **Disable**: Set `SIGNIN_WITH_TELEGRAM=false`

### Token-Based Login

Best for environments without HTTPS or when you prefer bot-generated login links.

-   **Requires**: Only the bot token
-   **Works**: Over HTTP or HTTPS
-   **Enable**: Set `SIGNIN_WITH_LINK=true` (default)
-   **Disable**: Set `SIGNIN_WITH_LINK=false`
-   **Commands**: `/login` and `/app` generate secure one-time links

**Example**: Token-only authentication (no HTTPS required):
```yaml
environment:
  - SIGNIN_WITH_TELEGRAM=false
  - SIGNIN_WITH_LINK=true
  # No need for TELEGRAM_API_ID or TELEGRAM_API_HASH
```

## Access Control

-   **Bot Access**: The bot must be added to groups you want to log. No admin privileges required for the bot.
-   **User Access**: Only users who are **administrators** in at least one group that the bot is in can:
    -   Generate login links via `/login` or `/app`
    -   Access the web interface
    -   View logs from their groups
-   **Group Privacy**: Must be disabled in BotFather settings for the bot to see all messages

## Troubleshooting

### Bot Not Logging Messages

1. Ensure **Group Privacy** is turned OFF in BotFather settings:
   - Message @BotFather → `/mybots` → Select your bot → Bot Settings → Group Privacy → Turn off
2. Verify the bot is added to the group
3. Check the container logs for errors: `docker logs log-egram`

### Cannot Access Web Interface

1. Verify you are an **admin** in at least one group the bot is monitoring
2. If using Telegram SSO, ensure `SERVER_URL` is set to your HTTPS domain
3. Check that the reverse proxy is correctly forwarding to port 3000
4. Try token-based login instead: Message the bot privately with `/login`

### Login Token Expired

-   Tokens expire after **1 hour**
-   Each token is **one-time use** only
-   Generate a new token by messaging the bot with `/login`

### HTTPS/SSL Errors with Telegram SSO

-   Telegram's login widget requires a valid SSL certificate
-   Self-signed certificates will NOT work
-   Consider using token-based login if SSL is problematic: Set `SIGNIN_WITH_TELEGRAM=false`

### Data Not Persisting After Restart

-   Ensure you have configured a volume mount: `-v /path/to/data:/data`
-   Check volume mount permissions
-   Verify the `/data` directory exists and is writable

## Technical Architecture

*For those interested in how Log-egram works under the hood:*

### Technology Stack

-   **Runtime**: Node.js 22.17.0+ (Alpine Linux)
-   **Database**: SQLite with WAL mode for concurrent access
-   **Bot Library**: node-telegram-bot-api
-   **Web Framework**: Express.js 5

### Database Schema

-   **Messages**: Stores message content, metadata, and edit history with versioning
-   **Users**: Telegram user information and photo URLs
-   **Groups**: Group/chat information
-   **GroupMembers**: Junction table tracking user membership in groups
-   **Sessions**: Web session management (24-hour expiry)
-   **Tokens**: One-time login tokens (1-hour expiry)
-   **Attachments**: File metadata and references to Telegram's CDN

### Message Logging

-   All message types are captured: text, stickers, photos, voice, video, audio, documents
-   Message edits create new versions (original + all revisions are preserved)
-   Captions on media are stored alongside the attachment
-   Stickers and files are referenced by `file_id` (hosted on Telegram, not stored locally)
-   Download URLs are generated on-demand and cached for up to 1 hour (46-minute validity window) when viewing messages

### Security Features

-   Cookie-based sessions with HTTP-only flag
-   HMAC-SHA256 validation for Telegram login widget
-   One-time token system with automatic expiration
-   Admin-based access control per group
-   Expired tokens and sessions are automatically cleaned up

