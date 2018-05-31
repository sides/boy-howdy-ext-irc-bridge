"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const irc_1 = require("irc");
let irc;
function enable(on) {
    on('readyAndBootstrapped', (client) => {
        const ircChannelName = client.config.irc.bridge.sync[0];
        const discordChannelId = client.config.irc.bridge.sync[1];
        const discordChannel = client.channels.find(channel => channel.id == discordChannelId);
        if (!discordChannel) {
            throw new Error(`Discord channel with ID "${discordChannelId}" was not found as a channel available to this bot.`);
        }
        if (discordChannel.type !== 'text') {
            throw new Error(`Discord channel set up for sync is not a text channel.`);
        }
        //
        // IRC setup
        //
        irc = new irc_1.Client(client.config.irc.bridge.server, client.config.irc.bridge.clientOptions.nick, client.config.irc.bridge.clientOptions);
        irc.on('message', (nick, channel, message) => {
            if (channel != ircChannelName) {
                return;
            }
            discordChannel.send(message);
        });
        irc.on('action', (nick, channel, message) => {
            if (channel != ircChannelName) {
                return;
            }
            discordChannel.send('/me ' + message);
        });
        irc.on('join', (channel, nick, message) => {
            if (channel != ircChannelName) {
                return;
            }
            const userList = client.users.filter(user => user.presence.status === 'online')
                .map(user => user.username)
                .join(', ');
            irc.action(ircChannelName, `Currently online: ${userList}`);
        });
        //
        // Discord setup
        //
        on('message', (message) => {
            if (message.author.id === client.user.id || message.channel.id !== discordChannelId) {
                return;
            }
            irc.say(ircChannelName, `${message.author.username}: ${message.content}`);
        });
        on('messageDelete', (message) => {
            if (message.channel.id !== discordChannelId) {
                return;
            }
            irc.say(ircChannelName, `Message by ${message.author.username} deleted: "${message.content}"`);
        });
        on('messageUpdate', (oldMessage, message) => {
            if (message.channel.id !== discordChannelId) {
                return;
            }
            irc.say(ircChannelName, `Message by ${message.author.username} edited: "${oldMessage.content}" -> "${message.content}"`);
        });
        on('presenceUpdate', (oldMember, member) => {
            if ((oldMember.presence.status === 'online' || oldMember.presence.status === 'idle' || oldMember.presence.status === 'dnd')
                && member.presence.status === 'offline') {
                irc.action(ircChannelName, `${member.user.username} has gone offline.`);
            }
            else if (oldMember.presence.status === 'offline'
                && (member.presence.status === 'online' || member.presence.status === 'idle' || member.presence.status === 'dnd')) {
                irc.action(ircChannelName, `${member.user.username} is now online.`);
            }
        });
        on('destroy', () => {
            irc.disconnect('Disconnecting... Bye!', () => irc = null);
        });
    });
}
exports.enable = enable;
function disable() {
    if (!irc) {
        return;
    }
    irc.disconnect('Bridge extension was disabled. Bye!', () => irc = null);
}
exports.disable = disable;
