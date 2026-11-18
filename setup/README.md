# F1 Predictions — Google Sheets setup

This is a free Google Apps Script receiver for the existing GitHub Pages form. The spreadsheet stays private. Players use their name and an organizer-issued code, not a Google login. The code grants permission to submit for that player; share it privately. No Google credentials belong in the website.

## Update an existing 2027 spreadsheet (roster revision 2027-v2)

1. Replace the entire Apps Script Code.gs with Code.gs from this updated ZIP. Save.
2. Run **updateSeasonForSetup** (not setupSeason). It moves the old Settings, Questions, Options, Submissions, Scores and Correct tabs to dated `_archive_...` tabs, preserving the existing submission and its original questions together. It creates fresh active tabs with the requested roster/year changes. **Players_2027 and its private codes are preserved.** The earlier submission is retained in the archive; it is not counted as a prediction for the revised questions. Players submit again once the season opens.
3. Choose **Deploy → Manage deployments → Edit → New version → Deploy** to update the existing /exec URL. No new URL is necessary.
4. Keep the season in **setup** mode while bingo is unfinished. Both the website and updated receiver reject submissions in this mode. No test answer can freeze the unfinished questions. Existing sample bingo statements remain visible only for preview.
5. Later edit the bingo/scenarios and any remaining questions in Sheets, export the question file, and give it to the website maintainer. When everything is ready, run **openSeason** to lock the questions and open collection, export the question file again, and publish that final file on the website. The frontend stays paused until its file also says `collectionMode: "open"`.

The update function is safe to rerun once this exact revision is already in setup mode: it leaves the current tables untouched. To intentionally revise another already-open season, use a new revision identifier first. If migration fails while creating fresh tables, it restores the original active tabs. Keep the archive tabs as your backup.

## One-time setup (about 10 minutes)

1. Create an empty Google Sheets spreadsheet in your own Google account. Do not publish it to the web or enable public link sharing.
2. Open **Extensions → Apps Script**. Replace the initial Code.gs with the complete **Code.gs from this ZIP**. It includes the validator, the current question template, and the receiver.
3. Save. Select **setupSeason** in the function dropdown and click **Run**. Authorize the script to access your spreadsheet. If Google shows an unverified-app notice, check that it is the script you just created in your own account before proceeding.
4. Return to Sheets and refresh. The **F1 Ennustukset** menu and seven tabs ending in `_2027` should appear. Running setup again refuses to overwrite an existing season.
5. In Apps Script choose **Deploy → New deployment → Web app**. Execute as **Me**. Access: **Anyone** (including visitors without Google login). Click Deploy and copy the URL ending in **/exec**, not /dev. If your organization blocks anonymous web apps, use a personal account or ask your administrator; do not make the spreadsheet public.
6. Give that /exec URL to the website maintainer. It is a public service address, not a secret. Never send your Google password or the Players tab. The maintainer will set `data/submission.json` and run a real browser-to-Sheets test before publishing the new form.
7. Export **F1 Ennustukset → Vie kysymystiedosto** and use that file as the website's `data/seasons/2027.json`. This ensures the form and the server use identical questions and choices.
8. In `Players_2027`, distribute each person's **private_code** individually. Keep their IDs and names unchanged. Set enabled to the boolean FALSE to revoke a code. Codes can be rotated by replacing them with a new long random value. Never add codes to GitHub, URLs, or question/result exports.

The downloaded initial questions preserve the existing website questions. They are a TEMPLATE, not a verified 2027 roster: review driver choices, references to 2025, counts, and bingo statements before opening predictions.

## Tabs

- **Settings_2027:** season, revision, deadline (ISO text with explicit timezone), bingo configuration and exclusive-choice groups.
- **Questions_2027:** one row per answer field. Repeat stage/question text and scoring consistently across a question's fields. Required is TRUE or FALSE. Types: `select`, `checkboxes`, `number`, `text`. Use a unique stable field_name. Question numbers must be unique across questions and bingo. IDs must not change once entries arrive.
- **Options_2027:** one row per choice, grouped by list. Each select/checkboxes field references a list name. Choices are frozen for the season.
- **Players_2027:** private codes and enabled players. Existing website names/IDs should remain stable.
- **Submissions_2027:** append-only receipts, player ID/name, time, request ID, structured answers, and readable answers. All successful resubmissions remain here. The export selects the most recent submission per player. Do not sort or manually edit this log: row order defines latest. Use filter views if needed.
- **Scores_2027:** one row per player/question; enter the final points (zero and negatives allowed). Leave blank when not scored. Points are entered manually in this version; totals and tied ranks are calculated on export.
- **Correct_2027:** a readable correct answer for each question. For bingo, list the actual outcomes or your adjudication explanation.

