/**
 * Email Validator
 *
 * A comprehensive email validation library that performs multiple checks:
 * - Syntax validation using regex
 * - Disposable/fake email detection
 * - DNS MX record verification
 * - SMTP server handshake for deliverability testing
 *
 * @module simple-email-validator
 */

import dns from 'dns/promises'
import { isFakeEmail } from 'fakefilter'
import net from 'net'

/**
 * Regular expression for validating email syntax.
 *
 * Rules:
 * - Cannot start with a dot
 * - Cannot have consecutive dots
 * - Allows alphanumeric, underscore, plus, apostrophe, hyphen, and dot in local part
 * - Must end with alphanumeric or specific allowed characters before @
 * - Domain must have valid structure with at least 2-character TLD
 */
const emailRegex: RegExp =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/

/**
 * Result of email validation containing status and technical details.
 */
export interface ValidationResult {
  /**
   * Validation result:
   * - `true`: Email is deliverable and safe
   * - `false`: Email is invalid or undeliverable
   * - `null`: Cannot verify (timeout, greylisting, or provider blocks verification)
   */
  isValid: boolean | null

  /** Human-readable status message describing the validation result */
  status: string

  /** Technical details or error message (optional) */
  reason?: string

  /** The MX record hostname used for SMTP verification (optional) */
  mxRecord?: string
}

/**
 * Determines if an SMTP reply indicates a hard bounce (permanent failure).
 *
 * Hard bounces are 5xx errors that indicate the email address doesn't exist,
 * excluding spam/junk-related blocks which may be temporary or false positives.
 *
 * @param smtpReply - The SMTP server response message
 * @returns `true` if this is a hard bounce indicating non-existent user
 *
 * @example
 * isHardBounce('550 User not found') // returns true
 * isHardBounce('550 Blocked by spam filter') // returns false
 */
function isHardBounce(smtpReply: string): boolean {
  const is5xx = /^(510|511|513|550|551|553)/.test(smtpReply)
  const isSpamBlock = /(junk|spam|openspf|spoofing|host|rbl.+blocked)/gi.test(
    smtpReply
  )
  return is5xx && !isSpamBlock
}

/**
 * Retrieves the highest priority MX (Mail Exchange) record for a domain.
 *
 * MX records are sorted by priority (lower number = higher priority).
 * Returns the exchange hostname of the best available mail server.
 *
 * @param domain - The domain to look up MX records for
 * @returns The hostname of the primary MX server, or `null` if none found
 *
 * @example
 * await getBestMx('gmail.com') // returns 'gmail-smtp-in.l.google.com'
 */
async function getBestMx(domain: string): Promise<string | null> {
  try {
    const records = await dns.resolveMx(domain)
    if (!records || records.length === 0) return null
    // Sort by priority (ascending) and return the exchange of the first record
    return records.sort((a, b) => a.priority - b.priority)[0]?.exchange || null
  } catch (error) {
    return null
  }
}

/**
 * Validates an email address through multiple verification steps.
 *
 * Validation process:
 * 1. **Syntax Check**: Validates email format using regex (optional)
 * 2. **Disposable Email Check**: Detects temporary/fake email providers (optional)
 * 3. **DNS MX Check**: Verifies domain has mail servers configured
 * 4. **Provider Detection**: Skips SMTP for major providers that block verification
 * 5. **SMTP Handshake**: Tests actual deliverability by connecting to mail server
 *
 * @param options - Validation configuration options
 * @param options.email - The email address to validate
 * @param options.timeoutMs - Timeout for SMTP connection in milliseconds (default: 5000)
 * @param options.regexCheck - Enable syntax validation (default: true)
 * @param options.fakeEmailCheck - Enable disposable email detection (default: true)
 *
 * @returns Promise resolving to validation result with status and details
 *
 * @example
 * ```typescript
 * // Basic validation
 * const result = await validateEmail({ email: 'user@example.com' })
 * if (result.isValid === true) {
 *   console.log('Email is deliverable')
 * }
 *
 * // Custom timeout
 * const result = await validateEmail({
 *   email: 'user@example.com',
 *   timeoutMs: 10000
 * })
 *
 * // Skip certain checks
 * const result = await validateEmail({
 *   email: 'user@example.com',
 *   regexCheck: false,
 *   fakeEmailCheck: false
 * })
 * ```
 */
