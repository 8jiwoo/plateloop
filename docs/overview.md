# PlateLoop: project overview

## The problem
School kitchens plan meals as **standard portion × headcount**, with no data on what students actually eat. Large amounts of food are thrown away, ingredient orders are too big, and kitchens can't tell which dishes students like. "Clean your plate" rules push kids to overeat instead of teaching them to take the right amount.

## The solution
**One scanner, two scans.** Each student scans their tray before lunch and after lunch at the PlateLoop Scanner. Eaten = before − after, per dish and per student. The data goes to four apps:

1. **PlateLoop Scanner**: the hardware. A depth camera 0.62 m above the tray, a weighing platform that checks the camera, a 10.1" screen, a face camera for signing in (the only way students identify, so there's nothing to tap or carry) and a compost bin. The AI runs on the device, and photos never leave it: the face camera keeps a match code, not a picture.
2. **PlateLoop Kiosk**: the scanner screen. An animated banner teaches the three steps. Students see what they were served, what they ate (calories, carbs, protein, fat), their points and rank. Every zero-leftover tray grows a fruit on the school's Green Tree.
3. **PlateLoop Kitchen**: live scans, waste by dish, nutrition against targets (with students to check on), an environment dashboard (CO₂, tree equivalents, zero-leftover rate), a plan → order → cook → serve cycle with forecasts and supplier orders, and an automatic daily report.
4. **Loopi**: the app for teens and university students. A Tamagotchi that only eats real lunches: after the tray is scanned back, the food you ate waits in Loopi's bowl, and whatever you left turns up as crumbs on its floor until you sweep them into the compost. Clean trays earn hearts that grow Loopi up; a grown Loopi lays an egg that hatches a new one while the old one retires to the Barn. Around that, adapted from the team's tomogatchi prototype: gems, ingredients from the food groups you actually ate, oven cooking in recipe order with golden snacks, a worm farm for kitchen scraps, recipe cards from the Healthy Catch minigame, and wardrobe crates with the odds shown. Hearts only come from real trays, and real leftovers never turn into ingredients, so wasting food never pays. The Lunch tab shows the tray dish by dish, the plate compared with Singapore's My Healthy Plate, and the CO₂ saved. Classes and schools compete on leaderboards.

5. **Loopi Care**: the hospital patient app. Each patient's intake is measured against the targets for their diet (high protein, diabetic, low sodium), with an alert when they leave most of two meals, and a weekly healthcare report for the doctor and dietitian. In hospitals the goal flips: food left on a tray usually means a patient isn't eating enough.
6. **Loopi Kids**: the preschool app, in two parts. For children, an animated scene with sounds: Loopi bounces and giggles when tapped, food cards say what each food does, and after lunch a food rainbow fills in colour by colour with chimes and confetti. Everything can be read aloud. Behind a grown-up check, **Parents** see their child's lunch report, and **Teachers** see the whole class: who needs a check-in, allergy checks, the week, and notes that appear in each parent's report.
7. **Loopi Work**: the office app. Each worker sets a goal (build muscle, lose weight, steady energy or eat balanced) and their height, weight, age and activity. PlateLoop works out personal targets, recommends the canteen line and small tweaks that fit the goal each day, gives feedback after the meal ("not enough protein: 21 of 31 g"), and builds a weekly healthcare report with recommendations.
8. **Lunch Rush**: a first-person 3D game, styled like a PlayStation 1 game, that walks through one lunch in a school canteen the way a student would use PlateLoop: pick up a tray at the serving counter and choose a portion, look into the scanner's face camera and scan the full tray, sit down and eat bite by bite, scan the tray again, scrape the leftovers into the compost bin and return the tray. It ends with the student's grade, points, calories, CO₂ saved and what Loopi got. The scans go through the same code as the Kiosk, so the tray appears in the Kiosk, Kitchen and Loopi apps.

The Kitchen app also includes **carbon management**: the cafeteria's whole footprint from ingredients, food waste, and energy, water and deliveries, tracked monthly toward carbon-neutral operation. Every tray also shows the CO₂ it saved, live.

## Why it works
- **Reward right-sizing, not clean plates.** Loopi scores each student against their *own* usual leftovers, and a small portion fully eaten earns full energy.
- **A game for teens, a guide for young children.** Older students get the Tamagotchi; for preschoolers, Loopi is a guide that explains and encourages instead of a game.
- **Kid-safe:** Loopi never dies, there's no currency or shop, names on leaderboards are opt-in, and kitchen staff see tray numbers rather than names.

## Business model (summary)
- **Customers:** school districts, contract caterers (one deal covers many kitchens), later hospitals and canteens.
- **Revenue:** the scanner is leased inside a subscription (no upfront cost). Illustrative tiers: Basic about S$200, Pro about S$470 per site per month, plus a gamification add-on.
- **Illustrative ROI:** a school serving 800 meals a day spends about S$390k a year on ingredients. Cutting waste by 30% saves about S$29k a year against about S$5.6k for the Pro plan.

All figures are illustrative and should be validated in a pilot.
