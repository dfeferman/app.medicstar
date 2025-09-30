/**
 * Converts cron expressions to human-readable UTC format
 * Supports all standard cron patterns including intervals, ranges, lists, and step values
 */

interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

/**
 * Parse a cron field into readable format
 */
function parseField(field: string, type: 'minute' | 'hour' | 'day' | 'month' | 'weekday'): string {
  if (field === '*') {
    return type === 'weekday' ? 'every day' : 'every';
  }

  // Handle intervals (e.g., */5, */30)
  if (field.startsWith('*/')) {
    const interval = parseInt(field.substring(2));
    if (!isNaN(interval)) {
      switch (type) {
        case 'minute': return `every ${interval} minutes`;
        case 'hour': return `every ${interval} hours`;
        case 'day': return `every ${interval} days`;
        case 'month': return `every ${interval} months`;
        case 'weekday': return `every ${interval} weekdays`;
      }
    }
  }

  // Handle ranges (e.g., 9-17, 1-5)
  if (field.includes('-')) {
    const [start, end] = field.split('-');
    const startNum = parseInt(start);
    const endNum = parseInt(end);
    if (!isNaN(startNum) && !isNaN(endNum)) {
      switch (type) {
        case 'minute': return `${start}-${end} minutes`;
        case 'hour': return `${start}:00-${end}:00`;
        case 'day': return `days ${start}-${end}`;
        case 'month': return `months ${start}-${end}`;
        case 'weekday': return `weekdays ${start}-${end}`;
      }
    }
  }

  // Handle lists (e.g., 1,3,5, 9,12,15)
  if (field.includes(',')) {
    const values = field.split(',').map(v => v.trim());
    switch (type) {
      case 'minute': return `at minutes ${values.join(', ')}`;
      case 'hour': return `at ${values.join(', ')}:00`;
      case 'day': return `on days ${values.join(', ')}`;
      case 'month': return `in months ${values.join(', ')}`;
      case 'weekday': return `on weekdays ${values.join(', ')}`;
    }
  }

  // Handle step values with ranges (e.g., 0-23/2, 1-31/3)
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepNum = parseInt(step);
    if (!isNaN(stepNum)) {
      if (range.includes('-')) {
        const [start, end] = range.split('-');
        const startNum = parseInt(start);
        const endNum = parseInt(end);
        if (!isNaN(startNum) && !isNaN(endNum)) {
          switch (type) {
            case 'minute': return `every ${stepNum} minutes from ${start} to ${end}`;
            case 'hour': return `every ${stepNum} hours from ${start}:00 to ${end}:00`;
            case 'day': return `every ${stepNum} days from ${start} to ${end}`;
            case 'month': return `every ${stepNum} months from ${start} to ${end}`;
            case 'weekday': return `every ${stepNum} weekdays from ${start} to ${end}`;
          }
        }
      } else {
        // Step from specific value (e.g., 5/10)
        const startNum = parseInt(range);
        if (!isNaN(startNum)) {
          switch (type) {
            case 'minute': return `every ${stepNum} minutes starting at ${startNum}`;
            case 'hour': return `every ${stepNum} hours starting at ${startNum}:00`;
            case 'day': return `every ${stepNum} days starting on ${startNum}`;
            case 'month': return `every ${stepNum} months starting in ${startNum}`;
            case 'weekday': return `every ${stepNum} weekdays starting on ${startNum}`;
          }
        }
      }
    }
  }

  // Handle single values
  const num = parseInt(field);
  if (!isNaN(num)) {
    switch (type) {
      case 'minute': return `at minute ${num}`;
      case 'hour': return `at ${num.toString().padStart(2, '0')}:00`;
      case 'day': return `on day ${num}`;
      case 'month': return `in month ${num}`;
      case 'weekday': return `on weekday ${num}`;
    }
  }

  return field; // Return original if can't parse
}

/**
 * Get weekday name from number (0=Sunday, 1=Monday, etc.)
 */
function getWeekdayName(dayNum: number): string {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return weekdays[dayNum] || dayNum.toString();
}

/**
 * Get month name from number
 */
function getMonthName(monthNum: number): string {
  const months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return months[monthNum] || monthNum.toString();
}

/**
 * Main function to format cron expression
 */
export function formatCronToUTC(cronExpression: string): string {
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    return cronExpression; // Return original if not a valid 5-part cron
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const cronParts: CronParts = { minute, hour, dayOfMonth, month, dayOfWeek };

  // Handle special cases first
  if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Daily at 00:00 UTC';
  }

  // Daily at specific time
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const hourNum = parseInt(hour);
    const minuteNum = parseInt(minute);

    if (!isNaN(hourNum) && !isNaN(minuteNum)) {
      const hourStr = hourNum.toString().padStart(2, '0');
      const minuteStr = minuteNum.toString().padStart(2, '0');
      return `Daily at ${hourStr}:${minuteStr} UTC`;
    }
  }

  // Build description based on complexity
  const descriptions: string[] = [];

  // Parse each field
  const minuteDesc = parseField(minute, 'minute');
  const hourDesc = parseField(hour, 'hour');
  const dayDesc = parseField(dayOfMonth, 'day');
  const monthDesc = parseField(month, 'month');
  const weekdayDesc = parseField(dayOfWeek, 'weekday');

  // Determine if it's a simple daily/hourly pattern
  const isDaily = dayOfMonth === '*' && month === '*' && dayOfWeek === '*';
  const isHourly = minute !== '*' && hour === '*' && isDaily;
  const isMinutely = minute !== '*' && hour === '*' && isDaily;

  if (isDaily) {
    if (minute === '0' && !hour.includes('*') && !hour.includes('/')) {
      // Specific hour
      descriptions.push(`Daily at ${hourDesc} UTC`);
    } else if (hour.includes('*/') && minute === '0') {
      // Every X hours
      descriptions.push(hourDesc.replace('every ', 'Every ').replace(' hours', ' hours UTC'));
    } else if (minute.includes('*/') && hour === '*') {
      // Every X minutes
      descriptions.push(minuteDesc.replace('every ', 'Every ').replace(' minutes', ' minutes UTC'));
    } else if (!minute.includes('*') && !hour.includes('*')) {
      // Specific time
      const hourNum = parseInt(hour);
      const minuteNum = parseInt(minute);
      if (!isNaN(hourNum) && !isNaN(minuteNum)) {
        const hourStr = hourNum.toString().padStart(2, '0');
        const minuteStr = minuteNum.toString().padStart(2, '0');
        descriptions.push(`Daily at ${hourStr}:${minuteStr} UTC`);
      }
    } else {
      descriptions.push(`Daily: ${hourDesc}, ${minuteDesc}`);
    }
  } else {
    // More complex patterns
    if (month !== '*') descriptions.push(monthDesc);
    if (dayOfMonth !== '*') descriptions.push(dayDesc);
    if (dayOfWeek !== '*') descriptions.push(weekdayDesc);
    if (hour !== '*') descriptions.push(hourDesc);
    if (minute !== '*') descriptions.push(minuteDesc);
  }

  // If we have a good description, return it with UTC
  if (descriptions.length > 0) {
    const result = descriptions.join(', ');
    return result.includes('UTC') ? result : `${result} UTC`;
  }

  // Fallback: return formatted cron expression
  return `${cronExpression} UTC`;
}
