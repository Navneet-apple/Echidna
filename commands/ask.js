const { SlashCommandBuilder } = require("discord.js");
const {
  SYSTEM_INSTRUCTION,
  formatReply,
  generateCompletion,
  getUserFacingError,
} = require("../src/pollinations");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask Echidna a question directly.")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("What would you like help with?")
        .setRequired(true)
        .setMaxLength(2000),
    ),
  async execute(interaction) {
    const question = interaction.options.getString("question", true);
    await interaction.deferReply();

    try {
      console.log("[AI] Generating slash-command response with Pollinations.");
      const text = await generateCompletion([
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: question },
      ]);
      await interaction.editReply(formatReply(text));
      console.log("[AI] Slash-command reply sent.");
    } catch (error) {
      console.error("[AI] Slash-command request failed:", error);
      await interaction.editReply(getUserFacingError(error));
    }
  },
};
