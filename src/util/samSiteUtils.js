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

const Map = require('./map.js');

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
        const prevX = Number(player?.x);
        const prevY = Number(player?.y);
        const currX = Number(playerUpdated?.x);
        const currY = Number(playerUpdated?.y);

        if (!Number.isFinite(prevX) || !Number.isFinite(prevY) || !Number.isFinite(currX) || !Number.isFinite(currY)) {
            return false;
        }

        const distanceMoved = Map.getDistance(prevX, prevY, currX, currY);

        const speedPerSecond = distanceMoved / Math.max(timeDeltaSeconds, 0.1);

        // Practical threshold for minicopter/scrap helicopter movement.
        // (Running players are much slower over polling windows.)
        const helicopterSpeedThreshold = 25; // u/s

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
    getGridFromCoordinates: function (x, y, mapSize) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(mapSize)) return null;
        return Map.getGridPos(x, y, mapSize);
    },

    /**
     * Checks if a player at current coordinates is heading toward a SAM site grid
     * Uses simple proximity check - if player's current grid matches SAM site grid
     * @param {Object} playerUpdated - Current player position data
     * @param {Array} samSites - Array of SAM site grid strings (e.g., ['C25', 'D30'])
     * @returns {string|null} - SAM site grid if player is heading toward one, null otherwise
     */
    checkPlayerHeadingTowardSamSite: function (player, playerUpdated, samSites, mapSize) {
        if (!samSites || samSites.length === 0 || !Number.isFinite(mapSize)) {
            return null;
        }

        const prevX = Number(player?.x);
        const prevY = Number(player?.y);
        const currX = Number(playerUpdated?.x);
        const currY = Number(playerUpdated?.y);
        if (!Number.isFinite(prevX) || !Number.isFinite(prevY) || !Number.isFinite(currX) || !Number.isFinite(currY)) {
            return null;
        }

        const currentGrid = module.exports.getGridFromCoordinates(currX, currY, mapSize);
        if (!currentGrid) return null;

        const normalizedSamSites = samSites
            .map(module.exports.normalizeGrid)
            .filter((g) => g !== null);

        if (normalizedSamSites.includes(currentGrid)) {
            return currentGrid;
        }

        const gridDiameter = mapSize / Math.max(1, Math.floor(mapSize / Map.gridDiameter));
        let bestMatch = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const samGrid of normalizedSamSites) {
            const center = module.exports.gridToCenterCoordinates(samGrid, mapSize);
            if (!center) continue;

            const distanceNow = Map.getDistance(currX, currY, center.x, center.y);
            const distancePrev = Map.getDistance(prevX, prevY, center.x, center.y);

            // Warn when within ~5 grid squares (doubled from 2.5) or getting closer
            if (distanceNow <= (gridDiameter * 5)) {
                if (distanceNow < bestDistance) {
                    bestDistance = distanceNow;
                    bestMatch = samGrid;
                }
            }
        }

        if (bestMatch) return bestMatch;

        const adjacentGrids = module.exports.getAdjacentGrids(currentGrid);
        for (const adjacentGrid of adjacentGrids) {
            if (normalizedSamSites.includes(adjacentGrid)) return adjacentGrid;
        }

        return null;
    },

    normalizeGrid: function (grid) {
        if (!grid) return null;
        const normalized = String(grid).trim().toUpperCase();
        return /^([A-Z]+)(\d+)$/.test(normalized) ? normalized : null;
    },

    lettersToNumber: function (letters) {
        let value = 0;
        for (const ch of letters) {
            value = (value * 26) + (ch.charCodeAt(0) - 64);
        }
        return value;
    },

    gridToCenterCoordinates: function (grid, mapSize) {
        const normalized = module.exports.normalizeGrid(grid);
        if (!normalized || !Number.isFinite(mapSize)) return null;

        const match = normalized.match(/^([A-Z]+)(\d+)$/);
        if (!match) return null;

        const letters = match[1];
        const row = parseInt(match[2]);

        const numberOfGrids = Math.max(1, Math.floor(mapSize / Map.gridDiameter));
        const gridDiameter = mapSize / numberOfGrids;
        const col = module.exports.lettersToNumber(letters) - 1;

        if (col < 0 || col >= numberOfGrids || row < 0 || row >= numberOfGrids) return null;

        const x = ((col + 0.5) * gridDiameter);
        const y = (mapSize - ((row + 0.5) * gridDiameter));

        return { x, y };
    },

    isHeadingTowardTarget: function (prevX, prevY, currX, currY, targetX, targetY) {
        const moveX = currX - prevX;
        const moveY = currY - prevY;
        const moveMag = Math.sqrt((moveX * moveX) + (moveY * moveY));
        if (moveMag < 1) return false;

        const toTargetX = targetX - currX;
        const toTargetY = targetY - currY;
        const targetMag = Math.sqrt((toTargetX * toTargetX) + (toTargetY * toTargetY));
        if (targetMag < 1) return true;

        const dot = ((moveX * toTargetX) + (moveY * toTargetY)) / (moveMag * targetMag);
        return dot >= 0.65;
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
     * Checks if a warning should be sent based on counter system
     * Sends warning up to maxWarnings times per approach to the SAM site
     * @param {Map} warningCounters - Map of {playerId: {grid: warningCount}}
     * @param {string} playerId - Steam ID of player
     * @param {string} grid - Grid coordinate
     * @param {number} maxWarnings - Maximum number of warnings per approach (default 4)
     * @returns {boolean} - True if warning count is less than max
     */
    shouldSendWarning: function (warningCounters, playerId, grid, maxWarnings = 4) {
        if (!warningCounters.has(playerId)) {
            warningCounters.set(playerId, {});
        }

        const playerCounters = warningCounters.get(playerId);
        const currentCount = (playerCounters[grid] || 0);

        if (currentCount < maxWarnings) {
            playerCounters[grid] = currentCount + 1;
            return true;
        }

        return false;
    },

    /**
     * Resets warning counter for a player when they leave danger zone
     * @param {Map} warningCounters - Map of {playerId: {grid: warningCount}}
     * @param {string} playerId - Steam ID of player
     */
    resetWarningCounters: function (warningCounters, playerId) {
        if (warningCounters.has(playerId)) {
            warningCounters.set(playerId, {});
        }
    }
};
