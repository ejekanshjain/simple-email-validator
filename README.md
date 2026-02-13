# Simple Email Validator

A brutally honest, no-bullshit TypeScript email validation library that doesn’t just check if your email _looks_ legit — it actually checks if the damn thing can receive mail.

This isn’t some cute regex-only toy. This shit goes all the way:
DNS, MX, SMTP handshake — the whole fucking pipeline.

---

## What This Bad Boy Does

- ✅ **Syntax Validation** – RFC-style format checks. No stupid `a@b` garbage.
- 🚫 **Disposable Email Detection** – Blocks fake/temp inbox bullshit using `fakefilter`.
- 🌐 **DNS MX Verification** – Checks if the domain even has mail servers configured.
- 📬 **SMTP Deliverability Test** – Talks directly to the mail server like, “yo, does this user exist?”
- ⚡ **Smart Provider Handling** – Skips SMTP for big boys like Yahoo, Outlook, Hotmail, AOL, and iCloud because they block verification and don’t give a shit.
- 🎛️ **Configurable as Hell** – Turn checks on/off depending on how paranoid you are.
- 🔒 **TypeScript Native** – Proper types. No `any` nonsense. Powered by TypeScript.

---

## Installation

Install it like a civilized engineer:

```bash
npm install @ejekanshjain/simple-email-validator
```

Or if you’re fancy:

```bash
pnpm install @ejekanshjain/simple-email-validator
```

Or living that fast life:

```bash
bun install @ejekanshjain/simple-email-validator
```

---

## Quick Start (Let’s Validate Some Shit)

```ts
import { validateEmail } from '@ejekanshjain/simple-email-validator'

const result = await validateEmail({ email: 'user@example.com' })

if (result.isValid === true) {
  console.log('✓ This email is legit as fuck')
} else if (result.isValid === false) {
  console.log(`✗ Nope. Broken shit: ${result.status}`)
} else {
  console.log(`⚠ Could not verify. Server being shady: ${result.status}`)
}
```

---

## How The Hell It Works

This library doesn’t half-ass validation. It goes step by step:

### 1. Syntax Check

Regex-based validation:

- No starting with a dot like `.idiot@example.com`
- No consecutive dots
- Proper TLD (at least 2 characters)
- Only valid characters allowed

If it fails here, it’s dead. End of story.

---

### 2. Disposable Email Check

Uses `fakefilter` to detect trash providers.

If someone signs up with `tempmail-123@randomshit.com`, we shut that down instantly.

---

### 3. DNS MX Check

We query DNS for MX records.

No MX?
That domain is basically a corpse.

---

### 4. Provider Detection

Big providers like Gmail and others don’t like being pinged.

So instead of giving you false negatives and random bullshit failures, we skip SMTP verification for them.

Smart. Not reckless.

---

### 5. SMTP Handshake (The Real Test)

This is where shit gets real.

- Connect to port 25
- HELO
- MAIL FROM
- RCPT TO
- Interpret server response

If the server says:

- “User unknown” → it’s dead.
- Temporary error → we return `null`.
- Accepts recipient → deliverable (unless catch-all).

This is as close as you get without actually sending an email.

---

## API

### `validateEmail(options)`

```ts
{
  email: string
  timeoutMs?: number
  regexCheck?: boolean
  fakeEmailCheck?: boolean
}
```

Returns:

```ts
Promise<ValidationResult>
```

---

## ValidationResult

```ts
interface ValidationResult {
  isValid: boolean | null
  status: string
  reason?: string
  mxRecord?: string
}
```

### Meaning of `isValid`

- `true` → This email is good to go.
- `false` → Absolutely broken.
- `null` → Couldn’t verify. Server said “nah” or timed out.

---

## Possible Status Values (Know Your Shit)

| Status                               | isValid | What It Means             |
| ------------------------------------ | ------- | ------------------------- |
| Deliverable                          | true    | Email is solid            |
| Invalid Syntax                       | false   | Format is garbage         |
| Disposable Email Detected            | false   | Fake/temp inbox           |
| No MX Records (Domain Dead)          | false   | Domain has no mail server |
| User Unknown                         | false   | Address doesn’t exist     |
| Skipped SMTP (Provider blocks pings) | null    | Big provider blocking     |
| Timeout                              | null    | Server too slow           |
| Connection Error                     | null    | Couldn’t connect          |
| Server Reject (Greylist/Spam)        | null    | Server didn’t like us     |

---

## Real Talk: Important Considerations

### False Negatives

Big providers block SMTP verification.
Greylisting exists.
Anti-spam filters exist.

Sometimes you’ll get `null`. That’s life.

---

### False Positives

Catch-all servers exist.
Some mail servers accept everything and bounce later.

So yeah, no validator on Earth is 100% perfect.

---

### Rate Limiting

You’re opening real SMTP connections.

Spam this aggressively and you might:

- Hit rate limits
- Get blocked
- Get your IP blacklisted

So chill the fuck out and cache results.

---

### Performance

Full validation can take 1–5 seconds.

DNS + SMTP isn’t instant magic.

If you need speed:

- Skip SMTP
- Run async
- Batch process

---

## Error Handling

This library does **not** throw random-ass exceptions.

Everything is returned cleanly inside `ValidationResult`.

Example:

```ts
await validateEmail({ email: 'not-an-email' })
// { isValid: false, status: 'Invalid Syntax' }
```

No crashes. No drama. Just structured results.

---

## License

MIT © Ekansh Jain

Do whatever you want with it.
Just don’t blame the library when some weird mail server behaves like a diva.

---

## Contributing

PRs welcome.

But please:

- Don’t submit half-baked garbage.
- Write tests.
- Don’t break existing behavior.

---

## Repository

[https://github.com/ejekanshjain/simple-email-validator](https://github.com/ejekanshjain/simple-email-validator)

---

If you’re tired of fake signups, trash leads, and garbage email validation logic…

Use this.

Validate like a savage.
