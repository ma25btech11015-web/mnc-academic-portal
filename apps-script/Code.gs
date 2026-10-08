/**
 * Google Apps Script API for the MNC Academic Portal.
 * Deploy as Web App: Execute as you, Who has access: Anyone with the link.
 * Keep the Google Sheet itself non-public and never put credentials in the React app.
 */
const ALLOWED_SHEETS = new Set([
  'SETTINGS','TIMETABLE','COURSES','ASSESSMENTS','RESOURCES',
  'ACADEMIC_EVENTS','REMINDER_SETTINGS','ANNOUNCEMENTS','OTHER_ANNOUNCEMENTS'
]);

function doGet(e) {
  const sheetName = String(e?.parameter?.sheet || '').trim();
  const callback = String(e?.parameter?.callback || '').trim();
  if (!ALLOWED_SHEETS.has(sheetName)) return output({error:'Invalid sheet'});
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return output({error:'Sheet not found'});
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return output([]);
  const headers = values.shift();
  const rows = values.filter(r => r.some(Boolean)).map(r => {
    const o = {};
    headers.forEach((h,i) => { if (h) o[h] = r[i] ?? ''; });
    return o;
  });
  return output(rows, callback);
}

function output(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
    return ContentService.createTextOutput(`${callback}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
