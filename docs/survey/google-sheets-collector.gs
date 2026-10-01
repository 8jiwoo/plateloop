/**
 * PlateLoop survey collector for Google Sheets.
 *
 * Setup (once, about 3 minutes):
 *  1. Create a new Google Sheet (sheets.new). Name it "PlateLoop survey responses".
 *  2. In the sheet: Extensions → Apps Script. Delete what's there and paste this whole file. Save.
 *  3. Deploy → New deployment → type "Web app".
 *       Execute as: Me.   Who has access: Anyone.
 *     Click Deploy, allow access, and copy the "Web app URL".
 *  4. Paste that URL into survey/config.js (window.SURVEY_ENDPOINT = '...'), commit and push.
 *
 * Each group gets its own tab (Students_Data, Kitchen_Data, Hospital_Data, Office_Data) with the same
 * columns as the analysis workbook, so you can copy the rows straight into it.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(data.sheet) || ss.insertSheet(data.sheet);
    var header = ['ID'].concat(data.codes).concat(['Submitted']);
    if (sheet.getLastRow() === 0) sheet.appendRow(header);
    var row = [data.id];
    data.codes.forEach(function (c) { row.push(data.answers[c] === undefined ? '' : data.answers[c]); });
    row.push(new Date());
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput('PlateLoop survey collector is running.');
}
