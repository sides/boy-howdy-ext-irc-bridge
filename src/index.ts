import { Message, TextChannel, User, GuildMember } from 'discord.js'
import { Client, ExtensionBootstrapper } from 'discord-bot.js'
import { Client as IrcClient } from 'irc'

let irc: IrcClient;

export function enable(on: ExtensionBootstrapper) {
  on('readyAndBootstrapped', (client: Client) => {
    const ircChannelName = client.config.irc.bridge.sync[0];
    const discordChannelId = client.config.irc.bridge.sync[1];
    const discordChannel = client.channels.find(channel => channel.id == discordChannelId) as TextChannel;

    if (!discordChannel) {
      throw new Error(`Discord channel with ID "${discordChannelId}" was not found as a channel available to this bot.`);
    }

    if (discordChannel.type !== 'text') {
      throw new Error(`Discord channel set up for sync is not a text channel.`);
    }

    //
    // IRC setup
    //
    irc = new IrcClient(client.config.irc.bridge.server, client.config.irc.bridge.clientOptions.nick, client.config.irc.bridge.clientOptions);

    irc.on('message', (nick: string, channel: string, message: string) => {
      if (channel != ircChannelName) {
        return;
      }

      discordChannel.send(message);
    });

    irc.on('action', (nick: string, channel: string, message: string) => {
      if (channel != ircChannelName) {
        return;
      }

      discordChannel.send(`_${message}_`);
    });

    irc.on('join', (channel: string, nick: string, message: string) => {
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
    on('message', (message: Message) => {
      if (message.author.id === client.user.id || message.channel.id !== discordChannelId) {
        return;
      }

      irc.say(ircChannelName, `${message.author.username}: ${message.content}`);
    });

    on('messageDelete', (message: Message) => {
      if (message.channel.id !== discordChannelId) {
        return;
      }

      irc.say(ircChannelName, `Message by ${message.author.username} deleted: "${message.content}"`);
    });

    on('messageUpdate', (oldMessage: Message, message: Message) => {
      if (message.channel.id !== discordChannelId) {
        return;
      }

      irc.say(ircChannelName, `Message by ${message.author.username} edited: "${oldMessage.content}" -> "${message.content}"`);
    });

    on('presenceUpdate', (oldMember: GuildMember, member: GuildMember) => {
      if ((oldMember.presence.status === 'online' || oldMember.presence.status === 'idle' || oldMember.presence.status === 'dnd')
        && member.presence.status === 'offline') {
        irc.action(ircChannelName, `${member.user.username} has gone offline.`);
      } else if (oldMember.presence.status === 'offline'
        && (member.presence.status === 'online' || member.presence.status === 'idle' || member.presence.status === 'dnd')) {
        irc.action(ircChannelName, `${member.user.username} is now online.`);
      }
    });

    on('destroy', () => {
      irc.disconnect('Disconnecting... Bye!', () => irc = null);
    });
  });
}

export function disable() {
  if (!irc) {
    return;
  }

  irc.disconnect('Bridge extension was disabled. Bye!', () => irc = null);
}
