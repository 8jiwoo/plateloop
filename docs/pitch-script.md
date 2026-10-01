# PlateLoop pitch script

About **6 minutes** with the full deck and live demos (about 850 words, spoken at a relaxed pace). For a **3-minute** version, skip the slides marked *(skip for 3 min)*. Split it between speakers however you like; suggested handovers are marked **[Speaker 2]** and so on.

Every figure below is checked against its source in [research.md](research.md).

---

## 1 · Title (0:00)
**[Speaker 1]**
Every school day in Singapore, thousands of lunch trays go back to the kitchen half full. Nobody writes down what was left. It goes in the bin, and tomorrow the kitchen cooks the same amount again.
We're [team name], and this is **PlateLoop**.

## 2 · The problem in numbers (0:20)
In 2023, Singapore threw away **755,000 tonnes** of food. Only 18% was recycled; the rest was burnt, and the ash goes to Semakau, our only landfill.
Around the world, **28%** of food waste comes from food service: canteens, caterers and restaurants. And wasted food causes **8 to 10%** of global greenhouse gas emissions.

## 3 · How we worked (0:45) *(skip for 3 min)*
We used design thinking: we watched how lunch really runs, defined one problem, compared ideas, built a prototype, and tested it until it broke.

## 4 · Who we designed for (0:55)
The same tray means different things to different people.
Wei Ling, 15, gets the same big scoop as everyone, and she's told to finish it. Mrs Lim cooks by feel, and some days half the kailan comes back. Nurse Aisha finds out days too late that a patient has stopped eating. And Marcus wants to build muscle, but has no idea what the canteen gives him.

## 5 · What the research says (1:20)
We didn't want to guess what they need, so we read the research.
Only **13.6%** of university students here eat enough fruit and vegetables, and counting calories can harm teenagers. **29%** of patients in a Singapore hospital were malnourished, and 93% of hand-written food charts were incomplete. And six in ten Singaporeans eat out at least four times a week.

## 6 · A canteen lunch today (1:45) *(skip for 3 min)*
Today, the data disappears into the bin. Kitchens cook for headcount, everyone gets the same scoop, and all the leftovers go into one bin. So tomorrow, they guess again.

## 7 · The problem we chose (1:55)
**[Speaker 2]**
So our problem is this: canteen managers need to know what people actually eat, dish by dish, because they plan for headcount, not appetite. The difference ends up in the bin.
How might we measure that without slowing down a lunch queue?

## 8 · Why now (2:10) *(skip for 3 min)*
Canteens are squeezed from three sides: rising food costs in a country that imports over 90% of its food, new rules on separating food waste, and the climate cost of waste.

## 9 · Ideas we compared (2:20) *(skip for 3 min)*
We compared five ideas. Weighing the bin can't tell you which dish or which person. Surveys are slow, and nobody photographs every lunch. Only one idea ticked every box.

## 10 · One scanner, two scans (2:30)
**One scanner. Two scans.** You look at the camera and put your tray down before you eat, and again after.
And it doesn't just weigh food. The AI **recognises every dish**, measures **how much of each** you ate, and works out the **nutrients**: energy, protein, carbs, fat, fibre and sodium. **620 grams** served, **95** left: **525 grams** eaten, in about two seconds.
This method is proven: research systems that scan trays this way identify about **89%** of foods, and their nutrient estimates closely match the real values.

## 11 · The scanner (2:55)
Here's the hardware: a depth camera above the tray, a face camera to sign in, a screen, a weighing platform that checks the camera, and a food waste bin that weighs the scraps.

## 12 · How the system works (3:05) *(skip for 3 min)*
The AI runs on the scanner itself, so it keeps working if the Wi-Fi drops. No photos ever leave it: just grams per dish and a tray number.

## 13 · Kiosk, live (3:15)
**[Speaker 3]** *(demo: pick Wei Ling, scan before, then after)*
This is the real kiosk. Wei Ling looks at the camera, scans her tray... and after lunch, she sees exactly what she ate and the CO₂ her tray saved.

## 14 · Kitchen, live (3:35)
That scan lands here, in **PlateLoop Kitchen**, live. Mrs Lim sees which dishes come back, and tomorrow's order is planned from real attendance, weather and school events.
And measuring works: when **86 catering sites**, including some in Singapore, started tracking their waste, they cut it by **36% in the first year**, with a **6-to-1 return**.

## 15 · Loopi, live (4:00)
*(demo: Feed lunch)*
For students, there's **Loopi**, a virtual pet that only eats the lunch you really ate. Waste less and it stays healthy, earns hearts and levels up. It shows food groups instead of calories, and classes race each week. In a Swedish school study, that kind of competition alone cut plate waste by **35%**.

## 16 · Loopi Care, live (4:25)
In hospitals, food left on a tray is a warning sign. **Loopi Care** measures the protein and energy in every meal, lets patients choose tomorrow's food, and tells the nurse *why* a meal wasn't eaten.

## 17 · Loopi Work, live (4:40)
In offices, **Loopi Work** turns a health goal into a daily pick from the canteen. Pre-order to skip the queue, and a 3 pm check-in shows which lunches leave you flat. It's private by default.

## 18 · Lunch Rush 3D (4:55) *(skip for 3 min)*
And to show the whole experience, we built **Lunch Rush**, a 3D game of one lunch break, with the real scanner in it.

## 19 · What testing taught us (5:00)
**[Speaker 4]**
We walked through every step until it broke. Six things did, and each became a feature: if your face isn't recognised, you type your class number; there's no clean-plate pressure, because you're only compared with your own usual; and every alert comes with a next step.

## 20 · Trust by design (5:15) *(skip for 3 min)*
No photos leave the scanner, kitchens see tray numbers rather than names, and every app asks for consent on day one.

## 21 · Impact (5:25)
For one school serving 800 meals a day, a 30% cut in waste, less than those caterers achieved, means **5.7 tonnes** of food saved, about **14 tonnes** of CO₂ avoided, and **S$28,500** back every year. It pays for itself in under **three months**.

## 22 · Business model (5:45)
It's a monthly subscription, from S$200 a site, with the scanner leased so there's no upfront cost. We'd start with contract caterers, because one deal covers many canteens.

## 23 · Where we fit (5:55) *(skip for 3 min)*
Others weigh the bin. We measure what each person actually eats, across schools, hospitals and offices.

## 24 · Roadmap and ask (6:05)
Next term, we want to prove these numbers in one canteen.
**Our ask is simple: one school canteen to pilot for one term.** We'll bring the scanner and the apps, and share every number with the school.

## 25 · Thank you (6:20)
PlateLoop. **Know what's eaten. Waste less.** Scan the code to try every app on your phone. Thank you!

---

## Likely judge questions

- **How accurate is it?** Research systems using the same before-and-after depth-camera method identify about 89% of foods, and their nutrient estimates closely match the real values (Pfisterer et al., *JMIR Aging* 2022; Lu et al., 2020). The weighing platform checks the camera's estimate in real grams.
- **Won't it slow the queue?** Each scan takes about two seconds, and sign-in is by face, so there's no card to find.
- **What about privacy?** No photos leave the scanner. Faces become a match code on the device, face sign-in can be switched off, and kitchens see tray numbers, not names.
- **Where do the savings come from?** Kitchens that measure their waste cut it: 36% in the first year across 86 catering sites (Champions 12.3, 2018). Our estimate assumes a smaller 30% cut, to be proven in the pilot.
- **Why would students bother?** Because Loopi only grows from the lunch they really eat, and their class is racing. Waste less, and their pet thrives.
- **What does it cost?** From S$200 a site a month (illustrative), leased, so there's nothing to buy upfront.
