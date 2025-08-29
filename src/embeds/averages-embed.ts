import { EmbedBuilder } from 'discord.js';
import { DateTime } from 'luxon';

function getBPCategory(systolic: number, diastolic: number) {
  if (systolic < 120 && diastolic < 80) {
    return { category: 'Normal', emoji: '✅', color: 0x2ecc71 };
  } else if (systolic < 130 && diastolic < 80) {
    return { category: 'Elevated', emoji: '⚠️', color: 0xf39c12 };
  } else if ((systolic >= 130 && systolic < 140) || (diastolic >= 80 && diastolic < 90)) {
    return { category: 'Stage 1 High', emoji: '🔶', color: 0xe67e22 };
  } else if (systolic >= 140 || diastolic >= 90) {
    return { category: 'Stage 2 High', emoji: '🔴', color: 0xe74c3c };
  } else {
    return { category: 'Unknown', emoji: '❓', color: 0x95a5a6 };
  }
}

function convertUtcToTimezone(utcDate: Date, timezone: string) {
  const utcDateTime = DateTime.fromJSDate(utcDate, { zone: 'utc' });
  const convertedDateTime = utcDateTime.setZone(timezone);
  return convertedDateTime;
}
export function createBPAverageEmbed(data: any, timezone: string) {
  const bpStatus = getBPCategory(data.avgSystolic, data.avgDiastolic);

  const embed = new EmbedBuilder()
    .setTitle(`${bpStatus.emoji} BP Averages - ${data.displayName}`)
    .setColor(bpStatus.color)
    .setTimestamp();

  // Main reading with status
  embed.addFields(
    {
      name: '📊 Average Reading',
      value: `**${data.avgSystolic}/${data.avgDiastolic} mmHg**\n${bpStatus.emoji} *${bpStatus.category}*`,
      inline: false
    },
    {
      name: '📈 Reading Count',
      value: `${data.readingCount} measurement${data.readingCount !== 1 ? 's' : ''}`,
      inline: true
    }
  );

  // Arm comparison (if both arms have readings)
  if (data.leftReadingCount > 0 && data.rightReadingCount > 0) {
    embed.addFields(
      {
        name: '🆚 Arm Comparison',
        value:
          `👈 **Left:** ${data.avgLeftSystolic}/${data.avgLeftDiastolic} (${data.leftReadingCount} reading${data.leftReadingCount !== 1 ? 's' : ''})
👉 **Right:** ${data.avgRightSystolic}/${data.avgRightDiastolic} (${data.rightReadingCount} reading${data.rightReadingCount !== 1 ? 's' : ''})`,
        inline: false
      }
    );
  } else if (data.leftReadingCount > 0 || data.rightReadingCount > 0) {
    // Show single arm data
    const armData = data.leftReadingCount > 0 ?
      { arm: 'Left', emoji: '👈', sys: data.avgLeftSystolic, dia: data.avgLeftDiastolic, count: data.leftReadingCount } :
      { arm: 'Right', emoji: '👉', sys: data.avgRightSystolic, dia: data.avgRightDiastolic, count: data.rightReadingCount };

    embed.addFields(
      {
        name: `${armData.emoji} ${armData.arm} Arm Only`,
        value: `${armData.sys}/${armData.dia} mmHg (${armData.count} reading${armData.count !== 1 ? 's' : ''})`,
        inline: true
      }
    );
  }

  // Time range
  if (data.firstReadingAt && data.lastReadingAt) {
    const firstReading = convertUtcToTimezone(data.firstReadingAt, timezone);
    const lastReading = convertUtcToTimezone(data.lastReadingAt, timezone);
    const duration = lastReading.diff(firstReading);
    const { days, hours, minutes } = duration.shiftTo("days", "hours", "minutes");

    let timeSpan = '';
    if (days) timeSpan += `${Math.floor(days)}d `;
    if (hours) timeSpan += `${Math.floor(hours)}h `;
    if (minutes) timeSpan += `${Math.floor(minutes)}m`;
    if (!timeSpan) timeSpan = '< 1m or only 1 reading';

    embed.addFields(
      {
        name: '⏰ Measurement Window',
        value: `Span: **${timeSpan}**\nLast: <t:${Math.floor(lastReading.toUnixInteger())}>`,
        inline: true
      }
    );
  }

  return embed;
}

