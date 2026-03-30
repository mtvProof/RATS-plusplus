/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)
    Copyright (C) 2023 FaiThiX

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
const {
    getVoiceConnection,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType,
} = require('@discordjs/voice');
const Prism = require('prism-media');
const { Readable } = require('stream');
const Actors = require('../staticFiles/actors.json');
const Client = require('../../index.ts');

const guildPlayers = new Map();

module.exports = {
    sendDiscordVoiceMessage: async function (guildId, text) {
        const connection = getVoiceConnection(guildId);

        if (!connection) {
            Client.client.log(Client.client.intlGet(null, 'errorCap'),
                `TTS: No active voice connection for guild ${guildId}`);
            return false;
        }

        try {
            const voice = await this.getVoice(guildId);

            if (!voice || voice.EID === undefined || voice.LID === undefined || voice.VID === undefined) {
                Client.client.log(Client.client.intlGet(null, 'errorCap'),
                    `TTS: Invalid voice actor settings for guild ${guildId}`);
                return false;
            }

            const url = `https://cache-a.oddcast.com/tts/genC.php?EID=${voice.EID}&LID=${voice.LID}&VID=${voice.VID}&TXT=${encodeURIComponent(text)}&EXT=mp3`;

            const response = await fetch(url);
            if (!response.ok) {
                Client.client.log(Client.client.intlGet(null, 'errorCap'), 
                    `TTS: Failed to fetch audio: ${response.status}`);
                return false;
            }

            // Transcode MP3 -> Ogg Opus to avoid requiring native Node Opus modules.
            const arrayBuffer = await response.arrayBuffer();
            const inputStream = Readable.from(Buffer.from(arrayBuffer));
            const transcoder = new Prism.FFmpeg({
                args: [
                    '-analyzeduration', '0',
                    '-loglevel', '0',
                    '-f', 'mp3',
                    '-i', 'pipe:0',
                    '-ac', '2',
                    '-ar', '48000',
                    '-c:a', 'libopus',
                    '-f', 'ogg',
                    'pipe:1',
                ],
            });

            inputStream.pipe(transcoder);

            const resource = createAudioResource(transcoder, {
                inputType: StreamType.OggOpus,
            });

            let player = guildPlayers.get(guildId);
            if (!player) {
                player = createAudioPlayer();
                player.on('error', (error) => {
                    Client.client.log(Client.client.intlGet(null, 'errorCap'),
                        `TTS: Audio player error in guild ${guildId}: ${error.message}`);
                });
                player.on(AudioPlayerStatus.Idle, () => {
                    Client.client.log(Client.client.intlGet(null, 'infoCap'),
                        `TTS: Playback finished in guild ${guildId}`);
                });
                guildPlayers.set(guildId, player);
            }

            connection.subscribe(player);

            if (player.state.status !== AudioPlayerStatus.Idle) {
                player.stop(true);
            }

            player.play(resource);
            
            Client.client.log(Client.client.intlGet(null, 'infoCap'), 
                `TTS: Playing message in voice for guild ${guildId}`);
            return true;
        }
        catch (error) {
            Client.client.log(Client.client.intlGet(null, 'errorCap'), 
                `TTS: Error playing voice message: ${error}`);
            return false;
        }
    },

    getVoice: async function (guildId) {
        const instance = Client.client.getInstance(guildId);
        const gender = instance.generalSettings.voiceGender;
        const language = instance.generalSettings.language;

        if (Actors[language]?.[gender] === null || Actors[language]?.[gender] === undefined) {
            return Actors[language]?.[gender === 'male' ? 'female' : 'male'];
        }
        else {
            return Actors[language]?.[gender];
        }
    },
}