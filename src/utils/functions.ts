import { DateTime } from "luxon";
import { pool } from "../db.js";

/**
 * Get raw blood pressure readings from a user within a date period
*/
export async function getRawReadings(userId: string, startDate: DateTime, endDate: DateTime) {
  const res = await pool.query(`
    SELECT id, created_at, l_systolic, l_diastolic, r_systolic, r_diastolic
    FROM blood_pressure_readings
    WHERE user_id = $1
      AND created_at >= $2
      AND created_at <= $3
      AND (
        (l_systolic IS NOT NULL AND l_diastolic IS NOT NULL) OR
        (r_systolic IS NOT NULL AND r_diastolic IS NOT NULL)
      )
   `, [userId, startDate, endDate]);

  return res.rows;
}

interface Reading {
  systolic: number;
  diastolic: number;
  arm: "l" | "r";
  timestamp: string;
}

/**
 * Extract systolic and diastolic values from a reading
 * Each row has either left or right values
 */
export function extractReadingValues(rawReading: any): Reading | null {

  const { l_systolic, l_diastolic, r_systolic, r_diastolic } = rawReading;

  let systolic = null;
  let diastolic = null;
  let arm: "l" | "r" | null = null;

  //Check for left arm reading
  if (l_systolic !== null && l_diastolic !== null) {
    systolic = l_systolic;
    diastolic = l_diastolic;
    arm = "l";
  }
  //Check for right arm reading
  else if (r_systolic !== null && r_diastolic !== null) {
    systolic = r_systolic;
    diastolic = r_diastolic;
    arm = "r";
  }

  if (systolic === null || diastolic === null || arm === null) return null;

  return {
    systolic: systolic,
    diastolic: diastolic,
    arm: arm,
    timestamp: rawReading.created_at
  };
}

/**
 * Calculate averages from an array of processed readings
 */
export function calculateAverages(readings: Reading[]) {
  if (readings.length === 0) {
    return {
      // Overall averages
      avgSystolic: null,
      avgDiastolic: null,
      readingCount: 0,

      // Left arm specific
      totalLeftSystolic: 0,
      totalLeftDiastolic: 0,
      avgLeftSystolic: null,
      avgLeftDiastolic: null,
      leftReadingCount: 0,

      // Right arm specific
      totalRightSystolic: 0,
      totalRightDiastolic: 0,
      avgRightSystolic: null,
      avgRightDiastolic: null,
      rightReadingCount: 0
    };
  }

  // Separate readings by arm
  const leftReadings = readings.filter(r => r.arm === 'l');
  const rightReadings = readings.filter(r => r.arm === 'r');

  // Calculate overall totals (all readings combined)
  const totalSystolic = readings.reduce((sum, r) => sum + r.systolic, 0);
  const totalDiastolic = readings.reduce((sum, r) => sum + r.diastolic, 0);

  // Calculate left arm totals
  const totalLeftSystolic = leftReadings.reduce((sum, r) => sum + r.systolic, 0);
  const totalLeftDiastolic = leftReadings.reduce((sum, r) => sum + r.diastolic, 0);

  // Calculate right arm totals
  const totalRightSystolic = rightReadings.reduce((sum, r) => sum + r.systolic, 0);
  const totalRightDiastolic = rightReadings.reduce((sum, r) => sum + r.diastolic, 0);

  // Helper function to round to 2 decimal places
  const roundToTwo = (num: number) => Math.round(num * 100) / 100;

  return {
    // Overall averages (all readings combined)
    avgSystolic: roundToTwo(totalSystolic / readings.length),
    avgDiastolic: roundToTwo(totalDiastolic / readings.length),
    readingCount: readings.length,

    // Left arm specific
    avgLeftSystolic: leftReadings.length > 0 ? roundToTwo(totalLeftSystolic / leftReadings.length) : null,
    avgLeftDiastolic: leftReadings.length > 0 ? roundToTwo(totalLeftDiastolic / leftReadings.length) : null,
    leftReadingCount: leftReadings.length,

    // Right arm specific
    avgRightSystolic: rightReadings.length > 0 ? roundToTwo(totalRightSystolic / rightReadings.length) : null,
    avgRightDiastolic: rightReadings.length > 0 ? roundToTwo(totalRightDiastolic / rightReadings.length) : null,
    rightReadingCount: rightReadings.length
  };
}

/**
   * Calculate date range based on timeframe and reference date
   */
export function calculateDateRange(timeframe: string, timezone: string, referenceDate: string | null = null) {
  const now = DateTime.now().setZone(timezone);
  let baseDate = referenceDate ? DateTime.fromISO(referenceDate, { zone: timezone }) : now;
  let startDate, endDate, periodInfo;

  switch (timeframe.toLowerCase()) {
    case 'daily':
      startDate = baseDate.startOf('day');
      endDate = baseDate.endOf('day');
      periodInfo = {
        type: 'daily',
        date: baseDate.toISODate(),
        displayName: baseDate.toFormat('MMMM d, yyyy')
      };
      break;

    case 'weekly':
      startDate = baseDate.startOf('week');
      endDate = baseDate.endOf('week');
      periodInfo = {
        type: 'weekly',
        weekStart: startDate.toISODate(),
        weekEnd: endDate.toISODate(),
        displayName: `Week of ${startDate.toFormat('MMMM d, yyyy')}`
      };
      break;

    case 'monthly':
      startDate = baseDate.startOf('month');
      endDate = baseDate.endOf('month');
      periodInfo = {
        type: 'monthly',
        monthStart: startDate.toISODate(),
        monthEnd: endDate.toISODate(),
        displayName: startDate.toFormat('MMMM yyyy')
      };
      break;

    case 'all_time':
      // Use a very wide date range for all-time
      startDate = DateTime.fromISO('1900-01-01', { zone: timezone });
      endDate = DateTime.fromISO('2100-12-31', { zone: timezone });
      periodInfo = {
        type: 'all_time',
        displayName: 'All Time'
      };
      break;

    default:
      throw new Error(`Invalid timeframe: ${timeframe}. Must be 'daily', 'weekly', 'monthly', or 'all_time'`);
  }

  return {
    startDate: startDate.toUTC(),
    endDate: endDate.toUTC(),
    periodInfo
  };
}

