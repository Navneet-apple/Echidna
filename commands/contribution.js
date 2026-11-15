const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("contribution")
    .setDescription("About Echidna and its open source project."),
  async execute(interaction) {
    const { client } = interaction;
    interaction.reply({
      embeds: [
        {
          color: 0xffc916,
          title: "Contributions",
          description: "Open source information about Echidna.",
          thumbnail: {
            url: client.user.displayAvatarURL,
          },
          fields: [
            {
              name: "Project",
              value: "Echidna is an open source Discord bot.",
            },
            {
              name: "Want to Contribute?",
              value:
                "Contributions to Echidna are welcome. Submit your changes through a pull request.",
            },
          ],
        },
      ],
    });
  },
};
