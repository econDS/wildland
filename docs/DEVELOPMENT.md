# WILDLAND — Development

## Run
Open `index.html` directly, or run `npm start` / `python -m http.server 8943 --bind 127.0.0.1`, then visit `http://127.0.0.1:8943`.
The game makes no network requests and needs no bundler, fonts or external APIs. Node.js runs the tests and build scripts; Python is only needed for the optional development server. The service worker registers only over HTTPS, so local development is never cached.

## Builds
One codebase ships to two targets. `npm run build:web` copies `index.html`, `manifest.webmanifest`, `src/`, `styles/` and `icons/` into `www/` and stamps `sw.js` with a cache name derived from the shipped files' hash, so every change reaches installed players.

- **Web / PWA** — `.github/workflows/pages.yml` runs the tests, builds `www/` and deploys it to GitHub Pages on every push to `main`. Enable it once under *Settings → Pages → Source: GitHub Actions*. All paths are relative, so the site works under `/<repo>/`.
- **Android** — Capacitor 8 wraps `www/` (`capacitor.config.json`, `webDir: "www"`). `.github/workflows/android.yml` runs `npm ci` → tests → `build:web` → `cap sync android` → Gradle (JDK 21) and uploads `wildland-<version>-debug.apk` as a workflow artifact. Version tags (`v*`) also attach the files to a GitHub Release. `versionName` comes from `package.json`; `versionCode` is the workflow run number.
- **Release signing** — add the repository secrets `ANDROID_KEYSTORE_BASE64` (`base64 -w0 release.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. The workflow then also builds a signed release APK and an AAB for Google Play. Without them only the debug APK is built. Keep the keystore safe: updates must be signed with the same key.
- **Local Android build** (optional) — requires JDK 21 and the Android SDK: `npm ci && npm run cap:sync && cd android && ./gradlew assembleDebug`.
- **Icons** — all icons are rendered from `scripts/icon-art.mjs` by `npm run build:icons` (web icons in `icons/`, Android launcher, adaptive, themed and splash images in `android/app/src/main/res/`). Generated files are committed, so CI does not need `sharp`.

App ID: `io.github.econds.wildland`. It cannot change once published on Google Play.

## Architecture
- `index.html`: semantic app shell, native dialog, script load order.
- `styles/main.css`: responsive desktop/tablet/mobile layout, motion preferences.
- `src/data.js`: items, weights, spoilage, recipes, seven connected sites, weather and difficulty.
- `src/engine.js`: pure seeded simulation; CommonJS export supports Node tests. `action`, `available`, and `cost` share rules with UI. No DOM dependencies.
- `src/advice.js`: read-only, contextual next-step selection, loaded after engine and before game. Uses public availability rules and local caches; hard mode returns no routine suggestion. Returns navigation and focus targets without executing actions.
- `src/platform.js`: Capacitor bridge, loaded first. On Android, save export writes to the cache directory and opens the share sheet, and the back button closes dialogs, returns to the first tab, then backgrounds the app. On the web it falls back to a normal download and registers the service worker.
- `src/game.js`: rendering, event delegation, keyboard controls, save/load/import/export, dialogs and opt-in Web Audio ambience.
  - Layout (3.0): sticky header (HUD + `#miniVitals` + `#mainNav`) → `#objective` next-step card from `nextStep()` → compact scene → `#activityContent`; sticky side column on ≥900px. `#mainNav` becomes a fixed bottom bar ≤700px. Deep links use `data-nav` plus optional `data-navfilter` (craft/inventory filter) and `data-navmap` (map selection); `navBadges()` computes nav counts.
- Mobile rules (end of `styles/main.css`, applies ≤700px and short landscape): Thai text is at least 11px (only decorative Latin labels may be 10px); every button is at least 40px, and icon buttons gain an invisible 44px hit area through `:after`; `body[data-tab]` (set in `renderTabs`) shrinks the landscape banner to a slim strip on every page except the action page; the hint card is a single compact row; the map page shows the map before the forest signals. Short landscape phones get a scrolling header and a slim bottom bar. Audit by emulating 320×568, 360×740 and 780×360: no horizontal overflow and no target under 40px.
- `src/scene.js`: deterministic layered Canvas landscape. Cached sky and land layers (rebuilt only when site, weather, time phase, structures, discovery or flooding change) with animated life between them: a sun that follows game time, moon and stars, drifting clouds, birds, fog, creek shimmer, fire glow/smoke, fireflies, rain and storm lightning. Four time phases (dawn < 09:00, day, evening ≥ 16:30, night ≥ 19:00) with per-weather and per-site palettes. Capped at ~22 fps, pauses when hidden; `prefers-reduced-motion` freezes motion and disables lightning flashes.
- `tests/engine.test.js`: rule/integration regressions.
- `tests/simulate.js`: repeatable strategy plays five complete 30-day campaigns through public engine actions without granting resources or resetting health.

## Verification
`npm test` runs 49 tests covering first-day play, crafting, dismantling, durability, cooking, inventory capacity, exposure, remote fire expiration, rain collection, food spoilage, all encounters, save validation, terminal states, rescue requirements, route planning, regional encounters, journey goals, save migration, contextual advice, hard-mode suppression, sleep forecasts and bulk inventory transfers.

`npm run test:simulation` plays five seeded full campaigns. The strategy builds a river camp and balances resources; this checks that long-term play is achievable, not that every strategy succeeds.

Browser QA: gather → shelter → firepit → light fire → consume → rest → sleep → reload; map travel; manual checkpoint save/load; mobile viewport without horizontal overflow. Inspect console for uncaught errors.

## Save format
Version 2 only, with `wildland_autosave_v2` and `wildland_checkpoint_v2` localStorage keys. Imported saves are validated before replacing current state. Logs are rendered as escaped text. Imports are limited to 300 KB. Saves include RNG state so loading does not reroll an identical decision.

Autosaves belong to the current browser and origin; `file://`, `localhost`, `127.0.0.1`, the GitHub Pages site and the Android app each have separate storage. Export JSON to transfer safely. Storage failures are surfaced with an export fallback.

On Android, `localStorage` lives in the app's WebView data: it survives app updates, force stop and swiping the app away, and is removed by uninstalling or *Clear storage*. Keep the app ID and Capacitor's default `https://localhost` origin unchanged, or existing saves become unreachable.

## Rules worth preserving
- Rejected actions do not mutate state or consume RNG.
- Time stops while idle and during encounter selection.
- All campsite fires tick together. Outdoor actions do not use shelter/fire protection.
- Resource overflow goes into the current site cache, never disappears.
- Day 30 victory requires surviving the final night; rescue requires all parts, day ≥ 10, the ridge, and no storm. Death always takes precedence.

## Action audio
`src/audio.js` synthesizes short action-specific effects offline with Web Audio (wood/stone impacts, rustling, water, footsteps, fire/cooking, crafting, consumption and outcome cues). It also generates continuous wind and weather-dependent rain, plus occasional daytime birds. Both buses share one AudioContext. The speaker button gates both buses; the effects and nature sliders have separate persisted volumes. Effects play only after an accepted action or an encounter choice. Sound randomness never touches the simulation RNG.

Visit `/tests/audio.html` on the local development server to render 42 real OfflineAudioContext checks: every effect variant, silence when muted/at zero volume, bounded overlapping actions, cancellation of scheduled voices, and nature ambience in clear and storm weather. The effect checks also verify a silent ending. No sound is played by this test page.

## Living world expansion (2.1)
`src/world.js` holds deterministic hazard generation, additive v2 save migration, wildlife and fish stocks, camp maintenance, and landmark rewards. `src/world-ui.js` renders warnings, preparation requirements, maintenance controls and the discovery atlas. Load data → world → engine, and world-ui before game.

Hazards start on day 4. Floods last one day; fallen trees last through the next day. Generation never closes both river–rocks and forest–ruins together, preserving a route to all seven sites. The forecast uses the same rule as dawn. Each site's landmark is discovered by exploration and claimed once, with overflow retained in the local cache.

World tests cover migration, all seven rewards, preparation costs, functional equipment, forecast agreement, map connectivity, hazard expiry, clearing from either endpoint, remote storm damage, repair and stock recovery. `/tests/world-browser.html` provides deterministic damaged-camp and blocked-route scenarios only on isolated port 8944, avoiding the player's regular origin.

## Expedition systems (2.2)
`Survival.routePlan(state, target)` returns a hazard-aware route, total time, energy cost and accumulated risk for the map preview. The UI highlights the route and lets the player travel one hop at a time when the destination is several edges away.

Regional encounters are one-time per expedition and are recorded in `world.eventsSeen`; old version-2 saves migrate this array additively. Journey goals live in `milestones.goals`, award through the same inventory overflow rules, and are evaluated after actions and dawn. Browser save slots use `wildland_slot_1_v2` through `wildland_slot_3_v2`; autosave, checkpoint and JSON export remain available.

Expedition tests cover route rerouting, regional encounter resolution, goal thresholds and migration of the new fields.

## Contextual planning and bulk inventory
`SurvivalAdvice.next(state)` returns a structured navigation hint or `null`. Critical thresholds are health/food/water/warmth <25 and energy <10 in hard mode. Hard-mode routine crafting, treatment and rescue prompts are suppressed. A dangerous sleep forecast may produce a critical warning; evening food/water/cold damage also qualifies. Clicking advice focuses the matching item or action.

Guidance is optional and shown once. Every hint carries a `topic` (`target.action`, else the first segment of `key`). `game.js` keeps learned topics and menu tabs in `wildland_tips_v1` (device-level, deliberately outside the save): a routine hint is hidden once its topic is learned by clicking the card, dismissing it, or performing the hinted action unprompted in `run()`. Critical hints, `signal` and the end-of-journey card always show. Each menu shows a dismissible coach note on first visit, marked learned when dismissed or left; hard mode shows neither. Settings → «คำแนะนำมือใหม่» clears the store.

`Survival.sleepPreview(state)` shares the night calculation with `sleep`, including the original sleeping-bag clamp order. The result includes projected vitals, individual health-loss causes, wildlife risk and the best/worst health outcomes. It never reads or changes RNG. The forecast excludes next-dawn rewards and describes the body's immediate sleep outcome.

`Survival.inventoryPlan(state, type, id, quantity=1)` preflights stash/take/drop and returns the maximum transferable amount, resulting weight and capacity. `action` accepts the same optional fourth argument for these transfers. Invalid quantities, overflow, quest removal, event/terminal actions and backpack removal that would leave an overloaded pack reject atomically. Bulk transfers spend no time or RNG, write one log and retain tool durability.

`tests/planning.test.js` covers the planning rules and transfer boundaries. Browser QA should also check hard-mode advice disappearing after recovery, hint navigation/focus, repeated sleep previews without save changes, quantity input and all-item selection, stash/take/drop, and dialog overflow at a mobile viewport. Use isolated port 8944 to protect the player's normal origin.