/**
  * Get blood pressure averages for a specific timeframe
  */
export async function getAverages(
  userId: string,
  timeframe: string,
  timezone: string,
  referenceDate: string | null = null
) {
  const { startDate, endDate, periodInfo } = calculateDateRange(timeframe, timezone, referenceDate);
  console.log(`Start Date ${startDate} End Date ${endDate} Period Info ${periodInfo}`);
  let rawReadings;
  if (timeframe.toLowerCase() === 'all_time') {
    // For all-time, we need to get actual first and last reading dates
    const allTimeQuery = `
        SELECT id, created_at, l_systolic, l_diastolic, r_systolic, r_diastolic
        FROM blood_pressure_readings
        WHERE user_id = $1 
          AND (
            (l_systolic IS NOT NULL AND l_diastolic IS NOT NULL) OR
            (r_systolic IS NOT NULL AND r_diastolic IS NOT NULL)
          )
        ORDER BY created_at ASC
      `;
    const result = await pool.query(allTimeQuery, [userId]);
    rawReadings = result.rows;
  } else {
    rawReadings = await getRawReadings(userId, startDate, endDate);
  }

  const validReadings = rawReadings
    .map(reading => extractReadingValues(reading))
    .filter(reading => reading !== null);

  const averages = calculateAverages(validReadings);

  const firstReadingAt = DateTime.fromJSDate(rawReadings[0].created_at).setZone(timezone);
  const lastReadingAt = DateTime.fromJSDate(rawReadings[rawReadings.length - 1].created_at).setZone(timezone);

  // Prepare the response
  const response = {
    ...periodInfo,
    ...averages,
    periodStart: startDate.setZone(timezone).toJSDate(),
    periodEnd: endDate.setZone(timezone).toJSDate(),
    firstReadingAt: firstReadingAt.toJSDate(),
    lastReadingAt: lastReadingAt.toJSDate(),
  };

  // Add specific fields for all-time
  if (timeframe.toLowerCase() === 'all_time' && rawReadings.length > 0) {
    response.displayName = `All Time (${firstReadingAt.toFormat('MMM yyyy')} - ${lastReadingAt.toFormat('MMM yyyy')})`;
  }

  return response;
}

/**
   * Get a comprehensive summary of all timeframes
   */
export async function getSummary(userId: string, timezone: string) {
  const [today, thisWeek, thisMonth, allTime] = await Promise.all([
    getAverages(userId, 'daily', timezone),
    getAverages(userId, 'weekly', timezone),
    getAverages(userId, 'monthly', timezone),
    getAverages(userId, 'all_time', timezone)
  ]);

  return {
    today,
    thisWeek,
    thisMonth,
    allTime
  };
}

interface AverageRangeParams {
  userId: string;
  timezone: string;
  startDate: string;
  endDate: string;
}

/**
 * Get averages for multiple days (useful for charts/trends)
 */
export async function getDailyAveragesRange({ userId, timezone, startDate, endDate }: AverageRangeParams) {
  const start = DateTime.fromISO(startDate, { zone: timezone });
  const end = DateTime.fromISO(endDate, { zone: timezone });

  const dailyAverages = [];
  let currentDate = start;

  while (currentDate <= end) {
    const dayAverage = await getAverages(userId, 'daily', timezone, currentDate.toISODate());
    dailyAverages.push(dayAverage);
    currentDate = currentDate.plus({ days: 1 });
  }

  return dailyAverages;
}

/**
 * Get averages for multiple weeks (useful for charts/trends)
 */
export async function getWeeklyAveragesRange({ userId, timezone, startDate, endDate }: AverageRangeParams) {
  const start = DateTime.fromISO(startDate, { zone: timezone }).startOf('week');
  const end = DateTime.fromISO(endDate, { zone: timezone }).startOf('week');

  const weeklyAverages = [];
  let currentWeek = start;

  while (currentWeek <= end) {
    const weekAverage = await getAverages(userId, 'weekly', timezone, currentWeek.toISODate());
    weeklyAverages.push(weekAverage);
    currentWeek = currentWeek.plus({ weeks: 1 });
  }

  return weeklyAverages;
}

/**
 * Get averages for multiple months (useful for charts/trends)
 */
export async function getMonthlyAveragesRange({ userId, timezone, startDate, endDate }: AverageRangeParams) {
  const start = DateTime.fromISO(startDate, { zone: timezone }).startOf('month');
  const end = DateTime.fromISO(endDate, { zone: timezone }).startOf('month');

  const monthlyAverages = [];
  let currentMonth = start;

  while (currentMonth <= end) {
    const monthAverage = await getAverages(userId, 'monthly', timezone, currentMonth.toISODate());
    monthlyAverages.push(monthAverage);
    currentMonth = currentMonth.plus({ months: 1 });
  }

  return monthlyAverages;
}
