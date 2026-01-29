# Log-egram

Log-egram is a powerful Telegram Message Logger & Viewer. It allows you to log messages from Telegram groups—including text, stickers, photos, voice notes, videos, audio files, and documents—and view them through a user-friendly web interface. It includes Telegram Single Sign-On (SSO) for secure access and search functionality to easily find past conversations.

## Features

-   **Comprehensive Logging**: Captures Text, Stickers, Photos, Voice, Video, Audio, Documents and message revisions.
-   **Web Interface**: Browse and search logs via a clean web UI.
-   **Telegram SSO**: Secure login using your Telegram account.
-   **Group Management**: Filter logs by specific groups.
-   **Search**: Powerful search capabilities to find messages by user or group.

## Requirements

-   **Docker**: For containerized deployment.
-   **Reverse Proxy & SSL**: A reverse proxy (like Nginx, Traefik, or Caddy) with a valid SSL certificate (HTTPS) is **MANDATORY**. Telegram's authentication widget requires the callback URL to serve over HTTPS.
-   **Telegram Bot Token**: Created via BotFather.
-   **Telegram API ID & Hash**: Required for Telegram SSO.

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

You need your own Telegram API keys (API ID and API Hash). These are used for the Telegram Client layer which handles authentication and some file operations. **These keys must belong to the same person managing the bot.**

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
  -v /data:/data \
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
| `TELEGRAM_API_ID` | Your Application API ID from my.telegram.org. | **Yes** |
| `TELEGRAM_API_HASH` | Your Application API Hash from my.telegram.org. | **Yes** |
| `SERVER_PORT` | The port the internal server listens on (default: 3000). | **Yes** |
| `SERVER_URL` | The public HTTPS URL of your instance (e.g., `https://logs.mysite.com`). Used for redirects and callbacks. | **Yes** |

## Reverse Proxy & SSL (Crucial)

To use Telegram Login (SSO), your application **must** be accessible via HTTPS. You should set up a reverse proxy like Nginx, Traefik, or Apache to handle SSL termination and forward requests to the container's port (e.g., 3000).

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

Once the bot is running and added to your groups (ensure it's an Admin if privacy settings require it, but generally "Turn off Group Privacy" in BotFather is sufficient), you can interact with it.

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
