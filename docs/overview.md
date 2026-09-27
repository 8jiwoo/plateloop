# PlateLoop: project overview

## The problem
School kitchens plan meals as **standard portion × headcount**, with no data on what students actually eat. Large amounts of food are thrown away, ingredient orders are too big, and kitchens can't tell which dishes students like. "Clean your plate" rules push kids to overeat instead of teaching them to take the right amount.

## The solution
**One scanner, two scans.** Each student scans their tray before lunch and after lunch at the PlateLoop Scanner. Eaten = before − after, per dish and per student. The data goes to four apps:

1. **PlateLoop Scanner**: the hardware. A depth camera 0.62 m above the tray, a weighing platform that checks the camera, a 10.1" screen, a face camera for signing in (the only way students identify, so there's nothing to tap or carry) and a compost bin. The AI runs on the device, and photos never leave it: the face camera keeps a match code, not a picture.
2. **PlateLoop Kiosk**: the scanner screen. An animated banner teaches the three steps. Students see what they were served, what they ate (calories, carbs, protein, fat), their points and rank. Every zero-leftover tray grows a fruit on the school's Green Tree.
3. **PlateLoop Kitchen**: live scans, waste by dish, nutrition against targets (with students to check on), an environment dashboard (CO₂, tree equivalents, zero-leftover rate), a plan → order → cook → serve cycle with forecasts and supplier orders, and an automatic daily report.
4. **Loopi**: the student app. A Tamagotchi pet that only eats real lunches: after the tray is scanned back, the food you ate waits in Loopi's bowl, and whatever you left turns up as crumbs on Loopi's floor until you sweep it into the compost. It also shows what you ate (nutrition against targets, you vs. your class), badges that unlock things Loopi can wear, and class and school leaderboards.

5. **Loopi Care**: the hospital patient app. Each patient's intake is measured against the targets for their diet (high protein, diabetic, low sodium), with an alert when they leave most of two meals, and a weekly healthcare report for the doctor and dietitian. In hospitals the goal flips: food left on a tray usually means a patient isn't eating enough.
6. **Loopi Kids**: the kindergarten app. Children see a picture-first Loopi, a rainbow of the food colours they ate and a sticker book of foods they've tried. Behind a grown-up check, parents get a lunch report with nutrients for the child's age, allergy checks and eating habits.
7. **Loopi Work**: the office app. Each worker sets a goal (build muscle, lose weight, steady energy or eat balanced) and their height, weight, age and activity. PlateLoop works out personal targets, recommends the canteen line and small tweaks that fit the goal each day, gives feedback after the meal ("not enough protein: 21 of 31 g"), and builds a weekly healthcare report with recommendations.

The Kitchen app also includes **carbon management**: the cafeteria's whole footprint from ingredients, food waste, and energy, water and deliveries, tracked monthly toward carbon-neutral operation. Every tray also shows the CO₂ it saved, live.

## Why it works
- **Reward right-sizing, not clean plates.** Loopi scores each student against their *own* usual leftovers, and a small portion fully eaten earns full energy.
- **Leftovers are a small chore, not a punishment.** They show up as crumbs to sweep, so students see their waste without losing anything.
- **Kid-safe:** Loopi never dies, there's no currency or shop, names on leaderboards are opt-in, and kitchen staff see tray numbers rather than names.

## Business model (summary)
- **Customers:** school districts, contract caterers (one deal covers many kitchens), later hospitals and canteens.
- **Revenue:** the scanner is leased inside a subscription (no upfront cost). Illustrative tiers: Basic about $150, Pro about $350 per site per month, plus a gamification add-on.
- **Illustrative ROI:** a school serving 800 meals a day spends about $288k a year on ingredients. Cutting waste by 30% saves about $21.6k a year against about $4.2k for the Pro plan.

All figures are illustrative and should be validated in a pilot.
