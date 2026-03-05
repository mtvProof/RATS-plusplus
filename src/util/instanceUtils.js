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

const Fs = require('fs');
const Path = require('path');

const Client = require('../../index.ts');

module.exports = {
    getSmartDevice: function (guildId, entityId) {
        /* Temporary function till discord modals gets more functional */
        const instance = Client.client.getInstance(guildId);

        for (const serverId in instance.serverList) {
            for (const switchId in instance.serverList[serverId].switches) {
                if (entityId === switchId) return { type: 'switch', serverId: serverId }
            }
            for (const alarmId in instance.serverList[serverId].alarms) {
                if (entityId === alarmId) return { type: 'alarm', serverId: serverId }
            }
            for (const storageMonitorId in instance.serverList[serverId].storageMonitors) {
                if (entityId === storageMonitorId) return { type: 'storageMonitor', serverId: serverId }
            }
        }
        return null;
    },

    readInstanceFile: function (guildId) {
        const targetPath = Path.join(__dirname, '..', '..', 'instances', `${guildId}.json`);
        const tempPath = targetPath + '.tmp';
        if (Fs.existsSync(tempPath)) {
            try {
                Fs.unlinkSync(tempPath);
            } catch (e) {
                console.warn(`Failed to remove stale temporary file: ${tempPath}`, e);
            }
        }

        // Remove stale unique temp files created by writeInstanceFile
        const instanceDir = Path.join(__dirname, '..', '..', 'instances');
        const tempPrefix = `${guildId}.json.tmp.`;
        try {
            for (const file of Fs.readdirSync(instanceDir)) {
                if (file.startsWith(tempPrefix)) {
                    const filePath = Path.join(instanceDir, file);
                    try {
                        Fs.unlinkSync(filePath);
                    } catch (e) {
                        /* Ignore */
                    }
                }
            }
        } catch (e) {
            /* Ignore */
        }

        // Fahren Sie mit dem normalen Lesen fort
        return JSON.parse(Fs.readFileSync(targetPath, 'utf8'));
    },

    writeInstanceFile: function (guildId, instance) {
        const targetPath = Path.join(__dirname, '..', '..', 'instances', `${guildId}.json`);
        const tempPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
        
        const data = JSON.stringify(instance, null, 2);

        try {
            Fs.writeFileSync(tempPath, data, 'utf8');
            
            // Sync the file to ensure data is written to disk
            try {
                const fd = Fs.openSync(tempPath, 'r+');
                Fs.fsyncSync(fd);
                Fs.closeSync(fd);
            } catch (syncError) {
                console.error(`Failed to sync file data: ${tempPath}:`, syncError);
                // Don't delete the file yet, try to rename it anyway
            }
            
            // Rename temp file to target, handling case where target might already exist
            if (!Fs.existsSync(tempPath)) {
                throw new Error(`Temp file does not exist: ${tempPath}`);
            }

            if (Fs.existsSync(targetPath)) {
                Fs.unlinkSync(targetPath);
            }
            Fs.renameSync(tempPath, targetPath);
        } catch (error) {
            // Clean up temp file if it still exists
            if (Fs.existsSync(tempPath)) {
                try {
                    Fs.unlinkSync(tempPath);
                } catch (unlinkError) {
                    console.error(`Failed to clean up temp file: ${tempPath}:`, unlinkError);
                }
            }
            throw error;
        }
    },

    readCredentialsFile: function (guildId) {
        const path = Path.join(__dirname, '..', '..', 'credentials', `${guildId}.json`);
        return JSON.parse(Fs.readFileSync(path, 'utf8'));
    },

    writeCredentialsFile: function (guildId, credentials) {
        const path = Path.join(__dirname, '..', '..', 'credentials', `${guildId}.json`);
        Fs.writeFileSync(path, JSON.stringify(credentials, null, 2));
    },
}
