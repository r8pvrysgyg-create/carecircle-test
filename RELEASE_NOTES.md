# CareCircle v4.0 Release Notes

## Focus

Editing polish and quality-of-life improvements.

## New / Improved

- Added a toast notification system for save, update, delete, archive, and cancel actions.
- Added Cancel buttons to edit forms.
- Form titles now change between Add and Edit modes.
- Save buttons now change to "Save Changes" while editing.
- Added Duplicate button for appointments.
- Duplicate appointment copies the existing appointment details but clears date and time fields.
- Added admin-only delete button for notes.
- Kept existing role/security model and Firestore rules unchanged.

## Testing checklist

1. Log in as admin.
2. Add, edit, cancel, duplicate, and delete an appointment.
3. Add, edit, cancel, complete, and delete a task.
4. Add, edit, cancel, and delete a note.
5. Add, edit, archive/reactivate, and delete medication.
6. Add, edit, cancel, and delete directory contact.
7. Log in as family member and confirm admin-only delete buttons are hidden/blocked.
