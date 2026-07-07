# CareCircle v4.0

See `CHANGED_FILES.md` for exactly what to replace and `RELEASE_NOTES.md` for the test checklist.

# CareCircle v3.8.1 - Daily Print Center

This release adds a printable Daily Care Packet to CareCircle.

## New features

- Print Center navigation tab
- Daily Care Summary preview
- Printable summary for Grandma and/or Grandpa
- Optional sections:
  - Appointments
  - Transportation windows
  - Medication checklist
  - Open tasks
  - Important contacts
  - Notes
- Print button opens a clean printer-friendly page
- Can save as PDF from the browser print dialog

## Deployment

Upload the files to your GitHub Pages repository root and deploy as usual.

## Firebase Rules

No Firestore rule changes are required if v3.7 was already working.


## v3.8.1
- Fixed Print Center button handlers.
- Print Center and displayed times now use 12-hour AM/PM formatting.
- Date handling is aligned to Seattle time zone (America/Los_Angeles).
