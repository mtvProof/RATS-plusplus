/*
    Copyright (C) 2023 Alexander Emanuelsson (alexemanuelol)

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

module.exports = {
    /**
     * Detects if a player is flying a helicopter based on movement speed
     * Helicopters move at high speeds (typically > 8 m/s based on Rust movement speeds)
     * @param {Player} player - The player object with previous position
     * @param {Object} playerUpdated - The updated player data from server
     * @param {number} timeDeltaSeconds - Time elapsed since last update in seconds
     * @returns {boolean} - True if player appears to be flying a helicopter
     */
    isPlayerFlyingHelicopter: function (player, playerUpdated, timeDeltaSeconds = 1) {
        if (!player.pos || !playerUpdated.x || !playerUpdated.y) {
            return false;
        }

        // Calculate distance moved
        const dx = playerUpdated.x - player.pos.x;
        const dy = playerUpdated.y - player.pos.y;
        const distanceMoved = Math.sqrt(dx * dx + dy * dy);

        // Calculate speed in units/second
        const speedPerSecond = distanceMoved / Math.max(timeDeltaSeconds, 0.1);

        // Helicopter speed threshold: > 8 units/second (adjust based on your observations)
        // Walking speed is ~5.7 u/s, running ~9 u/s, helicopter is much faster
        const helicopterSpeedThreshold = 12; // u/s

        return speedPerSecond > helicopterSpeedThreshold;
    },

    /**
     * Gets the grid location from x, y coordinates
     * Rust maps are typically 2048x2048, divided into a grid system
     * Each grid square is roughly 50 units
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} gridSize - Size of each grid square in units (default 50)
     * @returns {string} - Grid coordinates like "C25"
     */
    getGridFromCoordinates: function (x, y, gridSize = 50) {
        // Rust coordinate system: origin is at (0, 0), max is roughly (2048, 2048)
        // Grid letters: A-Z (columns)
        // Grid numbers: 0-51 or similar (rows)

        // Calculate grid position
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);

        // Convert to letter + number format
        // Columns: A-Z (0-25)
        const maxGridIndex = 51; // Adjust based on your map size
        
        const colIndex = Math.max(0, Math.min(25, gridX % 26));
        const rowIndex = Math.max(0, Math.min(maxGridIndex, gridY));

        const columnLetter = String.fromCharCode(65 + colIndex); // A=65 in ASCII
        const rowNumber = rowIndex;

        return `${columnLetter}${rowNumber}`;
    },

    /**
     * Checks if a player at current coordinates is heading toward a SAM site grid
     * Uses simple proximity check - if player's current grid matches SAM site grid
     * @param {Object} playerUpdated - Current player position data
     * @param {Array} samSites - Array of SAM site grid strings (e.g., ['C25', 'D30'])
     * @returns {string|null} - SAM site grid if player is heading toward one, null otherwise
     */
    checkPlayerHeadingTowardSamSite: function (playerUpdated, samSites) {
        if (!samSites || samSites.length === 0) {
            return null;
        }

        const currentGrid = module.exports.getGridFromCoordinates(playerUpdated.x, playerUpdated.y);

        // Check if current grid or adjacent grids match a SAM site
        if (samSites.includes(currentGrid)) {
            return currentGrid;
        }

        // Also check adjacent grids for proximity warning
        const adjacentGrids = module.exports.getAdjacentGrids(currentGrid);
        for (const adjacentGrid of adjacentGrids) {
            if (samSites.includes(adjacentGrid)) {
                return adjacentGrid;
            }
        }

        return null;
    },

    /**
     * Gets all adjacent grid coordinates to a given grid
     * @param {string} grid - Grid coordinate (e.g., "C25")
     * @returns {Array<string>} - Array of adjacent grid coordinates
     */
    getAdjacentGrids: function (grid) {
        const columnLetter = grid.charAt(0);
        const rowNumber = parseInt(grid.substring(1));

        const colIndex = columnLetter.charCodeAt(0) - 65; // Convert letter to 0-25
        const adjacentGrids = [];

        // All 8 adjacent cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue; // Skip center

                const newColIndex = colIndex + dx;
                const newRowNumber = rowNumber + dy;

                // Only add if within valid grid bounds
                if (newColIndex >= 0 && newColIndex <= 25 && newRowNumber >= 0 && newRowNumber <= 51) {
                    const newLetter = String.fromCharCode(65 + newColIndex);
                    adjacentGrids.push(`${newLetter}${newRowNumber}`);
                }
            }
        }

        return adjacentGrids;
    },

    /**
     * Generates warning message for SAM site
     * @param {string} grid - Grid coordinate of the SAM site
     * @param {string} guildId - Guild ID for translation
     * @param {Object} client - Client object for intlGet
     * @returns {string} - Warning message
     */
    generateSamWarning: function (grid, guildId, client) {
        return client.intlGet(guildId, 'samSiteWarning', { grid: grid });
    },

    /**
     * Checks if a warning has been sent recently to avoid spam
     * @param {Map} warningCooldowns - Map of {playerId: {grid: lastWarnTime}}
     * @param {string} playerId - Steam ID of player
     * @param {string} grid - Grid coordinate
     * @param {number} cooldownSeconds - Minimum seconds between warnings (default 5)
     * @returns {boolean} - True if enough time has passed since last warning
     */
    shouldSendWarning: function (warningCooldowns, playerId, grid, cooldownSeconds = 5) {
        const now = Date.now();

        if (!warningCooldowns.has(playerId)) {
            warningCooldowns.set(playerId, {});
        }

        const playerCooldowns = warningCooldowns.get(playerId);
        const lastWarnTime = playerCooldowns[grid] || 0;
        const timeSinceLastWarn = (now - lastWarnTime) / 1000;

        if (timeSinceLastWarn >= cooldownSeconds) {
            playerCooldowns[grid] = now;
            return true;
        }

        return false;
    }
};
