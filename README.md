# MNC 2025-2029 Academic Portal

A responsive IIT Hyderabad Mathematics and Computing class portal built from the supplied React structure, timetable reference, IIT Hyderabad logo, and `MNC_Academic_Portal_Database_v2.xlsx`.

## Stack
- React + Vite
- React Router
- Lucide icons
- CSS, no UI framework required
- Google Sheets + Google Apps Script API ready
- Netlify compatible

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Google Sheets live mode
Create a Netlify environment variable:

`VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`

The frontend requests each approved sheet with `?sheet=TIMETABLE`, `?sheet=COURSES`, etc. If the variable is absent or the API fails, the bundled Excel snapshot is used so the site still works.

## Apps Script
1. Open the Google Sheet based on the supplied workbook.
2. Extensions → Apps Script.
3. Paste `apps-script/Code.gs`.
4. Deploy → New deployment → Web app.
5. Execute as yourself.
6. Give access to anyone with the link.
7. Put the deployment URL in Netlify as `VITE_APPS_SCRIPT_URL`.

Do not put Google credentials, service-account keys, or editable Sheet credentials in frontend code.

## Normal admin workflow
Edit Google Sheets for timetable, course, assessment, resource, event, reminder, and announcement data. The website refreshes from the API without a frontend source-code change.

Actual PDFs should live in Google Drive. Put their share/view URL in the `RESOURCES` sheet.
