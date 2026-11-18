# Careflow clinic management prototype

A browser-based clinic dashboard for managing patients, doctors, appointment slots, and the daily patient queue.

## Run it

Open `index.html` in a modern browser. No build step or package installation is required. Clinic data is saved in that browser's local storage.

## Included workflows

- Register patients and review their visit history.
- Add doctor profiles with clinic hours and appointment durations.
- Book appointments from available doctor slots. Overlapping appointments are prevented.
- Add walk-ins and generate queue tokens.
- Check in appointments, start consultations, and mark visits complete.
- Search and filter appointments and patients.
- View today's schedule, queue, and summary counts.

The starter directory includes example patients and doctors; appointment data is stored locally in the browser. This is a front-end educational prototype, not a hosted clinic system: it does not provide authentication, shared multi-user data, backups, or a secure medical-record backend. Do not enter real patient information.
