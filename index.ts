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

const Discord = require('discord.js');
const Fs = require('fs');
const Path = require('path');

const DiscordBot = require('./src/structures/DiscordBot');

const lockPath = Path.join('/tmp', 'ratspp-bot.lock');
ensureSingleInstance();

createMissingDirectories();

const client = new DiscordBot({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildVoiceStates],
    retryLimit: 2,
    restRequestTimeout: 60000,
    disableEveryone: false
});

client.build();

function ensureSingleInstance() {
    try {
        if (Fs.existsSync(lockPath)) {
            const existingPid = Number(Fs.readFileSync(lockPath, 'utf8').trim());
            if (!Number.isNaN(existingPid) && existingPid > 0) {
                try {
                    process.kill(existingPid, 0);
                    console.error(`Another RATS++ process is already running (pid: ${existingPid}). Exiting.`);
                    process.exit(1);
                }
                catch (_) {
                    // Stale lock, continue and overwrite.
                }
            }
        }

        Fs.writeFileSync(lockPath, `${process.pid}`, 'utf8');
    }
    catch (e) {
        console.error('Failed to initialize single-instance lock:', e);
    }
}

function removeSingleInstanceLock() {
    try {
        if (!Fs.existsSync(lockPath)) return;
        const pidInLock = Number(Fs.readFileSync(lockPath, 'utf8').trim());
        if (pidInLock === process.pid) {
            Fs.unlinkSync(lockPath);
        }
    }
    catch (_) {
        // Ignore cleanup errors.
    }
}

function createMissingDirectories() {
    if (!Fs.existsSync(Path.join(__dirname, 'logs'))) {
        Fs.mkdirSync(Path.join(__dirname, 'logs'));
    }

    if (!Fs.existsSync(Path.join(__dirname, 'instances'))) {
        Fs.mkdirSync(Path.join(__dirname, 'instances'));
    }

    if (!Fs.existsSync(Path.join(__dirname, 'credentials'))) {
        Fs.mkdirSync(Path.join(__dirname, 'credentials'));
    }

    if (!Fs.existsSync(Path.join(__dirname, 'maps'))) {
        Fs.mkdirSync(Path.join(__dirname, 'maps'));
    }

    if (!Fs.existsSync(Path.join(__dirname, 'database'))) {
        Fs.mkdirSync(Path.join(__dirname, 'database'));
    }
}

process.on('unhandledRejection', error => {
    client.log(client.intlGet(null, 'errorCap'), client.intlGet(null, 'unhandledRejection', {
        error: error
    }), 'error');

    // Surface full stack traces for debugging instead of only the message.
    const err = (error instanceof Error) ? error : new Error(String(error));
    console.error(err.stack || err);
});

process.on('uncaughtException', error => {
    const err = (error instanceof Error) ? error : new Error(String(error));
    console.error(err.stack || err);
});

process.on('exit', removeSingleInstanceLock);
process.on('SIGINT', () => {
    removeSingleInstanceLock();
    process.exit(0);
});
process.on('SIGTERM', () => {
    removeSingleInstanceLock();
    process.exit(0);
});

exports.client = client;
