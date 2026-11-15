const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show Echidna's commands and how to talk to her."),
  async execute(interaction) {
    await interaction.reply({
      embeds: [
        {
          color: 0x0ccab6,
          title: "Echidna's commands",
          description:
            "Ask me with `/ask`, mention me in a server, or message me directly.",
          fields: [
            { name: "/ask question", value: "Ask me a question directly." },
            { name: "/model", value: "See the AI model I'm using." },
            { name: "/ping", value: "Check whether I'm responding." },
          ],
        },
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
