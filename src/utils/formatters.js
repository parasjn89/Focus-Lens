/**
 * Formats a total number of seconds into a HH:MM:SS or MM:SS display string.
 * @param {number} totalSeconds - Total number of seconds to format.
 * @returns {string} Formatted string, e.g. "25:00" or "01:30:00".
 */
export function formatSecondsToTime(totalSeconds) {
  if (totalSeconds < 0 || isNaN(totalSeconds)) return '00:00';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num) => String(num).padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Formats duration in minutes into human-readable text.
 * @param {number} totalMinutes 
 * @returns {string} e.g. "25 mins" or "1 hr 30 mins"
 */
export function formatMinutesText(totalMinutes) {
  if (!totalMinutes) return '0 mins';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours > 0 && mins > 0) {
    return `${hours} hr ${mins} mins`;
  } else if (hours > 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  return `${mins} mins`;
}
