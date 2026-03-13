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

const Constants = require('../util/constants.js');
const Map = require('../util/map.js');
const Timer = require('../util/timer');

const DEEP_SEA_ACTIVE_MS = 3 * 60 * 60 * 1000;
const DEEP_SEA_RESPAWN_MIN_MS = 90 * 60 * 1000;
const DEEP_SEA_RESPAWN_MAX_MS = 150 * 60 * 1000;
const DEEP_SEA_PREPARE_LEAD_MS = 30 * 60 * 1000;

class MapMarkers {
    constructor(mapMarkers, rustplus, client) {
        this._markers = mapMarkers.markers;

        this._rustplus = rustplus;
        this._client = client;

        this._types = {
            Player: 1,
            Explosion: 2,
            VendingMachine: 3,
            CH47: 4,
            CargoShip: 5,
            Crate: 6,
            GenericRadius: 7,
            PatrolHelicopter: 8,
            TravelingVendor: 9
        }

        this._players = [];
        this._vendingMachines = [];
        this._ch47s = [];
        this._cargoShips = [];
        this._genericRadiuses = [];
        this._patrolHelicopters = [];
        this._travelingVendors = [];
        this._deepSea = [];

        /* Timers */
        this.cargoShipEgressTimers = new Object();
        this.crateSmallOilRigTimer = null;
        this.crateSmallOilRigLocation = null;
        this.crateLargeOilRigTimer = null;
        this.crateLargeOilRigLocation = null;

        /* Event dates */
        this.timeSinceCargoShipWasOut = null;
        this.timeSinceCH47WasOut = null;
        this.timeSinceSmallOilRigWasTriggered = null;
        this.timeSinceLargeOilRigWasTriggered = null;
        this.timeSincePatrolHelicopterWasOnMap = null;
        this.timeSincePatrolHelicopterWasDestroyed = null;
        this.timeSinceTravelingVendorWasOnMap = null;
        this.timeSinceDeepSeaWasOnMap = null;

        /* Event location */
        this.patrolHelicopterDestroyedLocation = null;
        this.deepSeaLastLocation = null;
        this.deepSeaLastSide = null;
        this.deepSeaSpawnedAt = null;
        this.deepSeaRespawnAt = null;
        this.deepSeaLastSpawnAt = null;

        /* Vending Machine variables */
        this.knownVendingMachines = [];

        /* Deep Sea timers */
        this.deepSeaPrepairTimer = null;

        // Load event times from instance file
        this.loadEventTimes();

        this.updateMapMarkers(mapMarkers);
    }

    /* Getters and Setters */
    get markers() { return this._markers; }
    set markers(markers) { this._markers = markers; }
    get rustplus() { return this._rustplus; }
    set rustplus(rustplus) { this._rustplus = rustplus; }
    get client() { return this._client; }
    set client(client) { this._client = client; }
    get types() { return this._types; }
    set types(types) { this._types = types; }
    get players() { return this._players; }
    set players(players) { this._players = players; }
    get vendingMachines() { return this._vendingMachines; }
    set vendingMachines(vendingMachines) { this._vendingMachines = vendingMachines; }
    get ch47s() { return this._ch47s; }
    set ch47s(ch47s) { this._ch47s = ch47s; }
    get cargoShips() { return this._cargoShips; }
    set cargoShips(cargoShips) { this._cargoShips = cargoShips; }
    get genericRadiuses() { return this._genericRadiuses; }
    set genericRadiuses(genericRadiuses) { this._genericRadiuses = genericRadiuses; }
    get patrolHelicopters() { return this._patrolHelicopters; }
    set patrolHelicopters(patrolHelicopters) { this._patrolHelicopters = patrolHelicopters; }
    get travelingVendors() { return this._travelingVendors; }
    set travelingVendors(travelingVendors) { this._travelingVendors = travelingVendors; }
    get deepSea() { return this._deepSea; }
    set deepSea(deepSea) { this._deepSea = deepSea; }

    getType(type) {
        if (!Object.values(this.types).includes(type)) {
            return null;
        }

        switch (type) {
            case this.types.Player: {
                return this.players;
            } break;

            case this.types.VendingMachine: {
                return this.vendingMachines;
            } break;

            case this.types.CH47: {
                return this.ch47s;
            } break;

            case this.types.CargoShip: {
                return this.cargoShips;
            } break;

            case this.types.GenericRadius: {
                return this.genericRadiuses;
            } break;

            case this.types.PatrolHelicopter: {
                return this.patrolHelicopters;
            } break;

            case this.types.TravelingVendor: {
                return this.travelingVendors;
            } break;

            default: {
                return null;
            } break;
        }
    }

    getMarkersOfType(type, markers) {
        if (!Object.values(this.types).includes(type)) {
            return [];
        }

        let markersOfType = [];
        for (let marker of markers) {
            if (marker.type === type) {
                markersOfType.push(marker);
            }
        }

        return markersOfType;
    }

    getMarkerByTypeId(type, id) {
        return this.getType(type).find(e => e.id === id);
    }

