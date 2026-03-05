/*
    Copyright (C) 2026 Alexander Emanuelsson (alexemanuelol)

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

/**
 * Manages persistence of event timers across bot reboots
 * Saves: Deepsea, Cargoship, Patrol Helicopter, Large oilrig, Small oilrig
 */

module.exports = {
    /**
     * Saves event state to instance file
     * @param {Object} instance - Instance object
     * @param {Object} mapMarkers - MapMarkers object
     */
    saveEventState: function (instance, mapMarkers) {
        if (!instance || !mapMarkers) return;

        if (!instance.eventTimers) {
            instance.eventTimers = {};
        }

        // Save Deepsea event timers
        instance.eventTimers.timeSinceDeepSeaWasOnMap = mapMarkers.timeSinceDeepSeaWasOnMap ? 
            mapMarkers.timeSinceDeepSeaWasOnMap.getTime() : null;
        instance.eventTimers.deepSeaSpawnedAt = mapMarkers.deepSeaSpawnedAt ? 
            mapMarkers.deepSeaSpawnedAt.getTime() : null;
        instance.eventTimers.deepSeaRespawnAt = mapMarkers.deepSeaRespawnAt;
        instance.eventTimers.deepSeaLastSpawnAt = mapMarkers.deepSeaLastSpawnAt ? 
            mapMarkers.deepSeaLastSpawnAt.getTime() : null;
        instance.eventTimers.isDeepSeaActive = mapMarkers.isDeepSeaActive;

        // Save Cargoship event timers
        instance.eventTimers.timeSinceCargoShipWasOut = mapMarkers.timeSinceCargoShipWasOut ? 
            mapMarkers.timeSinceCargoShipWasOut.getTime() : null;

        // Save Patrol Helicopter event timers
        instance.eventTimers.timeSincePatrolHelicopterWasOnMap = mapMarkers.timeSincePatrolHelicopterWasOnMap ? 
            mapMarkers.timeSincePatrolHelicopterWasOnMap.getTime() : null;
        instance.eventTimers.timeSincePatrolHelicopterWasDestroyed = mapMarkers.timeSincePatrolHelicopterWasDestroyed ? 
            mapMarkers.timeSincePatrolHelicopterWasDestroyed.getTime() : null;

        // Save Large Oil Rig event timers
        instance.eventTimers.timeSinceLargeOilRigWasTriggered = mapMarkers.timeSinceLargeOilRigWasTriggered ? 
            mapMarkers.timeSinceLargeOilRigWasTriggered.getTime() : null;
        instance.eventTimers.crateLargeOilRigLocation = mapMarkers.crateLargeOilRigLocation;

        // Save Small Oil Rig event timers
        instance.eventTimers.timeSinceSmallOilRigWasTriggered = mapMarkers.timeSinceSmallOilRigWasTriggered ? 
            mapMarkers.timeSinceSmallOilRigWasTriggered.getTime() : null;
        instance.eventTimers.crateSmallOilRigLocation = mapMarkers.crateSmallOilRigLocation;
    },

    /**
     * Restores event state from instance file
     * @param {Object} instance - Instance object
     * @param {Object} mapMarkers - MapMarkers object
     */
    restoreEventState: function (instance, mapMarkers) {
        if (!instance || !mapMarkers || !instance.eventTimers) return;

        const timers = instance.eventTimers;

        // Restore Deepsea event timers
        if (timers.timeSinceDeepSeaWasOnMap) {
            mapMarkers.timeSinceDeepSeaWasOnMap = new Date(timers.timeSinceDeepSeaWasOnMap);
        }
        if (timers.deepSeaSpawnedAt) {
            mapMarkers.deepSeaSpawnedAt = new Date(timers.deepSeaSpawnedAt);
        }
        if (timers.deepSeaRespawnAt !== undefined && timers.deepSeaRespawnAt !== null) {
            mapMarkers.deepSeaRespawnAt = timers.deepSeaRespawnAt;
        }
        if (timers.deepSeaLastSpawnAt) {
            mapMarkers.deepSeaLastSpawnAt = new Date(timers.deepSeaLastSpawnAt);
        }
        if (timers.isDeepSeaActive !== undefined && timers.isDeepSeaActive !== null) {
            mapMarkers.isDeepSeaActive = timers.isDeepSeaActive;
        }

        // Restore Cargoship event timers
        if (timers.timeSinceCargoShipWasOut) {
            mapMarkers.timeSinceCargoShipWasOut = new Date(timers.timeSinceCargoShipWasOut);
        }

        // Restore Patrol Helicopter event timers
        if (timers.timeSincePatrolHelicopterWasOnMap) {
            mapMarkers.timeSincePatrolHelicopterWasOnMap = new Date(timers.timeSincePatrolHelicopterWasOnMap);
        }
        if (timers.timeSincePatrolHelicopterWasDestroyed) {
            mapMarkers.timeSincePatrolHelicopterWasDestroyed = new Date(timers.timeSincePatrolHelicopterWasDestroyed);
        }

        // Restore Large Oil Rig event timers
        if (timers.timeSinceLargeOilRigWasTriggered) {
            mapMarkers.timeSinceLargeOilRigWasTriggered = new Date(timers.timeSinceLargeOilRigWasTriggered);
        }
        if (timers.crateLargeOilRigLocation) {
            mapMarkers.crateLargeOilRigLocation = timers.crateLargeOilRigLocation;
        }

        // Restore Small Oil Rig event timers
        if (timers.timeSinceSmallOilRigWasTriggered) {
            mapMarkers.timeSinceSmallOilRigWasTriggered = new Date(timers.timeSinceSmallOilRigWasTriggered);
        }
        if (timers.crateSmallOilRigLocation) {
            mapMarkers.crateSmallOilRigLocation = timers.crateSmallOilRigLocation;
        }
    }
};
