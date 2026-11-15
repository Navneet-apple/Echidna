// Interaction (Slash Commands) Handler

const { Events, MessageFlags } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    const command = interaction.client.commands.get(commandName);
    console.log(`[Interaction] Received /${commandName}.`);

    if (!command) {
      console.warn(`[Interaction] /${commandName} is not loaded.`);
      await interaction.reply({
        content: "That command isn't available in this bot version. Please try again after the bot updates its commands.",
        flags: MessageFlags.Ephemeral,
      }).catch((error) => {
        console.error(`[Interaction] Could not acknowledge missing /${commandName}:`, error);
      });
      return;
    }

    try {
      await command.execute(interaction);
      if (!interaction.replied && !interaction.deferred) {
        console.error(`[Interaction] /${commandName} finished without replying.`);
        await interaction.reply({
          content: "I couldn't complete that command. Please try again.",
          flags: MessageFlags.Ephemeral,
        });
      } else {
        console.log(`[Interaction] /${commandName} acknowledged.`);
      }
    } catch (error) {
      console.error(`[Interaction] /${commandName} failed:`, error);
      const response = {
        content: "I couldn't complete that command. Please try again.",
        flags: MessageFlags.Ephemeral,
      };

      try {
        if (interaction.deferred) {
          await interaction.editReply(response.content);
        } else if (interaction.replied) {
          await interaction.followUp(response);
        } else {
          await interaction.reply(response);
        }
      } catch (replyError) {
        console.error(`[Interaction] Could not send failure response for /${commandName}:`, replyError);
      }
    }
  },
};
