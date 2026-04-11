export type FriendlyApiError = {
  message: string;
  status: number;
  code?: string;
};

/**
 * Supabase/PostgreSQL error code mapping
 * Maps database error codes to user-friendly messages and HTTP status codes
 */
function mapSupabaseErrorCode(code: string | undefined, message: string): { status: number; message: string } | null {
  if (!code) return null;

  // Database constraint violations
  if (code === '23505') {
    // Unique constraint violation
    if (message.includes('email')) return { status: 400, message: 'This email is already registered.' };
    if (message.includes('phone')) return { status: 400, message: 'This phone number is already in use.' };
    if (message.includes('code')) return { status: 400, message: 'This code is already in use.' };
    return { status: 400, message: 'This value is already taken. Please try a different one.' };
  }

  if (code === '23503') {
    // Foreign key constraint violation
    return { status: 400, message: 'Referenced record not found. Please verify your selection.' };
  }

  if (code === '23514') {
    // Check constraint violation
    return { status: 400, message: 'Invalid value. Please check your input.' };
  }

  if (code === '22001') {
    // String data right truncation (too long)
    return { status: 400, message: 'Input is too long. Please shorten it.' };
  }

  // Permission and authentication errors
  if (code === '42501') {
    // Permission denied
    return { status: 403, message: 'You do not have permission to perform this action.' };
  }

  if (code === '42503') {
    // Lock not available
    return { status: 409, message: 'Resource is busy. Please try again.' };
  }

  // Table or object not found (typically safe to hide)
  if (code === '42P01') {
    return { status: 500, message: 'Service temporarily unavailable. Please try again.' };
  }

  // Undefined function or invalid operation
  if (code === '42883') {
    return { status: 500, message: 'Invalid operation. Please try again.' };
  }

  if (code === '42703') {
    return {
      status: 500,
      message:
        'Database schema is outdated or missing required columns. Run schema migrations and the schema health check.',
    };
  }

  if (code === 'PGRST204') {
    return {
      status: 500,
      message:
        'Database schema is outdated or missing required columns. Run schema migrations and the schema health check.',
    };
  }

  // Invalid transaction state
  if (code === '25001' || code === '25002') {
    return { status: 500, message: 'Transaction error. Please try again.' };
  }

  // Connection or IO errors
  if (code === '08003' || code === '08006') {
    return { status: 503, message: 'Database service temporarily unavailable. Please try again.' };
  }

  // Insufficient resources
  if (code === '53300') {
    return { status: 503, message: 'Service is temporarily overloaded. Please try again.' };
  }

  return null;
}

/**
 * Map error messages (non-database-specific) to user-friendly versions
 */
function mapKnownMessageToStatus(message: string) {
  const normalized = message.toLowerCase();

  // Booking-specific errors
  if (normalized.includes('bookings_overlap') || normalized.includes('slot is no longer available')) {
    return { status: 409, message: 'Selected time slot is no longer available.' };
  }

  if (normalized.includes('pet_ownership_invalid') || normalized.includes('does not belong')) {
    return { status: 403, message: 'Pet does not belong to this user.' };
  }

  if (normalized.includes('home_visit_location_required')) {
    return { status: 400, message: 'Home visit bookings require address and geo coordinates.' };
  }

  if (normalized.includes('invalid_booking_transition')) {
    return { status: 409, message: 'Invalid booking status transition.' };
  }

  if (normalized.includes('booking_status_noop')) {
    return { status: 409, message: 'Booking is already in the requested status.' };
  }

  if (normalized.includes('booking_status_missing')) {
    return { status: 500, message: 'Booking status data is incomplete. Run schema backfill/migrations for bookings.' };
  }

  if (normalized.includes('booking_schema_outdated')) {
    return {
      status: 500,
      message: 'Booking schema is outdated. Run the latest database migrations and schema health checks.',
    };
  }

  // Authorization errors
  if (normalized.includes('forbidden') || normalized.includes('role_transition_forbidden')) {
    return { status: 403, message: 'You do not have permission to perform this action.' };
  }

  if (normalized.includes('unauthorized') || normalized.includes('not authenticated')) {
    return { status: 401, message: 'Sign in to continue.' };
  }

  // Service not found or unavailable
  if (normalized.includes('service not found')) {
    return { status: 404, message: 'Service not found.' };
  }

  if (normalized.includes('provider not found')) {
    return { status: 404, message: 'Provider not found.' };
  }

  if (normalized.includes('not found')) {
    return { status: 404, message: 'Record not found.' };
  }

  // Discount-related errors
  if (normalized.includes('discount') && normalized.includes('not found')) {
    return { status: 404, message: 'Discount code not found.' };
  }

  if (normalized.includes('discount') && (normalized.includes('expired') || normalized.includes('invalid'))) {
    return { status: 400, message: 'Discount code is not valid.' };
  }

  // Package-related errors
  if (normalized.includes('package') && normalized.includes('not found')) {
    return { status: 404, message: 'Package not found.' };
  }

  return null;
}

export function toFriendlyApiError(error: unknown, fallbackMessage = 'Something went wrong'): FriendlyApiError {
  const objectMessage =
    error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? ((error as { message: string }).message ?? '').trim()
      : '';

  // Handle Supabase-specific errors with code property
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as { code?: string; message?: string };
    const codeMapping = mapSupabaseErrorCode(dbError.code, dbError.message || '');
    if (codeMapping) {
      return { ...codeMapping, code: dbError.code };
    }
  }

  // Extract message from Error objects
  const message = error instanceof Error ? error.message : objectMessage || String(error);

  // Try to map by message content first
  const mapped = mapKnownMessageToStatus(message);
  if (mapped) {
    return { ...mapped };
  }

  // Filter any database-specific details from raw message strings
  const sanitizedMessage = sanitizeDatabaseError(message);

  return {
    message: sanitizedMessage || fallbackMessage,
    status: 500,
  };
}

/**
 * Sanitize database error messages to prevent information leakage
 */
function sanitizeDatabaseError(message: string): string {
  // Remove SQL details
  message = message.replace(/SQL statement:.*$/i, '');
  message = message.replace(/HINT:.*$/i, '');
  message = message.replace(/CONTEXT:.*$/i, '');

  // Remove table/column names if clearly a database error
  if (message.includes('relation') || message.includes('column') || message.includes('table')) {
    return ''; // Return empty to trigger fallback
  }

  // Remove line numbers from database errors
  message = message.replace(/line \d+/g, '');

  return message.trim();
}
