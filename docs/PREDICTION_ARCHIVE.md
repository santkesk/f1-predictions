# Prediction archive data (2020–2026)

Historical data was exported from the audited Excel workbook. `data/prediction-archive.json` contains Finnish questions, scoring rules, answers, correctness markings, bingo cards, player scores and countback. The 2026 season is questions-only. `data/results.json` preserves the website's existing historical answer tables and 2027 prediction setup, but updates 45 score cells, corrected standings and maximum-point percentages.

User-confirmed season point maxima (base + bingo): 2020 86+0=86; 2021 90+30=120; 2022 165+30=195; 2023 217+40=257; 2024 272+49=321; 2025 267+49=316. Percentages are rounded to nearest whole percent (half up). All-time percentages include only seasons played. `js/statistics.js` now renders question 1st/2nd/3rd placement counts from the archived countback records. `js/archive-data.js` is an optional, read-only adapter for detailed archive views.

Limitations: the 2020 retirements answer key remains incomplete, so its recorded score was retained. Verdicts were transcribed from source slides and workbook. This update does not add 2026 results or change `data/f1.json` (official F1 team/driver statistics). Future season updates require a validated scoring export and matching site categories.
