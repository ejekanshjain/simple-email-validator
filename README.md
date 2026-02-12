# Simple Email Validator

A comprehensive TypeScript email validation library that goes beyond basic syntax checking. It verifies email deliverability through DNS MX records, SMTP handshakes, and detects disposable email addresses.

## Features

- ✅ **Syntax Validation** - Validates email format against RFC-compliant patterns
- 🚫 **Disposable Email Detection** - Blocks temporary and fake email providers
- 🌐 **DNS MX Verification** - Confirms domain has valid mail servers
- 📬 **SMTP Deliverability Test** - Connects to mail servers to verify address existence
- ⚡ **Smart Provider Handling** - Skips SMTP checks for providers that block verification (Yahoo, Outlook, etc.)
- 🎛️ **Configurable** - Enable/disable specific validation checks as needed
- 🔒 **TypeScript Native** - Full type safety with comprehensive interfaces

## Installation

```bash
npm install @ejekanshjain/simple-email-validator
```

or

```bash
pnpm install @ejekanshjain/simple-email-validator
```

or

```bash
bun install @ejekanshjain/simple-email-validator
```

## Quick Start

```typescript
import { validateEmail } from '@ejekanshjain/simple-email-validator'

const result = await validateEmail({ email: 'user@example.com' })

if (result.isValid === true) {
  console.log('✓ Email is valid and deliverable')
} else if (result.isValid === false) {
  console.log(`✗ Invalid: ${result.status}`)
} else {
  console.log(`⚠ Could not verify: ${result.status}`)
}
```

## Validation Process

The library performs validation in multiple steps:

1. **Syntax Check** - Validates email format using regex
   - Cannot start with a dot
   - Cannot have consecutive dots
   - Allows alphanumeric, underscore, plus, apostrophe, hyphen, and dot
   - Domain must have proper structure with at least 2-character TLD

2. **Disposable Email Check** - Detects temporary/fake email providers
   - Uses the `fakefilter` package to identify known disposable domains

3. **DNS MX Check** - Verifies domain has mail servers configured
   - Queries DNS for MX records
   - Selects the highest priority mail server

4. **Provider Detection** - Identifies providers that block verification
   - Skips SMTP for Yahoo, Outlook, Hotmail, AOL, iCloud
   - Prevents false negatives from anti-verification measures

5. **SMTP Handshake** - Tests actual deliverability
   - Connects to the mail server on port 25
   - Performs HELO/MAIL FROM/RCPT TO handshake
   - Detects hard bounces vs temporary issues

## API Reference

### `validateEmail(options)`

Validates an email address through multiple verification steps.

#### Parameters

```typescript
{
  email: string           // The email address to validate (required)
  timeoutMs?: number      // SMTP connection timeout in ms (default: 5000)
  regexCheck?: boolean    // Enable syntax validation (default: true)
  fakeEmailCheck?: boolean // Enable disposable email detection (default: true)
}
```

#### Returns

```typescript
Promise<ValidationResult>
```

### `ValidationResult` Interface

```typescript
interface ValidationResult {
  /**
   * Validation result:
   * - `true`: Email is deliverable and safe
   * - `false`: Email is invalid or undeliverable
   * - `null`: Cannot verify (timeout, greylisting, or provider blocks)
   */
  isValid: boolean | null

  /** Human-readable status message */
  status: string

  /** Technical details or error message */
  reason?: string

  /** The MX record hostname used for verification */
  mxRecord?: string
}
```

## Usage Examples

### Basic Validation

```typescript
import { validateEmail } from '@ejekanshjain/simple-email-validator'

const result = await validateEmail({
  email: 'john.doe@gmail.com'
})

console.log(result)
// {
//   isValid: null,
//   status: 'Skipped SMTP (Provider blocks pings)',
//   reason: 'Provider likely blocks direct SMTP checks, cannot verify deliverability',
//   mxRecord: 'gmail-smtp-in.l.google.com'
// }
```

### Custom Timeout

```typescript
const result = await validateEmail({
  email: 'user@slowserver.com',
  timeoutMs: 10000 // Wait up to 10 seconds
})
```

### Skip Specific Checks

