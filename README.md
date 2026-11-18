# F1 Predictions

A static Finnish-language Formula 1 prediction website. No build command, package manager, backend, or API key is needed. The site reads two JSON files using ordinary browser `fetch()` calls.

## Structure

```text
f1-predictions/
├── css/
│   ├── style.css          # Shared design system, navigation, layout and homepage
│   ├── predictions.css    # Prediction form, dropdowns, progress, bingo, and export dialog
│   └── statistics.css     # Statistics, results, players, teams and season information
├── js/
│   ├── main.js            # Navigation, shared helpers, data loader and countdown
│   ├── predictions.js     # Data-driven questions, validation, Bingo and TXT export
│   └── statistics.js      # Tables, charts, filters, profiles and team/season pages
├── data/
│   ├── f1.json            # F1 teams, drivers, career achievements and historical results
│   └── results.json       # Prediction configuration, published answers and player results
├── images/
├── Players/               # 8 player profile HTML shells
├── Teams/                 # 11 team detail HTML shells
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
