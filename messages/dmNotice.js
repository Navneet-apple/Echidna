// DM Notice Handler

const { ChannelType } = require("discord.js");

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  exclusive: true,

  match(message) {
    return message.channel.type === ChannelType.DM;
  },

  async execute(message) {
    await message.channel.sendTyping();
    await delay(1000);

    await message.reply(
      "Echidna's commands are available in Discord servers, not in direct messages.",
    );
  },
};
