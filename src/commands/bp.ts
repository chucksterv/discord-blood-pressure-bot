import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";

import { pool } from "../db.js";
import { getAverages } from "../utils/functions.js";
import { createBPAverageEmbed } from "../embeds/averages-embed.js";

export default {
  data: new SlashCommandBuilder()
    .setName("bp")
    .setDescription("Record blood pressure")
    .addStringOption(option =>
      option.setName("side")
        .setDescription("Which arm?")
        .setRequired(true)
        .addChoices(
          { name: "Left Arm", value: "left" },
          { name: "Right Arm", value: "right" }
        )
    )
    .addIntegerOption(option =>
      option
        .setName("systolic")
        .setDescription("Upper value")
        .setRequired(true))
    .addIntegerOption(option =>
      option
        .setName("diastolic")
        .setDescription("Lower value")
        .setRequired(true)),


  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply()
    const createdAt = interaction.createdAt.toISOString();

    //Embed values
    const userId = interaction.user.id;
    const period = "daily";
    const timezone = interaction.user.username == "deshand" ? "Australia/Melbourne" : "America/Los_Angeles";

    console.log(`/bp command fired at ${interaction.createdAt} by ${interaction.user.username} ${interaction.user.id}`);

    const side = interaction.options.getString("side", true);
    const systolic = interaction.options.getInteger('systolic', true);
    const diastolic = interaction.options.getInteger('diastolic', true);

    console.log(`Given values - side : ${side}, systolic : ${systolic}, diastolic : ${diastolic}`);
    console.log("Attempting to inserta data in DB");

    const columnPrefix = side === "left" ? "l" : "r";

    try {
      //Insert data into table
      const res = await pool.query(`
          INSERT INTO blood_pressure_readings (user_id, created_at, ${columnPrefix}_systolic, ${columnPrefix}_diastolic) 
          VALUES ($1, $2, $3, $4)
          `, [interaction.user.id, createdAt, systolic, diastolic]);

      if (res.rowCount === 1) {
        // await interaction.editReply(`✅ Added blood pressure values ${side} -  (${systolic}/${diastolic}) to database!`);
        await interaction.editReply(`✅ Testing auto deploy on server. Added blood pressure values ${side} -  (${systolic}/${diastolic}) to database!`);
        console.log("Data insertion successful.");
        //Embed
        console.log("Attempting to calculate averages");
        const averages = await getAverages(userId, period, timezone, createdAt);
        console.log(averages);
        console.log("Attempting to create embed");
        const embed = createBPAverageEmbed(averages, timezone);
        await interaction.followUp({ embeds: [embed] });
        console.log("Embed sent.")

      } else {
        await interaction.editReply('⚠️ Error adding blood pressure values to database');
        console.log("Data insertion failed.");
      }

    } catch (error) {
      await interaction.editReply('⚠️ Error adding blood pressure values to database');
      console.log("Data insertion failed.");
      console.error(error);

    }
  }
}