export async function validateEmail({
  email,
  timeoutMs = 5000,
  regexCheck = true,
  fakeEmailCheck = true
}: {
  email: string
  timeoutMs?: number
  regexCheck?: boolean
  fakeEmailCheck?: boolean
}): Promise<ValidationResult> {
  // STEP 1: Syntax Validation
  const syntaxCheck = regexCheck ? emailRegex.test(email) : true
  if (!syntaxCheck) {
    return {
      isValid: false,
      status: 'Invalid Syntax',
      reason:
        'Email does not match standard format or contains invalid characters'
    }
  }

  const [_, domain] = email.split('@')

  // STEP 2: Disposable Domain Check (fakefilter)
  const disposableCheck = fakeEmailCheck ? isFakeEmail(email) : false
  if (disposableCheck) {
    return {
      isValid: false,
      status: 'Disposable Email Detected',
      reason: `Matched provider: ${disposableCheck}`
    }
  }

  // STEP 3: DNS MX Check
  const mxHost = await getBestMx(domain!)
  if (!mxHost) {
    return { isValid: false, status: 'No MX Records (Domain Dead)' }
  }

  // STEP 4: Skip SMTP check for known blockers (Yahoo/Outlook/AOL/iCloud)
  // These major email providers often block direct SMTP verification attempts
  // from non-whitelisted IPs to prevent abuse. Returning "Unknown" is safer
  // than a false negative that could reject valid emails.
  if (/yahoo\.|hotmail\.|outlook\.|aol\.|icloud\./.test(mxHost)) {
    return {
      isValid: null,
      status: 'Skipped SMTP (Provider blocks pings)',
      reason:
        'Provider likely blocks direct SMTP checks, cannot verify deliverability',
      mxRecord: mxHost
    }
  }

  // STEP 5: SMTP Handshake - Connect to mail server and verify deliverability
  return new Promise(resolve => {
    const socket = net.createConnection(25, mxHost)
    let step = 0 // Track position in SMTP conversation
    let hasResolved = false

    /**
     * Completes the validation and cleans up the socket connection.
     * Ensures we only resolve once even if multiple events fire.
     */
    const done = (result: ValidationResult) => {
      if (hasResolved) return
      hasResolved = true
      socket.destroy()
      resolve({ ...result, mxRecord: mxHost })
    }

    socket.setTimeout(timeoutMs, () => {
      done({
        isValid: null,
        status: 'Timeout',
        reason: 'Server slow/unresponsive'
      })
    })

    socket.on('error', err => {
      done({ isValid: null, status: 'Connection Error', reason: err.message })
    })

    let buffer = ''

    socket.on('data', data => {
      buffer += data.toString()

      // Process complete lines only (SMTP responses are line-based)
      let d_index
      while ((d_index = buffer.indexOf('\n')) > -1) {
        const line = buffer.substring(0, d_index).trim()
        buffer = buffer.substring(d_index + 1) // Keep remainder for next iteration

        // Skip multiline intermediates (e.g. "220-content")
        // But DO NOT skip the final line (e.g. "220 content")
        // The hyphen indicates more lines are coming
        if (/^\d{3}-/.test(line)) {
          continue
        }

        const code = parseInt(line.substring(0, 3))

        // Early fail on hard bounces (user doesn't exist)
        if (isHardBounce(line)) {
          return done({
            isValid: false,
            status: 'User Unknown',
            reason: line
          })
        }

        // If server is unavailable/blocking (not a standard success code)
        if (code !== 220 && code !== 250) {
          return done({
            isValid: null,
            status: 'Server Reject (Greylist/Spam)',
            reason: line
          })
        }

        // SMTP State Machine - Progress through handshake steps
        if (step === 0 && code === 220) {
          // Step 0: Server greeting received, send HELO
          socket.write(`HELO ${domain}\r\n`)
          step++
        } else if (step === 1 && code === 250) {
          // Step 1: HELO accepted, send MAIL FROM
          socket.write(`MAIL FROM:<${email}>\r\n`)
          step++
        } else if (step === 2 && code === 250) {
          // Step 2: MAIL FROM accepted, send RCPT TO (the actual test)
          socket.write(`RCPT TO:<${email}>\r\n`)
          step++
        } else if (step === 3) {
          // Step 3: Final result - does the server accept this recipient?
          if (code === 250) {
            done({ isValid: true, status: 'Deliverable' })
          } else {
            done({ isValid: false, status: 'User Unknown', reason: line })
          }
        }
      }
    })
  })
}