    getMarkerByTypeXY(type, x, y) {
        return this.getType(type).find(e => e.x === x && e.y === y);
    }

    isMarkerPresentByTypeId(type, id, markers = null) {
        if (markers) {
            return markers.some(e => e.id === id);
        }
        else {
            return this.getType(type).some(e => e.id === id);
        }
    }

    getNewMarkersOfTypeId(type, markers) {
        let newMarkersOfType = [];

        for (let marker of this.getMarkersOfType(type, markers)) {
            if (!this.isMarkerPresentByTypeId(type, marker.id)) {
                newMarkersOfType.push(marker);
            }
        }

        return newMarkersOfType
    }

    getLeftMarkersOfTypeId(type, markers) {
        let leftMarkersOfType = this.getType(type).slice();

        for (let marker of this.getMarkersOfType(type, markers)) {
            if (this.isMarkerPresentByTypeId(type, marker.id)) {
                leftMarkersOfType = leftMarkersOfType.filter(e => e.id !== marker.id);
            }
        }

        return leftMarkersOfType;
    }

    getRemainingMarkersOfTypeId(type, markers) {
        let remainingMarkersOfType = [];

        for (let marker of markers) {
            if (this.isMarkerPresentByTypeId(type, marker.id)) {
                remainingMarkersOfType.push(marker);
            }
        }

        return remainingMarkersOfType;
    }

    isMarkerPresentByTypeXY(type, x, y, markers = null) {
        if (markers) {
            return markers.some(e => e.x === x && e.y === y);
        }
        else {
            return this.getType(type).some(e => e.x === x && e.y === y);
        }
    }

    getNewMarkersOfTypeXY(type, markers) {
        let newMarkersOfType = [];

        for (let marker of this.getMarkersOfType(type, markers)) {
            if (!this.isMarkerPresentByTypeXY(type, marker.x, marker.y)) {
                newMarkersOfType.push(marker);
            }
        }

        return newMarkersOfType;
    }

    getLeftMarkersOfTypeXY(type, markers) {
        let leftMarkersOfType = this.getType(type).slice();

        for (let marker of this.getMarkersOfType(type, markers)) {
            if (this.isMarkerPresentByTypeXY(type, marker.x, marker.y)) {
                leftMarkersOfType = leftMarkersOfType.filter(e => e.x !== marker.x || e.y !== marker.y);
            }
        }

        return leftMarkersOfType;
    }

    getRemainingMarkersOfTypeXY(type, markers) {
        let remainingMarkersOfType = [];

        for (let marker of markers) {
            if (this.isMarkerPresentByTypeXY(type, marker.x, marker.y)) {
                remainingMarkersOfType.push(marker);
            }
        }

        return remainingMarkersOfType;
    }

    getDeepSeaSide(x, y, mapSize) {
        // Determine which side of the map the deep sea is closest to
        // In RustPlus coordinates: X is horizontal (west-east), Y is vertical (south-north)
        const northDistance = Math.max(0, y - mapSize);
        const southDistance = Math.max(0, -y);
        const eastDistance = Math.max(0, x - mapSize);
        const westDistance = Math.max(0, -x);

        // Prioritize cardinal directions (north/south) over diagonal edges
        const verticalMax = Math.max(northDistance, southDistance);
        const horizontalMax = Math.max(eastDistance, westDistance);

        let result;
        if (verticalMax > horizontalMax) {
            result = northDistance > southDistance ? 'north' : 'south';
        } else if (horizontalMax > verticalMax) {
            result = eastDistance > westDistance ? 'west' : 'east';
        } else if (verticalMax > 0) {
            result = northDistance > southDistance ? 'north' : 'south';
        } else if (horizontalMax > 0) {
            result = eastDistance > westDistance ? 'west' : 'east';
        } else {
            result = null;
        }

        return result;
    }

    getDeepSeaSideLabel(side) {
        if (!side) return null;

        switch (side) {
            case 'north': return this.client.intlGet(this.rustplus.guildId, 'deepSeaSideNorth');
            case 'south': return this.client.intlGet(this.rustplus.guildId, 'deepSeaSideSouth');
            case 'east': return this.client.intlGet(this.rustplus.guildId, 'deepSeaSideEast');
            case 'west': return this.client.intlGet(this.rustplus.guildId, 'deepSeaSideWest');
            default: return null;
        }
    }

    /* Update event map markers */

    updateMapMarkers(mapMarkers) {
        this.updatePlayers(mapMarkers);
        this.updateCargoShips(mapMarkers);
        this.updatePatrolHelicopters(mapMarkers);
        this.updateCH47s(mapMarkers);
        this.updateVendingMachines(mapMarkers);
        this.updateGenericRadiuses(mapMarkers);
        this.updateTravelingVendors(mapMarkers);
    }

    updatePlayers(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.Player, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.Player, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.Player, mapMarkers.markers);

        /* Player markers that are new. */
        for (let marker of newMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            marker.location = pos;

            this.players.push(marker);
        }

