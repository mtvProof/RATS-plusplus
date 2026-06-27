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

// Helper function to convert string to boolean
const parseBoolean = (value, defaultValue = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        if (lower === 'true' || lower === '1' || lower === 'yes') return true;
        if (lower === 'false' || lower === '0' || lower === 'no') return false;
    }
    return defaultValue;
};

// Helper function to parse integer with default
const parseIntWithDefault = (value, defaultValue) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
};

module.exports = {
    general: {
        language: process.env.RPP_LANGUAGE || 'en',
        pollingIntervalMs: parseIntWithDefault(process.env.RPP_POLLING_INTERVAL, 7000),
        showCallStackError: parseBoolean(process.env.RPP_LOG_CALL_STACK, false),
        reconnectIntervalMs: parseIntWithDefault(process.env.RPP_RECONNECT_INTERVAL, 15000),
    },
    discord: {
        username: process.env.RPP_DISCORD_USERNAME || 'RATS++',
        clientId: process.env.RPP_DISCORD_CLIENT_ID || '',
        token: process.env.RPP_DISCORD_TOKEN || '',
        needAdminPrivileges: parseBoolean(process.env.RPP_NEED_ADMIN_PRIVILEGES, true),
    },
    webui: {
        enabled: parseBoolean(process.env.RPP_WEBUI_ENABLED, true),
        port: parseIntWithDefault(process.env.RPP_WEBUI_PORT, 3000),
    }
};
