/**
 * Parse relative date expressions using GPT (with fallback to manual parsing)
 * Handles: "tomorrow", "next monday", "friday", "in 3 days", etc.
 */
export async function parseRelativeDate(dateString: string): Promise<string> {
  // First try GPT parsing
  try {
    const response = await fetch("/api/parse-date", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dateString }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.date && result.confidence >= 0.5) {
        return result.date;
      }
    }
  } catch (error) {
    console.error("GPT date parsing error:", error);
    // Fall through to manual parsing
  }

  // Fallback to manual parsing if GPT fails
  return parseRelativeDateManual(dateString);
}

/**
 * Manual fallback parser for relative date expressions into YYYY-MM-DD format
 * Handles: "tomorrow", "next monday", "friday", etc.
 */
function parseRelativeDateManual(dateString: string): string {
  const lower = dateString.toLowerCase().trim();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check for exact date format first (YYYY-MM-DD)
  const exactDateMatch = dateString.match(/^\d{4}-\d{2}-\d{2}$/);
  if (exactDateMatch) {
    return dateString;
  }
  
  // Tomorrow
  if (lower === "tomorrow" || lower === "tom") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }
  
  // Today
  if (lower === "today") {
    return today.toISOString().split("T")[0];
  }
  
  // Day names (next occurrence)
  const dayNames: Record<string, number> = {
    "sunday": 0,
    "monday": 1,
    "tuesday": 2,
    "wednesday": 3,
    "thursday": 4,
    "friday": 5,
    "saturday": 6,
    "sun": 0,
    "mon": 1,
    "tue": 2,
    "wed": 3,
    "thu": 4,
    "fri": 5,
    "sat": 6,
  };
  
  // Check for "next [day]" pattern
  const nextDayMatch = lower.match(/^next\s+(.+)$/);
  if (nextDayMatch) {
    const dayName = nextDayMatch[1].trim();
    if (dayNames[dayName] !== undefined) {
      const targetDay = dayNames[dayName];
      const result = new Date(today);
      const currentDay = result.getDay();
      let daysToAdd = targetDay - currentDay;
      
      // For "next [day]", always add at least 7 days (next week's occurrence)
      if (daysToAdd <= 0) {
        daysToAdd += 7;
      } else {
        daysToAdd += 7; // "next" means next week, not this week
      }
      
      result.setDate(result.getDate() + daysToAdd);
      return result.toISOString().split("T")[0];
    }
  }
  
  // Check for just day name (next occurrence)
  if (dayNames[lower] !== undefined) {
    const targetDay = dayNames[lower];
    const result = new Date(today);
    const currentDay = result.getDay();
    let daysToAdd = targetDay - currentDay;
    
    // If the day has already passed this week, add 7 days to get next week's occurrence
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
    
    result.setDate(result.getDate() + daysToAdd);
    return result.toISOString().split("T")[0];
  }
  
  // Check for "this [day]" pattern
  const thisDayMatch = lower.match(/^this\s+(.+)$/);
  if (thisDayMatch) {
    const dayName = thisDayMatch[1].trim();
    if (dayNames[dayName] !== undefined) {
      const targetDay = dayNames[dayName];
      const result = new Date(today);
      const currentDay = result.getDay();
      let daysToAdd = targetDay - currentDay;
      
      // If the day has already passed, add 7 days
      if (daysToAdd < 0) {
        daysToAdd += 7;
      }
      
      result.setDate(result.getDate() + daysToAdd);
      return result.toISOString().split("T")[0];
    }
  }
  
  // If we can't parse it, return as-is (will be stored but might cause issues)
  // In a production system, you'd want to use a proper date parsing library
  return dateString;
}