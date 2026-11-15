// Client Ready Event Handler

const { ActivityType, Events } = require("discord.js");

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log("Ready to serve!");

    // Default Status
    client.user.setPresence({
      activities: [
        {
          name: "here to help",
          type: ActivityType.Custom,
        },
      ],
    });

  },
};
