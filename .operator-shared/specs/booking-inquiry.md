# Booking Inquiry

## Contract

- The Booking page form posts to `/api/inquiry`. Required: Name, "Email or phone number" (valid email, or ≥7 digits), "How did you find me?". Optional fields show no marker; required ones show an asterisk.
- Project types: Corporate, Personal, Graduation, Special occasion, Other (Other reveals a free-text box). The server accepts exactly the types the page offers; change both together.
- The function sends through Resend from `Claire Thomas website <website@clairethomas.art>` to `contact@clairethomas.art` (`INQUIRY_FROM` / `INQUIRY_TO` override). Subject: `Inquiry from <name> (<project type>)`. Reply-To is the client's address when they gave an email.
- Spam: a hidden honeypot field gets a fake success and sends nothing. Cross-origin and non-form requests are refused.
- If sending fails, the page falls back to opening the visitor's email app with the inquiry filled in. No inquiry may be silently lost.
- Package "Inquire" buttons scroll to the form and pre-fill "Tell me more!" with the package name.

## Content rules

- Package prices and the rate/travel notes come from Claire (2026-10-04) and live in `bookingConfig` in `site.js`. Booking offers only its three event packages (Standard Event, Half Day Event, Full Day Event); the user decided on 2026-10-17 that there is no graduation package. Graduation stays a project type and may be mentioned in copy.
- Package cards sit in one row on desktop, however many there are, and stack in one column at 1000 px and below.
