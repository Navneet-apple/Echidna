const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { getModelName } = require("../src/pollinations");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("model")
    .setDescription("Show which AI model Echidna is using."),
  async execute(interaction) {
    await interaction.reply({
      content: `I'm using the Pollinations model \`${getModelName()}\`.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
