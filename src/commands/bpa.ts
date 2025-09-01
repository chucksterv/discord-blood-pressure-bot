import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";

import { getAverages } from "../utils/functions.js";
import { createBPAverageEmbed } from "../embeds/averages-embed.js";

export default {
  data: new SlashCommandBuilder()
    .setName("bpa")
    .setDescription("Get blood pressure record data")
    .addStringOption(option =>
      option.setName("period")
        .setDescription("Enter the range for data")
        .setRequired(false)
        .addChoices(
          { name: "Today", value: "daily" },
          { name: "This week", value: "weekly" },
          { name: "This month", value: "monthly" },
          { name: "All time", value: "all_time" },
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply()
    const createdAt = interaction.createdAt.toISOString();
    const userId = interaction.user.id;

    console.log(`/bpa command fired at ${interaction.createdAt} by ${interaction.user.username} ${interaction.user.id}`);
    const period = interaction.options.getString("period", false) ?? "daily";
    console.log(`Period : ${period}`);

    const timezone = interaction.user.username == "deshand" ? "Australia/Melbourne" : "America/Los_Angeles";
    try {
      console.log("Attempting to calculate averages");
      const averages = await getAverages(userId, period, timezone, createdAt);
      console.log(averages);
      console.log("Attempting to create embed");
      const embed = createBPAverageEmbed(averages, timezone);
      await interaction.editReply({ embeds: [embed] });
      console.log("Embed sent.")

    } catch (error) {
      console.error(error);
      await interaction.editReply("Something went wrong.");
    }
  }
}