        /* Player markers that have left. */
        for (let marker of leftMarkers) {
            this.players = this.players.filter(e => e.id !== marker.id);
        }

        /* Player markers that still remains. */
        for (let marker of remainingMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let player = this.getMarkerByTypeId(this.types.Player, marker.id);

            player.x = marker.x;
            player.y = marker.y;
            player.location = pos;
        }
    }

    updateVendingMachines(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeXY(this.types.VendingMachine, mapMarkers.markers);
        const mapSize = this.rustplus.info.correctedMapSize;
        const isPrimary = this.rustplus.instanceLabel !== 'secondary';
        let deepSeaSpawnHandled = false;
        let deepSeaLeftHandled = false;

        /* VendingMachine markers that are new. */
        for (let marker of newMarkers) {
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            marker.location = pos;

            const isDeepSea = Map.isOutsideGridSystem(marker.x, marker.y, mapSize);
            marker.isDeepSea = isDeepSea;

            if (isDeepSea) {
                const now = new Date();
                const side = this.getDeepSeaSide(marker.x, marker.y, mapSize);
                const sideLabel = this.getDeepSeaSideLabel(side);

                if (!deepSeaSpawnHandled) {
                    if (isPrimary && !this.rustplus.isFirstPoll) {
                        this.rustplus.sendEvent(
                            this.rustplus.notificationSettings.deepSeaDetectedSetting,
                            this.client.intlGet(this.rustplus.guildId, 'deepSeaDetected', { side: sideLabel }),
                            'deepsea',
                            Constants.COLOR_DEEP_SEA_DETECTED);
                    }

                    this.deepSeaLastLocation = pos.string;
                    this.deepSeaLastSide = side || this.deepSeaLastSide;
                    this.isDeepSeaActive = true;

                    // Preserve restored spawn state on first poll after reboot.
                    // If there is no prior state, use current time so Deep Sea is treated as active.
                    if (!this.deepSeaSpawnedAt) {
                        this.deepSeaSpawnedAt = now;
                    }
                    this.deepSeaLastSpawnAt = this.deepSeaSpawnedAt || now;
                    this.deepSeaRespawnAt = null;
                    this.timeSinceDeepSeaWasOnMap = null;

                    if (this.deepSeaPrepairTimer) {
                        this.deepSeaPrepairTimer.stop();
                        this.deepSeaPrepairTimer = null;
                    }

                    deepSeaSpawnHandled = true;
                }

                this.deepSea.push(marker);
            }
            else {
                if (!this.rustplus.isFirstPoll) {
                    if (!this.knownVendingMachines.some(e => e.x === marker.x && e.y === marker.y)) {
                        // Never broadcast vending machine detections into in-game team chat to avoid spam loops
                        const vmSetting = {
                            ...this.rustplus.notificationSettings.vendingMachineDetectedSetting,
                            inGame: false
                        };

                        this.rustplus.sendEvent(
                            vmSetting,
                            this.client.intlGet(this.rustplus.guildId, 'newVendingMachine', { location: pos.string }),
                            null,
                            Constants.COLOR_NEW_VENDING_MACHINE);
                    }
                }
            }

            this.knownVendingMachines.push({ x: marker.x, y: marker.y });
            this.vendingMachines.push(marker);
        }

        /* VendingMachine markers that have left. */
        for (let marker of leftMarkers) {
            const isDeepSea = marker.isDeepSea || Map.isOutsideGridSystem(marker.x, marker.y, mapSize);

            if (isDeepSea) {
                const side = this.getDeepSeaSide(marker.x, marker.y, mapSize) || this.deepSeaLastSide;
                const sideLabel = this.getDeepSeaSideLabel(side);

                if (isPrimary && !deepSeaLeftHandled) {
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.deepSeaLeftSetting,
                        this.client.intlGet(this.rustplus.guildId, 'deepSeaLeftMap', { side: sideLabel }),
                        'deepsea',
                        Constants.COLOR_DEEP_SEA_LEFT);
                }

                if (!deepSeaLeftHandled) {
                    this.deepSeaLastSide = side || this.deepSeaLastSide;
                    this.isDeepSeaActive = false;
                    this.timeSinceDeepSeaWasOnMap = new Date();
                    this.deepSeaSpawnedAt = null;
                    this.deepSeaRespawnAt = new Date(this.timeSinceDeepSeaWasOnMap.getTime() + DEEP_SEA_RESPAWN_MIN_MS);
                    this.persistEventTimes();
                }

                this.deepSea = this.deepSea.filter(e => e.x !== marker.x || e.y !== marker.y);
                deepSeaLeftHandled = true;
            }

            this.vendingMachines = this.vendingMachines.filter(e => e.x !== marker.x || e.y !== marker.y);
        }

        if (isPrimary && deepSeaLeftHandled) {
            this.scheduleDeepSeaPrepair();
        }
        else if (isPrimary && !this.deepSeaSpawnedAt && this.deepSea.length === 0 &&
            this.timeSinceDeepSeaWasOnMap && !this.deepSeaPrepairTimer) {
            this.scheduleDeepSeaPrepair();
        }

        /* VendingMachine markers that still remains. */
        for (let marker of remainingMarkers) {
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let vendingMachine = this.getMarkerByTypeXY(this.types.VendingMachine, marker.x, marker.y);

            if (!vendingMachine) {
                // State got out of sync; add the marker back to keep map updates safe
                marker.location = pos;
                this.vendingMachines.push(marker);
                continue;
            }

            const isDeepSea = vendingMachine.isDeepSea || Map.isOutsideGridSystem(marker.x, marker.y, mapSize);
            vendingMachine.isDeepSea = isDeepSea;

            vendingMachine.id = marker.id;
            vendingMachine.location = pos;
            vendingMachine.sellOrders = marker.sellOrders;

            if (isDeepSea) {
                this.deepSeaLastLocation = pos.string;
                this.deepSeaLastSide = this.getDeepSeaSide(marker.x, marker.y, mapSize) || this.deepSeaLastSide;
            }
        }
    }

    updateCH47s(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.CH47, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.CH47, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.CH47, mapMarkers.markers);

        /* CH47 markers that are new. */
        for (let marker of newMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            marker.location = pos;

            let smallOilRig = [], largeOilRig = [];
            for (let monument of this.rustplus.map.monuments) {
                if (monument.token === 'oil_rig_small') {
                    smallOilRig.push({ x: monument.x, y: monument.y })
                }
                else if (monument.token === 'large_oil_rig') {
                    largeOilRig.push({ x: monument.x, y: monument.y })
                }
            }

            let found = false;
            if (!this.rustplus.isFirstPoll) {
                for (let oilRig of smallOilRig) {
                    if (Map.getDistance(marker.x, marker.y, oilRig.x, oilRig.y) <=
                        Constants.OIL_RIG_CHINOOK_47_MAX_SPAWN_DISTANCE) {
                        found = true;
                        let oilRigLocation = Map.getPos(oilRig.x, oilRig.y, mapSize, this.rustplus);
                        marker.ch47Type = 'smallOilRig';

                        this.rustplus.sendEvent(
                            this.rustplus.notificationSettings.heavyScientistCalledSetting,
                            this.client.intlGet(this.rustplus.guildId, 'heavyScientistsCalledSmall',
                                { location: oilRigLocation.location }),
                            'small',
                            Constants.COLOR_HEAVY_SCIENTISTS_CALLED_SMALL,
                            this.rustplus.isFirstPoll,
                            'small_oil_rig_logo.png');

                        if (this.crateSmallOilRigTimer) {
                            this.crateSmallOilRigTimer.stop();
                        }

                        let instance = this.client.getInstance(this.rustplus.guildId);
                        this.crateSmallOilRigTimer = new Timer.timer(
                            this.notifyCrateSmallOilRigOpen.bind(this),
                            instance.serverList[this.rustplus.serverId].oilRigLockedCrateUnlockTimeMs,
                            oilRigLocation.location);
                        this.crateSmallOilRigTimer.start();

                        this.crateSmallOilRigLocation = oilRigLocation.location;
                        this.timeSinceSmallOilRigWasTriggered = new Date();
                        this.persistEventTimes();
                        break;
                    }
                }
            }

            if (!found && !this.rustplus.isFirstPoll) {
                for (let oilRig of largeOilRig) {
                    if (Map.getDistance(marker.x, marker.y, oilRig.x, oilRig.y) <=
                        Constants.OIL_RIG_CHINOOK_47_MAX_SPAWN_DISTANCE) {
                        found = true;
                        let oilRigLocation = Map.getPos(oilRig.x, oilRig.y, mapSize, this.rustplus);
                        marker.ch47Type = 'largeOilRig';

                        this.rustplus.sendEvent(
                            this.rustplus.notificationSettings.heavyScientistCalledSetting,
                            this.client.intlGet(this.rustplus.guildId, 'heavyScientistsCalledLarge',
                                { location: oilRigLocation.location }),
                            'large',
                            Constants.COLOR_HEAVY_SCIENTISTS_CALLED_LARGE,
                            this.rustplus.isFirstPoll,
                            'large_oil_rig_logo.png');

                        if (this.crateLargeOilRigTimer) {
                            this.crateLargeOilRigTimer.stop();
                        }

                        let instance = this.client.getInstance(this.rustplus.guildId);
                        this.crateLargeOilRigTimer = new Timer.timer(
                            this.notifyCrateLargeOilRigOpen.bind(this),
                            instance.serverList[this.rustplus.serverId].oilRigLockedCrateUnlockTimeMs,
                            oilRigLocation.location);
                        this.crateLargeOilRigTimer.start();

                        this.crateLargeOilRigLocation = oilRigLocation.location;
                        this.timeSinceLargeOilRigWasTriggered = new Date();
                        this.persistEventTimes();
                        break;
                    }
                }
            }

            if (!found) {
                /* Offset that is used to determine if CH47 just spawned */
                let offset = 4 * Map.gridDiameter;

                /* If CH47 is located outside the grid system + the offset */
                if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.chinook47DetectedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'chinook47EntersMap', { location: pos.string }),
                        'chinook',
                        Constants.COLOR_CHINOOK47_ENTERS_MAP);
                }
                else {
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.chinook47DetectedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'chinook47Located', { location: pos.string }),
                        'chinook',
                        Constants.COLOR_CHINOOK47_LOCATED);
                }
                marker.ch47Type = 'crate';
            }

            this.ch47s.push(marker);
        }

        /* CH47 markers that have left. */
        for (let marker of leftMarkers) {
            if (marker.ch47Type === 'crate') {
                this.timeSinceCH47WasOut = new Date();
                this.persistEventTimes();
                this.rustplus.log(this.client.intlGet(null, 'eventCap'),
                    this.client.intlGet(null, 'chinook47LeftMap', { location: marker.location.string }));
            }

            this.ch47s = this.ch47s.filter(e => e.id !== marker.id);
        }

        /* CH47 markers that still remains. */
        for (let marker of remainingMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let ch47 = this.getMarkerByTypeId(this.types.CH47, marker.id);

            ch47.x = marker.x;
            ch47.y = marker.y;
            ch47.location = pos;
        }
    }

    updateCargoShips(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.CargoShip, mapMarkers.markers);

        /* CargoShip markers that are new. */
        for (let marker of newMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            this.rustplus.cargoShipTracers[marker.id] = [{ x: marker.x, y: marker.y }];

            marker.location = pos;
            marker.onItsWayOut = false;
            marker.isDocked = false;

            /* Offset that is used to determine if CargoShip just spawned */
            let offset = 4 * Map.gridDiameter;

            /* If CargoShip is located outside the grid system + the offset */
            if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.cargoShipDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'cargoShipEntersMap', { location: pos.string }),
                    'cargo',
                    Constants.COLOR_CARGO_SHIP_ENTERS_MAP);

                let instance = this.client.getInstance(this.rustplus.guildId);
                this.cargoShipEgressTimers[marker.id] = new Timer.timer(
                    this.notifyCargoShipEgress.bind(this),
                    instance.serverList[this.rustplus.serverId].cargoShipEgressTimeMs,
                    marker.id);
                this.cargoShipEgressTimers[marker.id].start();
            }
            else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.cargoShipDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'cargoShipLocated', { location: pos.string }),
                    'cargo',
                    Constants.COLOR_CARGO_SHIP_LOCATED);
            }

            this.cargoShips.push(marker);
        }

        /* CargoShip markers that have left. */
        for (let marker of leftMarkers) {
            this.rustplus.sendEvent(
                this.rustplus.notificationSettings.cargoShipLeftSetting,
                this.client.intlGet(this.rustplus.guildId, 'cargoShipLeftMap', { location: marker.location.string }),
                'cargo',
                Constants.COLOR_CARGO_SHIP_LEFT_MAP);

            if (this.cargoShipEgressTimers[marker.id]) {
                this.cargoShipEgressTimers[marker.id].stop();
                delete this.cargoShipEgressTimers[marker.id];
            }

            this.timeSinceCargoShipWasOut = new Date();
            this.persistEventTimes();

            this.cargoShips = this.cargoShips.filter(e => e.id !== marker.id);
            delete this.rustplus.cargoShipTracers[marker.id];
        }

        /* CargoShip markers that still remains. */
        for (let marker of remainingMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let cargoShip = this.getMarkerByTypeId(this.types.CargoShip, marker.id);

            this.rustplus.cargoShipTracers[marker.id].push({ x: marker.x, y: marker.y });

            const harbors = [];
            for (const monument of this.rustplus.map.monuments) {
                if (/harbor/.test(monument.token)) {
                    harbors.push({ x: monument.x, y: monument.y })
                }
            }

            /* If CargoShip is docked at Harbor */
            if (!this.rustplus.isFirstPoll && !cargoShip.isDocked) {
                for (const harbor of harbors) {
                    if (Map.getDistance(marker.x, marker.y, harbor.x, harbor.y) <= Constants.HARBOR_DOCK_DISTANCE) {
                        if (marker.x === cargoShip.x && marker.y === cargoShip.y) {
                            /* CargoShip is now docked. */
                            const harborLocation = Map.getPos(harbor.x, harbor.y, mapSize, this.rustplus);
                            cargoShip.isDocked = true;
                            this.rustplus.sendEvent(
                                this.rustplus.notificationSettings.cargoShipDockingAtHarborSetting,
                                this.client.intlGet(this.rustplus.guildId, 'cargoShipDockingAtHarbor',
                                    { location: harborLocation.location }), 'cargo', Constants.COLOR_CARGO_SHIP_DOCKED
                            );
                        }
                    }
                }
            } else if (!this.rustplus.isFirstPoll && cargoShip.isDocked) {
                for (const harbor of harbors) {
                    if (Map.getDistance(marker.x, marker.y, harbor.x, harbor.y) <= Constants.HARBOR_DOCK_DISTANCE) {
                        if (marker.x !== cargoShip.x || marker.y !== cargoShip.y) {
                            const harborLocation = Map.getPos(harbor.x, harbor.y, mapSize, this.rustplus);
                            cargoShip.isDocked = false;
                            this.rustplus.sendEvent(
                                this.rustplus.notificationSettings.cargoShipDockingAtHarborSetting,
                                this.client.intlGet(this.rustplus.guildId, 'cargoShipLeftHarbor',
                                    { location: harborLocation.location }), 'cargo', Constants.COLOR_CARGO_SHIP_DOCKED
                            );
                        }
                    }
                }
            }

            cargoShip.x = marker.x;
            cargoShip.y = marker.y;
            cargoShip.location = pos;
        }
    }

    updateGenericRadiuses(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.GenericRadius, mapMarkers.markers);

        /* GenericRadius markers that are new. */
        for (let marker of newMarkers) {
            this.genericRadiuses.push(marker);
        }

        /* GenericRadius markers that have left. */
        for (let marker of leftMarkers) {
            this.genericRadiuses = this.genericRadiuses.filter(e => e.id !== marker.id);
        }

        /* GenericRadius markers that still remains. */
        for (let marker of remainingMarkers) {
            let genericRadius = this.getMarkerByTypeId(this.types.GenericRadius, marker.id);

            genericRadius.x = marker.x;
            genericRadius.y = marker.y;
        }
    }

    updatePatrolHelicopters(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.PatrolHelicopter, mapMarkers.markers);

        /* PatrolHelicopter markers that are new. */
        for (let marker of newMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            this.rustplus.patrolHelicopterTracers[marker.id] = [{ x: marker.x, y: marker.y }];

            marker.location = pos;

            /* Offset that is used to determine if PatrolHelicopter just spawned */
            let offset = 4 * Map.gridDiameter;

            /* If PatrolHelicopter is located outside the grid system + the offset */
            if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize, offset)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterEntersMap', {
                        location: pos.string
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_ENTERS_MAP);
            }
            else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDetectedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterLocatedAt', {
                        location: pos.string
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_LOCATED_AT);
            }

            this.patrolHelicopters.push(marker);
        }

        /* PatrolHelicopter markers that have left. */
        for (let marker of leftMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;

            if (Map.isOutsideGridSystem(marker.x, marker.y, mapSize)) {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterLeftSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterLeftMap', {
                        location: marker.location.string
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_LEFT_MAP);

                this.timeSincePatrolHelicopterWasOnMap = new Date();
                this.persistEventTimes();
            }
            else {
                this.rustplus.sendEvent(
                    this.rustplus.notificationSettings.patrolHelicopterDestroyedSetting,
                    this.client.intlGet(this.rustplus.guildId, 'patrolHelicopterTakenDown', {
                        location: marker.location.string
                    }),
                    'heli',
                    Constants.COLOR_PATROL_HELICOPTER_TAKEN_DOWN);

                this.timeSincePatrolHelicopterWasDestroyed = new Date();
                this.timeSincePatrolHelicopterWasOnMap = new Date();
                this.persistEventTimes();

                this.patrolHelicopterDestroyedLocation = Map.getGridPos(marker.x, marker.y, mapSize);
            }

            this.patrolHelicopters = this.patrolHelicopters.filter(e => e.id !== marker.id);
            delete this.rustplus.patrolHelicopterTracers[marker.id];
        }

        /* PatrolHelicopter markers that still remains. */
        for (let marker of remainingMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let patrolHelicopter = this.getMarkerByTypeId(this.types.PatrolHelicopter, marker.id);

            this.rustplus.patrolHelicopterTracers[marker.id].push({ x: marker.x, y: marker.y });

            patrolHelicopter.x = marker.x;
            patrolHelicopter.y = marker.y;
            patrolHelicopter.location = pos;
        }
    }

    updateTravelingVendors(mapMarkers) {
        let newMarkers = this.getNewMarkersOfTypeId(this.types.TravelingVendor, mapMarkers.markers);
        let leftMarkers = this.getLeftMarkersOfTypeId(this.types.TravelingVendor, mapMarkers.markers);
        let remainingMarkers = this.getRemainingMarkersOfTypeId(this.types.TravelingVendor, mapMarkers.markers);

        /* TravelingVendor markers that are new. */
        for (let marker of newMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);

            marker.location = pos;
            marker.isHalted = false;

            this.rustplus.sendEvent(
                this.rustplus.notificationSettings.travelingVendorDetectedSetting,
                this.client.intlGet(this.rustplus.guildId, 'travelingVendorSpawnedAt', { location: pos.string }),
                'vendor',
                Constants.COLOR_TRAVELING_VENDOR_LOCATED_AT);

            this.travelingVendors.push(marker);
        }
        
        /* TravelingVendor markers that have left. */
        for (let marker of leftMarkers) {
            this.rustplus.sendEvent(
                this.rustplus.notificationSettings.travelingVendorLeftSetting,
                this.client.intlGet(this.rustplus.guildId, 'travelingVendorLeftMap', { location: marker.location.string }),
                'vendor',
                Constants.COLOR_TRAVELING_VENDOR_LEFT_MAP);

            this.timeSinceTravelingVendorWasOnMap = new Date();
            this.persistEventTimes();

            this.travelingVendors = this.travelingVendors.filter(e => e.id !== marker.id);
        }

        /* TravelingVendor markers that still remains. */
        for (let marker of remainingMarkers) {
            let mapSize = this.rustplus.info.correctedMapSize;
            let pos = Map.getPos(marker.x, marker.y, mapSize, this.rustplus);
            let travelingVendor = this.getMarkerByTypeId(this.types.TravelingVendor, marker.id);

            /* If TravelingVendor is halted */
            if (!this.rustplus.isFirstPoll && !travelingVendor.isHalted) {
                if (marker.x === travelingVendor.x && marker.y === travelingVendor.y) {
                    travelingVendor.isHalted = true;
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.travelingVendorHaltedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'travelingVendorHaltedAt', { location: pos.string }),
                        'travelingVendor',
                        Constants.COLOR_TRAVELING_VENDOR_HALTED);
                }
            }
            /* If TravelingVendor is moving again */
            else if (!this.rustplus.isFirstPoll && travelingVendor.isHalted) {
                if (marker.x !== travelingVendor.x || marker.y !== travelingVendor.y) {
                    travelingVendor.isHalted = false;
                    this.rustplus.sendEvent(
                        this.rustplus.notificationSettings.travelingVendorHaltedSetting,
                        this.client.intlGet(this.rustplus.guildId, 'travelingVendorResumedAt', { location: pos.string }),
                        'travelingVendor',
                        Constants.COLOR_TRAVELING_VENDOR_MOVING);
                }
            }
            travelingVendor.x = marker.x;
            travelingVendor.y = marker.y;
            travelingVendor.location = pos;
        }
    }



    /* Timer notification functions */

    notifyCargoShipEgress(args) {
        let id = args[0];
        let marker = this.getMarkerByTypeId(this.types.CargoShip, id);

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.cargoShipEgressSetting,
            this.client.intlGet(this.rustplus.guildId, 'cargoShipEntersEgressStage', {
                location: marker.location.string
            }),
            'cargo',
            Constants.COLOR_CARGO_SHIP_ENTERS_EGRESS_STAGE);

        if (this.cargoShipEgressTimers[id]) {
            this.cargoShipEgressTimers[id].stop();
            delete this.cargoShipEgressTimers[id];
        }

        marker.onItsWayOut = true;
    }

    notifyCrateSmallOilRigOpen(args) {
        let oilRigLocation = args[0];

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.lockedCrateOilRigUnlockedSetting,
            this.client.intlGet(this.rustplus.guildId, 'lockedCrateSmallOilRigUnlocked', {
                location: oilRigLocation
            }),
            'small',
            Constants.COLOR_LOCKED_CRATE_SMALL_OILRIG_UNLOCKED,
            this.rustplus.isFirstPoll,
            'locked_crate_small_oil_rig_logo.png');

        this.crateSmallOilRigTimer.stop();
        this.crateSmallOilRigTimer = null;
        this.crateSmallOilRigLocation = null;
    }

    notifyCrateLargeOilRigOpen(args) {
        let oilRigLocation = args[0];

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.lockedCrateOilRigUnlockedSetting,
            this.client.intlGet(this.rustplus.guildId, 'lockedCrateLargeOilRigUnlocked', {
                location: oilRigLocation
            }),
            'large',
            Constants.COLOR_LOCKED_CRATE_LARGE_OILRIG_UNLOCKED,
            this.rustplus.isFirstPoll,
            'locked_crate_large_oil_rig_logo.png');

        this.crateLargeOilRigTimer.stop();
        this.crateLargeOilRigTimer = null;
        this.crateLargeOilRigLocation = null;
    }

    scheduleDeepSeaPrepair() {
        if (this.deepSeaPrepairTimer) {
            this.deepSeaPrepairTimer.stop();
            this.deepSeaPrepairTimer = null;
        }

        const setting = this.rustplus.notificationSettings.deepSeaDetectedSetting;
        if (!setting || !setting.prepair) return;
        if (this.deepSeaSpawnedAt || !this.timeSinceDeepSeaWasOnMap) return;

        const despawnMs = this.timeSinceDeepSeaWasOnMap.getTime();
        const earliestRespawnAtMs = despawnMs + DEEP_SEA_RESPAWN_MIN_MS;
        const firstNoticeAtMs = earliestRespawnAtMs - DEEP_SEA_PREPARE_LEAD_MS;
        const delayMs = firstNoticeAtMs - Date.now();

        this.deepSeaRespawnAt = new Date(earliestRespawnAtMs);

        if (delayMs <= 0) {
            this.notifyDeepSeaPrepair([]);
            return;
        }

        this.deepSeaPrepairTimer = new Timer.timer(
            this.notifyDeepSeaPrepair.bind(this),
            delayMs);
        this.deepSeaPrepairTimer.start();
    }

    notifyDeepSeaPrepair() {
        this.deepSeaPrepairTimer = null;

        if (this.deepSeaSpawnedAt || !this.timeSinceDeepSeaWasOnMap) return;

        const despawnMs = this.timeSinceDeepSeaWasOnMap.getTime();
        const earliestRespawnAtMs = despawnMs + DEEP_SEA_RESPAWN_MIN_MS;
        const earliestEtaMs = earliestRespawnAtMs - Date.now();

        let message = null;
        let nextDelayMs = 10 * 60 * 1000;

        if (earliestEtaMs > 0) {
            const etaSeconds = Math.max(0, Math.ceil(earliestEtaMs / 1000));
            const eta = Timer.secondsToFullScale(etaSeconds, 's');
            message = this.client.intlGet(this.rustplus.guildId, 'deepSeaPrepareEarliestRespawn', { time: eta });
            nextDelayMs = Math.max(1000, Math.min(5 * 60 * 1000, earliestEtaMs));
        }
        else {
            message = this.client.intlGet(this.rustplus.guildId, 'deepSeaExpectedAnyTimeNow');
            nextDelayMs = 10 * 60 * 1000;
        }

        this.rustplus.sendEvent(
            this.rustplus.notificationSettings.deepSeaDetectedSetting,
            message,
            'deepsea',
            Constants.COLOR_DEEP_SEA_PREPAIR);

        this.deepSeaPrepairTimer = new Timer.timer(
            this.notifyDeepSeaPrepair.bind(this),
            nextDelayMs);
        this.deepSeaPrepairTimer.start();
    }

    /* Help functions */

    getClosestMonument(x, y) {
        let minDistance = 1000000;
        let closestMonument = null;
        for (let monument of this.rustplus.map.monuments) {
            let distance = Map.getDistance(x, y, monument.x, monument.y);
            if (distance < minDistance && this.validCrateMonuments.includes(monument.token)) {
                minDistance = distance;
                closestMonument = monument;
            }
        }

        return closestMonument;
    }

    reset() {
        this.players = [];
        this.vendingMachines = [];
        this.ch47s = [];
        this.cargoShips = [];
        this.genericRadiuses = [];
        this.patrolHelicopters = [];
        this.travelingVendors = [];
        this.deepSea = [];

        for (const [id, timer] of Object.entries(this.cargoShipEgressTimers)) {
            timer.stop();
        }
        this.cargoShipEgressTimers = new Object();
        if (this.crateSmallOilRigTimer) {
            this.crateSmallOilRigTimer.stop();
        }
        this.crateSmallOilRigTimer = null;
        if (this.crateLargeOilRigTimer) {
            this.crateLargeOilRigTimer.stop();
        }
        this.crateLargeOilRigTimer = null;
        if (this.deepSeaPrepairTimer) {
            this.deepSeaPrepairTimer.stop();
        }
        this.deepSeaPrepairTimer = null;

        this.timeSinceCargoShipWasOut = null;
        this.timeSinceCH47WasOut = null;
        this.timeSinceSmallOilRigWasTriggered = null;
        this.timeSinceLargeOilRigWasTriggered = null;
        this.timeSincePatrolHelicopterWasOnMap = null;
        this.timeSincePatrolHelicopterWasDestroyed = null;
        this.timeSinceTravelingVendorWasOnMap = null;
        this.timeSinceDeepSeaWasOnMap = null;

        // Reset Deep Sea specific fields
        this.deepSeaSpawnedAt = null;
        this.deepSeaLastSpawnAt = null;
        this.deepSeaRespawnAt = null;
        this.deepSeaLastSide = null;
        this.deepSeaLastLocation = null;
        this.isDeepSeaActive = false;
        this.deepSea = [];

        this.patrolHelicopterDestroyedLocation = null;

        this.knownVendingMachines = [];
        this.subscribedItemsId = [];
        this.foundItems = [];

        this.crateSmallOilRigLocation = null;
        this.crateLargeOilRigLocation = null;

        this.isDeepSeaActive = false;
    }

    loadEventTimes() {
        const Client = require('../../index.ts');
        // Note: Event times are now loaded via EventStateManager.restoreEventState()
        // This legacy method is kept for backwards compatibility only.
        // All event time restoration happens through EventStateManager.
    }

    persistEventTimes() {
        const Client = require('../../index.ts');
        const EventStateManager = require('../util/EventStateManager.js');
        const instance = Client.client.getInstance(this.rustplus.guildId);
        
        /* Save event state using EventStateManager for persistence across reboots */
        EventStateManager.saveEventState(instance, this);
        Client.client.setInstance(this.rustplus.guildId, instance);
    }
}

module.exports = MapMarkers;
