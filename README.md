# F1 Predictions

A static Finnish-language Formula 1 prediction website. No build command, package manager, backend, or API key is needed. The site reads two JSON files using ordinary browser `fetch()` calls.

## Structure

```text
f1-predictions/
├── css/
│   ├── style.css          # Shared design system, navigation, layout and homepage
│   ├── predictions.css    # Prediction form, dropdowns, progress, Bingo and export dialog
│   └── statistics.css     # Statistics, results, players, teams and season information
├── js/
│   ├── main.js            # Navigation, shared helpers, data loader and countdown
│   ├── predictions.js     # Data-driven questions, validation, Bingo and TXT export
│   └── statistics.js      # Tables, charts, filters, profiles and team/season pages
├── data/
│   ├── f1.json            # F1 teams, drivers, career achievements and historical results
│   └── results.json       # Prediction configuration, published answers and player results
├── images/
├── Players/               # 8 player profile HTML shells (existing URLs preserved)
├── Teams/                 # 11 team detail HTML shells (existing URLs preserved)
├── index.html
├── predictions.html
├── statistics.html
├── results.html
├── players.html
├── info.html
├── teams.html
├── seasonsinfo.html
└── README.md
```

## Publish on GitHub Pages

Extract the archive, open its `f1-predictions` folder, and copy its **contents** into the root of your existing repository (or the directory configured as the Pages source). Remove the previous root CSS/JS files (`style.css`, `theme.css`, `prediction.css`, `statistics.css`, `navigation.js`, `prediction.js`, `statistics.js`) rather than retaining stale copies. Keep `Players`, `Teams`, `css`, `js`, `data` and `images` with their exact capitalization. Commit/push and open the published website. Relative URLs are resolved from `js/main.js`, so the site also works under a repository subpath.

### Test locally

Because JSON is loaded with `fetch()`, browsers generally block it when HTML is opened through a `file://` URL. Serve the folder via HTTP. For example, open a terminal in the `f1-predictions` folder:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/`. Alternatively, use VS Code Live Server. Stop the local server with Ctrl+C.

## Design system

Edit the `:root` block at the top of `css/style.css`. Change `--bg`, `--panel`, `--raised`, `--line`, `--text`, `--muted`, `--red` and `--red-text` for brand changes. Typography, radii, spacing and contextual shades are shared. `--player-*` variables are used by player cards, charts and result links. `--team-*` variables provide the colour indicators for teams and their drivers, with `--team-sauber` an alias of `--team-audi`. No hard-coded colours are necessary in the JavaScript files. Contextual tones retain the prior redesign's exact shades.

## Data: annual maintenance

### `data/f1.json`

- `referenceSeason`: the season being predicted. `Viime kaudet` displays the latest three seasons strictly before this reference season from each historical category.
- `teams`: current team IDs, names, image paths, years, power unit, overview figures, detail-page achievements, driver names and career figures, and (where available) team history. A driver `profileName` may be used when an existing detail page has a different spelling.
- `driverTeamOrder`, `checkboxTeamOrder`, `midfieldTeams`: team IDs used to maintain source ordering/eligibility in prediction options. Driver lists and team colours are derived from the shared team data.
- `historicalResults`: 10 categories, each with season-specific columns and rows. Currently contains the existing 2023–2025 snapshot. Add the latest completed season's data to every category, then change `referenceSeason` when preparing a new prediction season. No live F1 API is connected. Do not delete existing seasons until new data is complete.

### `data/results.json`

- `prediction.season` and `prediction.deadline`: active-year labels, homepage countdown and TXT export identification. The deadline retains the previous site's local-time interpretation; provide a timezone offset if you want a globally consistent instant.
- `prediction.stages`: ordered stages, 24 questions, per-question scoring rules, field IDs, option groups and numeric limits. Update season-specific wording and limits when needed. `prediction.exclusiveGroups` defines which choices must be unique, and `prediction.bingo` defines scenarios, instructions and scoring.
- `players`: player IDs, display names and source overall percentage figures. Add a CSS colour variable for any new player and a matching profile shell under `Players/`.
- `seasons`: completed game years, each with standings (player, rank, points, percentage) and categories holding answer/correct-answer tables and notes. The rankings, wins, podiums, points, average points, season history, player cards, profile metrics and charts are computed from these standings. `overallPercent` is retained from the source because historical maximum-point denominators were not supplied; update this manually until those denominators are available. `overallOrder` preserves the initial overview table ordering, while the table remains sortable.
- `participation`: participation markers for unfinished or unscored years. Remove the relevant marker when adding finalized standings.
- `archiveTotals`: exists only for years where the archive and statistics pages disagreed (2023, 2024). Preserves the supplied archive figures until you reconcile them.

The previously published 134 archive tables, team overview/history tables, 30 historical F1 tables and original form options/scoring were migrated from the previous ZIP. Teams' `overviewStats` and `achievements` remain distinct: source team overview and profile figures were not always identical (for example, McLaren championships), and this migration does not silently reconcile them.

## Prediction saving and security

This version retains the existing local TXT export. New predictions are not appended to `data/results.json`: a public static website cannot safely write to the GitHub repository from a visitor's browser. Do not store private submissions, player PINs, API secrets, or unpublished answers in the repository. A separate backend (e.g. Google Apps Script + a private Sheet) can be integrated later. Only the existing published results are included here.
