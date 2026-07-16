# RATS++ Docker Quick Start

This guide will get your RATS++ bot running in Docker in just a few minutes.

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

Edit the `.env` file in the repository root:

```bash
# Open .env in your favorite editor
nano .env
```

Set these required values:
```bash
RPP_DISCORD_TOKEN=your_actual_discord_bot_token
RPP_DISCORD_CLIENT_ID=your_actual_client_id
```

**Important**: Replace `your_actual_discord_bot_token` and `your_actual_client_id` with your real values from Step 1.

## Step 3: Validate Configuration (Optional but Recommended)

```bash
./docker-validate.sh
```

This will check that:
- Docker and Docker Compose are installed
- Your .env file is configured correctly
- Required files exist
- Ports are available

## Step 4: Deploy

### Option A: Using the automated script (Recommended)

```bash
./docker-deploy.sh
```

Then select option **1** to build and start the bot.

### Option B: Manual deployment

```bash
# Build and start the container
docker-compose up -d --build

# View logs
docker-compose logs -f
```

## Step 5: First-Time Setup

Once the bot is running:

1. **Invite the bot to your Discord server** using the OAuth2 URL from Discord Developer Portal
2. **Use the `/credentials` command** in Discord to pair your Rust+ account
3. **Connect to your Rust server** by following the pairing prompts
4. **Access the Web UI** at `http://localhost:3000`

## Common Commands

```bash
# View bot logs
docker-compose logs -f

# Stop the bot
docker-compose down

# Restart the bot
docker-compose restart

# Rebuild after code changes
docker-compose down
docker-compose build
docker-compose up -d

# Check bot status
docker-compose ps
```

## Data Persistence

Your bot data is stored in these directories (created automatically):
- `credentials/` - Rust+ authentication tokens
- `instances/` - Bot configuration per Discord server  
- `database/` - Bot database
- `logs/` - Application logs
- `maps/` - Generated map images

These directories persist even when you stop or rebuild the container.

## Troubleshooting

### Bot won't start
```bash
# Check the logs for errors
docker-compose logs

# Verify your .env settings
cat .env
```

### Can't see the Web UI
- Make sure port 3000 is not blocked by firewall
- Check that `RPP_WEBUI_ENABLED=true` in .env
- Try accessing `http://localhost:3000` in your browser

### Permission errors
```bash
# Fix permissions on data directories
sudo chown -R 1001:1001 credentials instances database logs maps
```

### Environment variables not working
Make sure you're editing the `.env` file in the repository root, not `.env.example`.

## Next Steps

- Read [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for production deployment
- Check the [main README](README.md) for bot features and commands
- Visit the [Web UI](http://localhost:3000) to configure settings

## Support

- Main Repository: https://github.com/mtvProof/RATS-plusplus  
- Original Project: https://github.com/FaiThiX/rustplusplus
- Discord Commands: See [docs/commands.md](docs/commands.md)

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
