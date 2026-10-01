# Collecting real survey responses

The online survey lives at **https://8jiwoo.github.io/plateloop/survey/**. Direct links for each group:

- Students: https://8jiwoo.github.io/plateloop/survey/#students
- Canteen and kitchen staff: https://8jiwoo.github.io/plateloop/survey/#kitchen
- Hospital staff: https://8jiwoo.github.io/plateloop/survey/#hospital
- Office workers: https://8jiwoo.github.io/plateloop/survey/#office

## Send responses to a Google Sheet (one-time setup, about 3 minutes)

1. Create a new Google Sheet at https://sheets.new and name it "PlateLoop survey responses".
2. In the sheet, open **Extensions → Apps Script**. Delete the sample code, paste in everything from `docs/survey/google-sheets-collector.gs`, and save.
3. Click **Deploy → New deployment**, choose the type **Web app**, set *Execute as* to **Me** and *Who has access* to **Anyone**, then click **Deploy**. Approve the permission prompt.
4. Copy the **Web app URL** and paste it into `survey/config.js`:
   ```js
   window.SURVEY_ENDPOINT = 'https://script.google.com/macros/s/…/exec';
   ```
5. Commit and push. New responses now appear in the sheet, one tab per group, with the same columns as the analysis workbook.

## Without the Google Sheet

Responses are saved in the browser they were submitted from. Open https://8jiwoo.github.io/plateloop/survey/#results on that device to download each group as CSV.

## Analysing the responses

Paste the rows (without the header) into the matching tab of `plateloop-survey-analysis-DEMO.xlsx` (`Students_Data`, `Kitchen_Data`, `Hospital_Data`, `Office_Data`), replacing the demo rows. The Dashboard, the group sheets, their charts and Key findings all update automatically. Rename the file to drop "DEMO" once it holds real data.
