// ---------------------------------------------------------------------------
// IST (Asia/Kolkata) utilities — used across booking flow
// ---------------------------------------------------------------------------

const IST_TZ = 'Asia/Kolkata';
export const MAX_PET_AGE_YEARS = 99;

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns today's date as `YYYY-MM-DD` in IST. */
export function getISTDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

/** Returns current time as `HH:MM` in IST. */
export function getISTTimeString(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Given a booking date (YYYY-MM-DD) and start time (HH:MM) in IST,
 * returns the plain IST start and end time strings after adding a duration.
 * Avoids any UTC conversion — purely IST string arithmetic.
 */
export function computeISTBookingTimes(
  bookingDate: string,
  startTime: string,
  durationMinutes: number,
): { startTime: string; endTime: string; bookingStartISO: string } {
  // Parse as IST by appending the +05:30 offset
  const bookingStart = new Date(`${bookingDate}T${startTime}:00+05:30`);
  const bookingEnd = new Date(bookingStart.getTime() + durationMinutes * 60 * 1000);

  // Format end time in IST
  const endTime = bookingEnd.toLocaleTimeString('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return {
    startTime,
    endTime,
    bookingStartISO: bookingStart.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Age utilities
// ---------------------------------------------------------------------------

/**
 * Calculate age in years from a date of birth
 * @param dateOfBirth - ISO date string (YYYY-MM-DD)
 * @returns Age in years as a number, or null if invalid
 */
export function calculateAgeFromDOB(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) {
    return null;
  }

  try {
    const dob = new Date(dateOfBirth);
    const today = new Date();

    if (isNaN(dob.getTime())) {
      return null;
    }

    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    // If birthday hasn't occurred this year, subtract 1 from age
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    // Ensure age is not negative
    return age >= 0 ? age : null;
  } catch (err) { console.error(err);
    return null;
  }
}

export function getPetDateOfBirthBounds(
  today: Date = new Date(),
  maxPetAgeYears: number = MAX_PET_AGE_YEARS,
): { minDate: string; maxDate: string } {
  const maxDate = formatDateInputValue(today);
  const minDateObject = new Date(today);
  minDateObject.setFullYear(minDateObject.getFullYear() - maxPetAgeYears);

  return {
    minDate: formatDateInputValue(minDateObject),
    maxDate,
  };
}

export function isPetDateOfBirthWithinBounds(
  dateOfBirth: string | null | undefined,
  maxPetAgeYears: number = MAX_PET_AGE_YEARS,
): boolean {
  if (!dateOfBirth) {
    return true;
  }

  const age = calculateAgeFromDOB(dateOfBirth);
  return age !== null && age <= maxPetAgeYears;
}
