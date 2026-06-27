# RATS++ Docker Quick Start

## Prerequisites

- Docker installed and running
- Docker Compose installed (usually comes with Docker Desktop)
- Your Discord Bot Token and Client ID

## Step 1: Get Your Discord Credentials

1. Go to https://discord.com/developers/applications
2. Select your application (or create a new one)
3. Copy your **Client ID** from the "General Information" page
4. Go to the "Bot" section
5. Copy your bot **Token** (click "Reset Token" if needed)

## Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your credentials
nano .env  # or use any text editor
```

Set these required values in `.env`:
```bash
RPP_DISCORD_TOKEN=your_discord_bot_token_here
RPP_DISCORD_CLIENT_ID=your_discord_client_id_here
```

## Step 3: Deploy

### Option A: Using the automated script (recommended)

```bash
./docker-deploy.sh
```

Then select option 1 for Docker Compose.

### Option B: Manual deployment

```bash
# Build and start the container
docker-compose up -d --build

# View logs
docker-compose logs -f
```

## Step 4: Access the Bot

- **Discord**: The bot should now be online in your Discord server
- **Web UI**: http://localhost:3000 (if enabled)

## Managing the Bot

### View Logs
```bash
docker-compose logs -f
```

### Stop the Bot
```bash
docker-compose down
```

### Restart the Bot
```bash
docker-compose restart
```

### Update the Bot
```bash
git pull
docker-compose down
docker-compose up -d --build
```

## Troubleshooting

### Bot doesn't start
- Check your Discord token and client ID are correct in `.env`
- View logs: `docker-compose logs -f`
- Ensure ports aren't already in use

### Bot disconnects frequently
- Check your internet connection
- Increase reconnect interval in `.env`:
  ```bash
  RPP_RECONNECT_INTERVAL=30000
  ```

## Data Persistence

Your data is stored in these directories:
- `./credentials` - Rust+ credentials
- `./instances` - Server configurations
- `./database` - Bot database
- `./logs` - Application logs
- `./maps` - Map images

**Important**: Back up these directories regularly!

## Next Steps

- See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for advanced configuration
- Configure your bot in Discord using slash commands
- Pair your Rust+ account with the bot

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Review [TROUBLESHOOTING-HANGS.md](TROUBLESHOOTING-HANGS.md)
3. Open an issue on GitHub