```typescript
// Only perform SMTP verification, skip syntax and disposable checks
const result = await validateEmail({
  email: 'user@example.com',
  regexCheck: false,
  fakeEmailCheck: false
})
```

### Handling Different Results

```typescript
const result = await validateEmail({ email: userInput })

if (result.isValid === true) {
  // Email is verified deliverable
  await sendWelcomeEmail(userInput)
} else if (result.isValid === false) {
  // Email is definitely invalid
  switch (result.status) {
    case 'Invalid Syntax':
      console.error('Please enter a valid email format')
      break
    case 'Disposable Email Detected':
      console.error('Temporary email addresses are not allowed')
      break
    case 'No MX Records (Domain Dead)':
      console.error('This domain cannot receive emails')
      break
    case 'User Unknown':
      console.error('This email address does not exist')
      break
  }
} else {
  // Could not verify (null)
  // Decision: accept or reject based on your risk tolerance
  console.warn(`Could not verify email: ${result.status}`)
  // You might choose to accept these emails anyway
}
```

### Form Validation Example

```typescript
async function validateRegistrationEmail(email: string): Promise<{
  valid: boolean
  message: string
}> {
  const result = await validateEmail({ email })

  // Treat null as valid (cannot verify, but not definitively invalid)
  if (result.isValid === true || result.isValid === null) {
    return { valid: true, message: 'Email accepted' }
  }

  // Customize messages for different failure modes
  const messages: Record<string, string> = {
    'Invalid Syntax': 'Please enter a valid email address',
    'Disposable Email Detected': 'Temporary email addresses are not allowed',
    'No MX Records (Domain Dead)': 'This domain cannot receive emails',
    'User Unknown': 'This email address does not exist'
  }

  return {
    valid: false,
    message: messages[result.status] || 'Email validation failed'
  }
}
```

## Possible Status Values

| Status                                 | `isValid` | Description                                |
| -------------------------------------- | --------- | ------------------------------------------ |
| `Deliverable`                          | `true`    | Email passed all checks and is deliverable |
| `Invalid Syntax`                       | `false`   | Email format is invalid                    |
| `Disposable Email Detected`            | `false`   | Temporary/fake email provider detected     |
| `No MX Records (Domain Dead)`          | `false`   | Domain has no mail servers configured      |
| `User Unknown`                         | `false`   | SMTP server rejected the recipient         |
| `Skipped SMTP (Provider blocks pings)` | `null`    | Major provider that blocks verification    |
| `Timeout`                              | `null`    | SMTP server didn't respond in time         |
| `Connection Error`                     | `null`    | Could not connect to mail server           |
| `Server Reject (Greylist/Spam)`        | `null`    | Server blocked the verification attempt    |

## Important Considerations

### False Positives/Negatives

- **False Negatives**: Some valid emails may return `null` because:
  - Major providers (Gmail, Yahoo, Outlook) block SMTP verification
  - Servers implement greylisting
  - Anti-spam measures block unknown connections
- **False Positives**: Some invalid emails may appear valid if:
  - The SMTP server accepts all recipients (catch-all)
  - The server doesn't immediately reject non-existent users

### Rate Limiting

- SMTP verification creates network connections to mail servers
- Excessive validation attempts may trigger rate limits or blacklisting
- Consider caching results or implementing your own rate limiting

### Privacy & Security

- SMTP handshakes are visible in mail server logs
- Some users may consider this intrusive
- Use SMTP verification judiciously, especially for high-volume applications

### Performance

- Full validation can take 1-5 seconds per email
- DNS lookups and SMTP connections introduce latency
- Consider async processing for bulk validation
- Skip SMTP checks for better performance (still catches syntax errors and disposable emails)

## Error Handling

The library handles errors gracefully and never throws exceptions. All errors are returned in the `ValidationResult`:

```typescript
const result = await validateEmail({ email: 'test@nonexistent-domain-xyz.com' })
// Returns: { isValid: false, status: 'No MX Records (Domain Dead)' }

const result = await validateEmail({ email: 'not-an-email' })
// Returns: { isValid: false, status: 'Invalid Syntax', reason: '...' }
```

## License

MIT © [Ekansh Jain](https://github.com/ejekanshjain)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Repository

[https://github.com/ejekanshjain/simple-email-validator](https://github.com/ejekanshjain/simple-email-validator)
