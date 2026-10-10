# Themes, monthly finances, and profile photos

Use the sun or moon button in the header to switch between light and dark mode.
The app remembers the choice on this device; the first visit follows the device theme.

Open **Monthly calculator** to choose a calendar month and currency. The page
shows your recorded income, expenses, and balance. USD and KHR are calculated
separately. The planning fields calculate a hypothetical balance without creating
transactions.

Open **My profile** to edit your full name, username, and email. Select **Change
photo**, choose a JPEG, PNG, or WebP image up to 5 MB, adjust the circular crop,
and select **Save photo**. **Remove photo** restores your initials. Profile edits
apply only to the signed-in account and do not change its password or roles.

## Deployment

Deploy the backend before publishing the new frontend. Flyway migration V6 adds
the nullable `users.avatar_url` column. Profile photos are normalized to 256-pixel
JPEG images and stored in the database, so no disk, storage provider, or new
environment variables are required.

Authenticated endpoints:

- `GET /api/v1/profile`
- `PUT /api/v1/profile` with `username`, `email`, and `fullName`
- `PUT /api/v1/profile/photo` with `imageData` (a cropped JPEG or PNG data URL)
- `DELETE /api/v1/profile/photo`
- `GET /api/v1/reports/monthly?year=2026&month=10`

Monthly reports aggregate all matching records for the signed-in user rather than
adding a single paginated list. The report returns a row for each currency with
recorded transactions; a missing currency represents an empty month.
