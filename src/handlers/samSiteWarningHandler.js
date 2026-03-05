/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

const Map = require('../util/map.js');

module.exports = {
    handler: async function (rustplus, client) {
        try {
            const instance = client.getInstance(rustplus.guildId);
            const serverInfo = instance.serverList[rustplus.serverId];
            
            if (!serverInfo || !serverInfo.samLocations || serverInfo.samLocations.length === 0) {
                return; // No SAM locations configured
            }

            if (!rustplus.team || !rustplus.team.players) {
                return; // No team data
            }

            // Initialize tracking objects if they don't exist
            if (!rustplus.samWarningCooldowns) {
                rustplus.samWarningCooldowns = {}; // Track cooldowns per grid
            }
            if (!rustplus.playerPreviousPositions) {
                rustplus.playerPreviousPositions = {}; // Track previous positions for speed calculation
            }
            if (!rustplus.playerSamDistances) {
                rustplus.playerSamDistances = {}; // Track previous distance to each SAM per player
            }

            const now = Date.now();
            const mapSize = rustplus.info.mapSize;
            const gridSize = 150;
            const warningDistance = 400; // Distance in meters to trigger warning
            const cooldownMs = 30000; // 30 seconds cooldown per grid
            const heliSpeedThreshold = 10; // m/s

            // Clean up expired cooldowns
            for (const grid in rustplus.samWarningCooldowns) {
                if (now - rustplus.samWarningCooldowns[grid] >= cooldownMs) {
                    delete rustplus.samWarningCooldowns[grid];
                }
            }

            // Check each player
            for (const player of rustplus.team.players) {
                if (!player.isOnline || !player.isAlive) {
                    continue;
                }

                const steamId = player.steamId;
                const currentPos = { x: player.x, y: player.y, time: now };

                if (!rustplus.playerSamDistances[steamId]) {
                    rustplus.playerSamDistances[steamId] = {};
                }

                // Calculate speed if we have previous position
                let speed = 0;
                if (rustplus.playerPreviousPositions[steamId]) {
                    const prev = rustplus.playerPreviousPositions[steamId];
                    const timeDelta = (now - prev.time) / 1000; // Convert to seconds
                    
                    if (timeDelta > 0) {
                        const distance = Map.getDistance(prev.x, prev.y, currentPos.x, currentPos.y);
                        speed = distance / timeDelta;
                    }
                }

                // Update previous position
                rustplus.playerPreviousPositions[steamId] = currentPos;

                // Only check if player is flying (speed > threshold)
                if (speed <= heliSpeedThreshold) {
                    continue;
                }

                // Check each SAM location
                for (const gridLocation of serverInfo.samLocations) {
                    // Skip if on cooldown
                    if (rustplus.samWarningCooldowns[gridLocation]) {
                        continue;
                    }

                    // Convert grid to world coordinates
                    const samCoords = gridToWorld(gridLocation, mapSize, gridSize);
                    if (!samCoords) {
                        continue;
                    }

                    // Calculate distance to SAM site
                    const distance = Map.getDistance(player.x, player.y, samCoords.x, samCoords.y);
                    const previousDistance = rustplus.playerSamDistances[steamId][gridLocation];
                    const isApproaching = previousDistance !== undefined && distance < previousDistance;

                    // Store latest distance for next polling cycle
                    rustplus.playerSamDistances[steamId][gridLocation] = distance;

                    // If close enough, trigger warning
                    if (distance <= warningDistance && isApproaching) {
                        // Send warning 4 times (non-blocking)
                        const warningMessage = `:samsite: WARNING  ${gridLocation} :samsite:`;
                        for (let i = 0; i < 4; i++) {
                            rustplus.sendInGameMessage(warningMessage);
                        }

                        // Set cooldown for this grid
                        rustplus.samWarningCooldowns[gridLocation] = now;
                    }
                }
            }
        } catch (error) {
            rustplus.log(client.intlGet(null, 'errorCap'), 
                `SAM handler error: ${error.message}`);
            console.error('SAM handler full error:', error);
        }
    }
};

function gridToWorld(gridString, mapSize, gridSize) {
    // Parse grid string (e.g., "T15" -> col='T', row=15)
    const match = gridString.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;

    const colString = match[1].toUpperCase();
    const row = parseInt(match[2]);

    // Convert column letters back to number (A=0, B=1, ..., Z=25, AA=26, etc.)
    let colNum = 0;
    for (let i = 0; i < colString.length; i++) {
        colNum = colNum * 26 + (colString.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    colNum -= 1; // Adjust to 0-based

    // Convert cell coordinates to world coordinates (center of cell)
    const worldX = colNum * gridSize + gridSize / 2;
    const worldY = mapSize - (row * gridSize + gridSize / 2);

    return { x: worldX, y: worldY };
}
