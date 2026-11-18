/**
 * Cycle utility functions
 * A cycle runs from 11:45 AM to next morning 4:00 AM
 */

/**
 * Get the cycle date for a given timestamp
 * Cycle date represents the start date of the cycle (11:45 AM)
 * @param {Date|string} dateTime - The date/time to get cycle for
 * @returns {Object} - { cycleDate: string (YYYY-MM-DD), cycleStart: Date, cycleEnd: Date, cycleLabel: string }
 */
export function getCycleForDate(dateTime) {
  const date = new Date(dateTime);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const currentTime = hours * 60 + minutes; // minutes since midnight
  const cycleStartTime = 11 * 60 + 45; // 11:45 AM in minutes
  const cycleEndTime = 4 * 60; // 4:00 AM in minutes

  let cycleDate;
  let cycleStart;
  let cycleEnd;

  // If time is between 11:45 AM and 11:59 PM, cycle date is current date
  if (currentTime >= cycleStartTime) {
    cycleDate = new Date(date);
    cycleDate.setHours(11, 45, 0, 0);
    cycleStart = new Date(cycleDate);
    cycleEnd = new Date(cycleDate);
    cycleEnd.setDate(cycleEnd.getDate() + 1);
    cycleEnd.setHours(4, 0, 0, 0);
  } 
  // If time is between 12:00 AM and 4:00 AM, cycle date is previous date
  else if (currentTime < cycleEndTime) {
    cycleDate = new Date(date);
    cycleDate.setDate(cycleDate.getDate() - 1);
    cycleDate.setHours(11, 45, 0, 0);
    cycleStart = new Date(cycleDate);
    cycleEnd = new Date(cycleDate);
    cycleEnd.setDate(cycleEnd.getDate() + 1);
    cycleEnd.setHours(4, 0, 0, 0);
  }
  // Between 4:00 AM and 11:45 AM - belongs to previous cycle
  else {
    cycleDate = new Date(date);
    cycleDate.setDate(cycleDate.getDate() - 1);
    cycleDate.setHours(11, 45, 0, 0);
    cycleStart = new Date(cycleDate);
    cycleEnd = new Date(cycleDate);
    cycleEnd.setDate(cycleEnd.getDate() + 1);
    cycleEnd.setHours(4, 0, 0, 0);
  }

  // Format cycle date as YYYY-MM-DD
  const cycleDateStr = cycleDate.toISOString().split('T')[0];
  
  // Format cycle label
  const cycleLabel = formatCycleLabel(cycleDate, cycleEnd);

  return {
    cycleDate: cycleDateStr,
    cycleStart: cycleStart.toISOString(),
    cycleEnd: cycleEnd.toISOString(),
    cycleLabel,
  };
}

/**
 * Format cycle label for display
 */
function formatCycleLabel(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startDateStr = start.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
  const endDateStr = end.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
  
  return `${startDateStr} 11:45 AM - ${endDateStr} 4:00 AM`;
}

/**
 * Get all unique cycle dates from bills
 */
export function getUniqueCycles(bills) {
  const cycles = new Map();
  bills.forEach(bill => {
    if (bill.cycleDate) {
      if (!cycles.has(bill.cycleDate)) {
        cycles.set(bill.cycleDate, {
          cycleDate: bill.cycleDate,
          cycleLabel: bill.cycleLabel || bill.cycleDate,
          billCount: 0,
          totalAmount: 0,
        });
      }
      const cycle = cycles.get(bill.cycleDate);
      cycle.billCount += 1;
      cycle.totalAmount += bill.total || 0;
    }
  });
  
  return Array.from(cycles.values()).sort((a, b) => 
    new Date(b.cycleDate).getTime() - new Date(a.cycleDate).getTime()
  );
}

/**
 * Filter bills by cycle date
 */
export function filterBillsByCycle(bills, cycleDate) {
  return bills.filter(bill => bill.cycleDate === cycleDate);
}

