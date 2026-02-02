#!/bin/bash

# Setup script for auto-starting RATS++ and RCON bots on Raspberry Pi boot
# This script will:
# 1. Install systemd services for both bots
# 2. Set up daily midnight reboot via cron

set -e

echo "==================================="
echo "RATS++ & RCON Bot Auto-Start Setup"
echo "==================================="
echo ""

# Get RCON bot directory
read -p "Enter the full path to your RCON bot directory: " RCON_PATH

# Validate paths
if [ ! -d "$RCON_PATH" ]; then
    echo "Error: RCON bot directory does not exist: $RCON_PATH"
    exit 1
fi

if [ ! -f "$RCON_PATH/package.json" ]; then
    echo "Error: No package.json found in RCON directory"
    exit 1
fi

echo ""
echo "Creating RCON bot service file..."

# Create RCON bot service file
cat > /tmp/rcon-bot.service << EOF
[Unit]
Description=RCON Discord Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$RCON_PATH
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=rcon-bot

# Environment variables (add any needed env vars here)
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "Creating RATS++ bot service file..."

# Create RATS++ bot service file
cat > /tmp/ratspp-bot.service << EOF
[Unit]
Description=RATS++ Discord Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/mtvproof/Desktop/RATS-plusplus
ExecStart=/usr/bin/npm start run
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ratspp-bot

# Environment variables (add any needed env vars here)
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "Installing systemd services (requires sudo)..."

# Copy service files to systemd directory
sudo cp /tmp/rcon-bot.service /etc/systemd/system/
sudo cp /tmp/ratspp-bot.service /etc/systemd/system/

# Set proper permissions
sudo chmod 644 /etc/systemd/system/rcon-bot.service
sudo chmod 644 /etc/systemd/system/ratspp-bot.service

# Reload systemd
echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable services to start on boot
echo "Enabling services to start on boot..."
sudo systemctl enable rcon-bot.service
sudo systemctl enable ratspp-bot.service

echo ""
echo "==================================="
echo "Setting up daily midnight reboot..."
echo "==================================="

# Add cron job for daily reboot at midnight
(crontab -l 2>/dev/null | grep -v "# RATS++ daily reboot"; echo "0 0 * * * /sbin/shutdown -r now # RATS++ daily reboot") | crontab -

echo ""
echo "✓ Setup complete!"
echo ""
echo "==================================="
echo "Available Commands:"
echo "==================================="
echo ""
echo "Start services:"
echo "  sudo systemctl start rcon-bot"
echo "  sudo systemctl start ratspp-bot"
echo ""
echo "Stop services:"
echo "  sudo systemctl stop rcon-bot"
echo "  sudo systemctl stop ratspp-bot"
echo ""
echo "Check status:"
echo "  sudo systemctl status rcon-bot"
echo "  sudo systemctl status ratspp-bot"
echo ""
echo "View logs:"
echo "  sudo journalctl -u rcon-bot -f"
echo "  sudo journalctl -u ratspp-bot -f"
echo ""
echo "Disable auto-start:"
echo "  sudo systemctl disable rcon-bot"
echo "  sudo systemctl disable ratspp-bot"
echo ""
echo "Remove daily reboot:"
echo "  crontab -e  (then delete the line with 'RATS++ daily reboot')"
echo ""
echo "==================================="
echo ""
echo "Would you like to start both bots now? (y/n)"
read -p "> " START_NOW

if [ "$START_NOW" = "y" ] || [ "$START_NOW" = "Y" ]; then
    echo ""
    echo "Starting bots..."
    sudo systemctl start rcon-bot
    sudo systemctl start ratspp-bot
    
    echo ""
    echo "Waiting 3 seconds..."
    sleep 3
    
    echo ""
    echo "RCON Bot Status:"
    sudo systemctl status rcon-bot --no-pager
    
    echo ""
    echo "RATS++ Bot Status:"
    sudo systemctl status ratspp-bot --no-pager
    
    echo ""
    echo "✓ Both bots are now running!"
fi

echo ""
echo "Setup complete! Both bots will start automatically on boot."
echo "Your Raspberry Pi will reboot daily at midnight."