## Yearly questions

Before receiving submissions, edit Questions/Options/Settings in Sheets. Change `revision` whenever you change the form, then use **Vie kysymystiedosto**. Open the site's **manage.html**, choose the exported file, enter the /exec URL, and download the question file plus submission.json. Upload them to `data/seasons/YEAR.json` and `data/submission.json` in GitHub. The homepage countdown and form both use these settings. This file tool runs locally in your browser; it is not an authenticated server admin panel and selecting a file does NOT publish it.

For the next season, set INITIAL_CONFIG in Apps Script to the new season JSON (new season, revision, deadline and updated questions/options), then run setupSeason. This creates new year-suffixed tabs in the same spreadsheet and switches ACTIVE_SEASON without deleting earlier tabs. Only one season accepts submissions at a time. Code changes require **Deploy → Manage deployments → Edit → New version → Deploy**; Sheet-only edits do not.

The initial version uses a 3×3 bingo card every season. All other stages/questions/fields can change. Drafts are scoped to season and revision so incompatible old drafts are not silently reused. They are saved only on the current browser/device, not synced across devices.

## Freeze and deadlines

New seasons start in setup mode. Running openSeason freezes the full question configuration and enables submissions; the website must then receive the exported open-mode question file. Legacy open seasons freeze on their first accepted prediction. Later config changes are rejected until restored; do not change questions, options, revision, or deadline after collection begins. Deadline enforcement uses the server clock, including resubmissions. Retrying an already accepted request can still return its original receipt after the deadline, but cannot change its answers.

The receiver requires a valid player code and complete valid answers. Submitting with a valid code can replace that player's active prediction, so keep codes private. A server-side lock serializes concurrent submissions; a saved request ID makes retrying an uncertain response safe. A timeout is never displayed as a successful submission. After a network failure, retry the unchanged answers with the same code.

## Publishing answers and results

After the deadline:

1. **Vie ennustukset** downloads `season-YEAR.json` with answers but no final ranks. It contains no private codes, receipts, request IDs or submission timestamps/history.
2. Open **manage.html** and load the current GitHub `data/results.json` plus this exported season file. Download the merged results.json and upload to GitHub's `data/results.json`. Only that year is replaced; other years and player metadata are preserved. The results page displays answers while statistics exclude unfinished seasons.
3. Choose **Valmistele pisteytys** in Sheets. Fill every question's points and the correct answers. This operation preserves points already entered. Do not add duplicate score rows.
4. Choose **Vie vahvistetut tulokset**. Export refuses missing/invalid points or missing correct answers. It totals points and gives equal totals a shared rank (1, 1, 3). Percentages remain blank because the current scoring includes variable maxima.
5. Merge/upload the resulting season file again to replace the predictions with final results. Season rankings, totals, player profiles and charts update from the same data.

Uploads can be made through GitHub's Add file → Upload files in the appropriate directory, or handed to the website maintainer. The browser file tool cannot commit to GitHub by itself. It never asks for a GitHub access token.

## Verification before enabling production

Use a separate test spreadsheet/deployment or test season; do not record fake answers in the real competition. Verify: browser shows a receipt; one complete row appears; retrying the SAME request creates no duplicate; wrong code fails; invalid/late answers fail; a new submission supersedes the old one in export; exports omit codes; import preserves older seasons. Check from the actual GitHub Pages origin and a mobile browser. Never substitute fetch `no-cors`: an opaque response cannot confirm that answers were saved.

Automated local tests cover validation, duplicate requests, private-code authentication, deadline checks, config freezing, exports, scores and ties. Actual Google authorization, deployment and cross-origin delivery still require the real /exec endpoint. Workspace policies and Apps Script quotas can affect availability. Keep a private backup of the spreadsheet.

References: https://developers.google.com/apps-script/guides/web and https://developers.google.com/apps-script/guides/content
