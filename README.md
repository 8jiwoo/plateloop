# PlateLoop

**Live demo:** https://8jiwoo.github.io/plateloop/

**An AI food scanner that analyses what is served, eaten and left, so cafeterias order the right amount, cut food waste and cost, and track their carbon emissions. Everyone who eats gets their own nutrition report, in an app made for schools, hospitals, kindergartens or offices.**

Built for the EcoLoop sustainability hackathon, set in Singapore: local menus, HPB nutrition guidance (under 2,000 mg sodium a day) and the Singapore grid's emission factor.

People sign in with their face and scan their tray **before** the meal (what was served) and **after** it (what's left). The difference is exactly what each person ate, dish by dish. That data drives seven separate apps:

| App | File | For |
|---|---|---|
| **PlateLoop Scanner** | `dist/1-plateloop-scanner-3d.html` | Product page with the annotated, rotatable 3D scanner |
| **PlateLoop Kiosk** | `dist/2-plateloop-kiosk.html` | The scanner's screen: face sign-in, before and after scans, nutrition, the school Green Tree |
| **PlateLoop Kitchen** | `dist/3-plateloop-kitchen.html` | Kitchen staff and dietitian: live scans, dishes, nutrition, environment, carbon management, plan & order, daily report |
| **Loopi** | `dist/4-loopi-student-app.html` | Teens and university students: a Tamagotchi fed by real lunches, their tray and healthy plate, class and school leaderboards |
| **Loopi Care** | `dist/5-loopi-care-hospital.html` | Hospital patients: intake against their diet, low-intake alerts, weekly healthcare report for the care team |
| **Loopi Kids** | `dist/6-loopi-kids-kindergarten.html` | Preschools: an animated Loopi with sounds for children; separate Parents (one child's report) and Teachers (whole class, check-ins, allergies, notes) sections |
| **Loopi Work** | `dist/7-loopi-work-office.html` | Office workers: personal goals (build muscle, lose weight, steady energy, eat balanced), a daily canteen pick, meal feedback and a weekly healthcare report |

![PlateLoop Scanner](docs/screenshots/1-plateloop-scanner-3d.png)

## Run it

**Quickest:** double-click any file in `dist/`. Each app is a single self-contained HTML file.

**Live demo across apps:** the apps share one demo save in the browser. Open the Kiosk and Loopi (or Kitchen) in two tabs of the same browser, scan a tray on the Kiosk, and watch the other tab update. For the most reliable sync, serve the folder:

```bash
python -m http.server 8765
```

Then open http://localhost:8765/dist/2-plateloop-kiosk.html and http://localhost:8765/dist/4-loopi-student-app.html.

**Development version** (all seven apps in one page with a switcher): serve the repo as above, then open http://localhost:8765/apps/.

## Project layout

```
apps/                 source for the seven apps
  index.html          dev page with an app switcher
  css/apple.css       design system (light + dark)
  js/core.js          menu, before/after scans, nutrition, storage sync
  js/visual.js        Loopi the guide, food drawings, tray, My Healthy Plate, gauges
  js/game.js          the Tamagotchi's rules (lunch feeds Loopi, hearts, eggs and the Barn, cooking, worm farm, Healthy Catch, crates, badges)
  js/room.js          Loopi's animated pixel room
  js/health.js        hospital and kindergarten menus, demo people, healthcare report parts
  js/model.js         PlateLoop Scanner 3D page
  js/scanner.js       PlateLoop Kiosk
  js/kitchen.js       PlateLoop Kitchen
  js/student.js       Loopi student app
  js/care.js          Loopi Care (hospital patients)
  js/kids.js          Loopi Kids (kindergartens)
  js/work.js          Loopi Work (office workers: goals, targets, daily pick, weekly report)
  vendor/             three.js r128 + GLTFLoader (for offline 3D)
  build.py            builds the standalone files in dist/
dist/                 the seven standalone apps (generated, committed for convenience)
hardware/             Blender scanner: build script, .blend, .glb, renders
docs/                 project overview and screenshots
```

## Rebuild the standalone apps

After editing anything in `apps/`:

```bash
pip install pillow
python apps/build.py dist
```

To rebuild the 3D scanner (needs Blender 4.2+):

```bash
blender --background --python hardware/build_scanner.py -- hardware
```

## Committing in small bits

Keep each commit to one idea, such as "Add zero-leftover chip to kiosk" or "Fix kitchen sidebar height".

```bash
git status                  # see what changed
git add -p apps/js/kitchen.js   # stage only the pieces that belong to this commit
git commit -m "Add zero-leftover rate to kitchen overview"
git push
```

Useful habits:
- `git add -p` lets you pick individual chunks, so one file can go into two separate commits.
- If you change something in `apps/`, rebuild `dist/` and commit the rebuilt files in their own commit, e.g. `Rebuild dist`.
- `git log --oneline` shows the history at a glance.

## Notes

- All names, numbers, nutrition targets and CO₂ factors are demo or illustrative values. Replace them with your national school-meal standard and published factors (e.g. EPA WARM) before presenting.
- Students sign in only with their face. The scanner would keep a match code on the device, never a photo; the demo just simulates the match.
- The Loopi game systems are adapted from our Eggotchi prototype. Some features (health report, environment dashboard, green tree, face sign-in) take inspiration from existing school-meal scanners such as Nuvilab.
