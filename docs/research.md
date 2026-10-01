# The evidence behind PlateLoop

Desk research behind the scanner and the Loopi apps: the size of the problem, the evidence that measuring waste reduces it, what each group of users struggles with, and what PlateLoop does about it. Every figure below was checked against its original source (October 2026). Figures from studies outside Singapore are labelled as such.

## The problem

| Figure | Source |
|---|---|
| **755,000 tonnes** of food waste in Singapore in 2023, about 11% of all waste; only **18%** (132,000 t) was recycled | NEA, [Food waste management](https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/food-waste-management) and waste statistics 2023 |
| **1.05 billion tonnes** of food wasted worldwide in 2022: 60% in households, **28% in food service**, 12% in retail | UNEP, [Food Waste Index Report 2024](https://www.unep.org/resources/publication/food-waste-index-report-2024) |
| Food loss and waste causes **8–10%** of global greenhouse gas emissions | UNEP, Food Waste Index Report 2024 |

## The scanner's method is proven

PlateLoop recognises each dish, measures how much was eaten and works out the nutrients from depth-camera images of the tray before and after the meal. Research systems built this way already work:

- **AFINI-T** used overhead RGB-depth images of plated meals: food classification reached **88.9%** top-1 accuracy, and nutrient intake estimated from volume agreed very closely with estimates from weight (r² = 0.92–0.99). Source: Pfisterer et al., "Automated Food Imaging and Nutrient Intake Tracking (AFINI-T)", *JMIR Aging*, 2022 ([PMC9716425](https://pmc.ncbi.nlm.nih.gov/articles/PMC9716425/)).
- A hospital system from the University of Bern estimated each patient's nutrient intake from RGB-depth image pairs taken before and after the meal; estimates correlated above 0.91 with the true values, with mean relative errors under 20%. Source: Lu et al., "An Artificial Intelligence-Based System to Assess Nutrient Intake for Hospitalised Patients", 2020 ([arXiv 2003.08273](https://arxiv.org/abs/2003.08273)).

The nutrients PlateLoop reports are energy, protein, carbohydrate, fat, fibre and sodium, plus food groups against HPB's My Healthy Plate.

## The core evidence: measuring food waste cuts it

- A review of **86 catering sites in six countries (China, Ireland, Norway, Singapore, Sweden, UK)** found that sites which measured and acted on their food waste cut it by **36% by weight in the first year** on average. Nearly all achieved a positive return, averaging **6:1**; 64% recouped their investment within the first year, and 79% spent under US$10,000. Source: Champions 12.3 (WRAP and WRI), [*The Business Case for Reducing Food Loss and Waste: Catering*](https://champions123.org/the-business-case-for-reducing-food-loss-and-waste-caterers/), June 2018.
- This is the basis of PlateLoop's impact estimate. For one school serving 800 meals a day we assume a **30%** cut (below the 36% average): 800 meals × 190 days × 0.5 kg = 76 t of food a year; 25% wasted = 19 t; 30% of that = **5.7 t** saved. At S$2.50 of ingredients per meal that is **S$28,500** a year; at 2.5 kg CO₂e per kg of food, about **14 t CO₂e**. The 25% starting waste, the cost per meal and the CO₂ factor are assumptions to validate in a pilot.

## Students (secondary school and university)

**What we found**
- Only **13.6%** of university students in Singapore met the international recommendation for fruit and vegetables, and 27.1% met the national one (884 undergraduates). [1]
- Regular use of diet and calorie-counting apps is linked with more disordered-eating symptoms, so apps for young people should avoid putting calorie counts first. [2]
- Friendly competition works: in a Swedish school study, involving students in weighing plate waste and posting the results on the canteen wall cut plate waste by **35%**. A Portuguese study of nutrition education found a 33.9% reduction a week later, which faded by three months. [3]

**What PlateLoop does**
- Loopi shows **food groups, not calories**, by default: did the plate have grains, protein, vegetables and fruit? Calories stay hidden unless a student turns them on.
- **Class races** turn waste into a weekly competition between classes, with names only if students opt in, so the effect doesn't fade after one lesson.
- Loopi grows from finishing a right-sized portion, never from a clean-plate rule, and students are compared with their own usual.

Sources: [1] Chew et al., "Are university students in Singapore meeting the international and national recommendations for fruit and vegetable intake?", *Asia Pacific Journal of Public Health*, 2017. [2] Flinders University systematic review of diet and fitness apps, 2025. [3] Engström & Carlsson-Kanyama, "Food losses in food service institutions: examples from Sweden", *Food Policy*, 2004, as reported in Liz Martins et al., "Strategies to reduce plate waste in primary schools", *Public Health Nutrition*, 2015 ([PMC10271086](https://pmc.ncbi.nlm.nih.gov/articles/PMC10271086/)).

## Hospital patients (and the nurses and dietitians who look after them)

**What we found**
- **29%** of 818 adults admitted to a Singapore tertiary hospital were malnourished. They stayed longer (6.9 vs 4.6 days), were more likely to be readmitted and had higher three-year mortality. [4]
- **93%** of food intake charts completed by nursing staff were incomplete, and the charts did not accurately measure what patients ate. [5]
- Across 32 studies, hospitals leave a median of **30%** of served food on the plate (range 6–65%), much more than other food service. [6]
- Electronic bedside meal ordering, where patients choose close to mealtime, improved intake, satisfaction, plate waste and costs (systematic review: 5 studies, 720 patients). [7]

**What PlateLoop does**
- The ward scanner measures **every tray automatically**, so nobody has to fill in a food chart.
- After two poor meals the **nurse station** gets an alert with the patient's own reason (appetite, taste, too much, tired, pain, nausea) and one-tap actions.
- Patients **choose tomorrow's meals** and portion size, in large text, with a read-aloud button.

Sources: [4] Lim et al., "Malnutrition and its impact on cost of hospitalization, length of stay, readmission and 3-year mortality", *Clinical Nutrition*, 2012 ([PubMed 22122869](https://pubmed.ncbi.nlm.nih.gov/22122869/)). [5] Palmer, Miller & Noble, accuracy of food intake charts completed by nursing staff, 2015. [6] Williams & Walton, "Plate waste in hospitals and strategies for change", *e-SPEN*, 2011. [7] "Impact of electronic bedside meal ordering systems on dietary intake, patient satisfaction, plate waste and costs: a systematic literature review" ([PMC7383857](https://pmc.ncbi.nlm.nih.gov/articles/PMC7383857/)).

## Office workers

**What we found**
- **6 in 10** Singapore residents eat out for lunch or dinner at least four times a week. [8]
- Obesity among residents rose from **10.5%** (2019–20) to **12.7%** (2023–24). [9]
- Ordering ahead leads to lighter lunches: in a corporate cafeteria (690 employees), people who ordered on average 168 minutes before lunch chose meals with about 30 fewer calories (568 vs 598). [10]
- A widely quoted "51% more fruit" result comes from pre-ordering with nudges in a **US school lunch** programme, not a workplace, so we don't use it for Loopi Work. [11]

**What PlateLoop does**
- Loopi Work turns a **personal goal** into a daily pick from the canteen lines, with small tweaks such as adding eggs for protein.
- **Pre-order** the pick before 11:30: lighter choices for the worker, and the kitchen cooks to orders instead of guessing.
- A **3 pm energy check-in** shows each worker how their lunches line up with their afternoon.
- **Private by default**: the employer sees only anonymous canteen totals and team challenges.

Sources: [8] Health Promotion Board, National Nutrition Survey 2010, cited in HPB's [Healthier Dining Programme](https://www.hpb.gov.sg/newsroom/healthier-dining-programme-extended-to-include-food-in-hawker-centres-and-coffee-shops/) release. [9] MOH, [National Population Health Survey 2024](https://moh.gov.sg/newsroom/national-population-health-survey-2024-shows-singaporeans-are-adopting-healthier-lifestyles---but-rising-obesity-is-a-concern). [10] VanEpps, Downs & Loewenstein, "Advance ordering for healthier eating?", *Journal of Marketing Research*, 2016 ([Penn summary](https://penntoday.upenn.edu/news/want-cut-calories-new-penn-studies-suggest-placing-orders-its-time-eat)). [11] Miller et al., *Journal of Economic Psychology*, 2016, as cited in [PMC8701129](https://pmc.ncbi.nlm.nih.gov/articles/PMC8701129/).

## Corrections made in October 2026

- The "35% less plate waste" figure is now credited to its original Swedish study rather than the review that quoted it.
- "51% more fruit with pre-ordering" was removed from Loopi Work: it came from a school lunch study, not a workplace.
- "None of 40 budget meals met My Healthy Plate" was removed: we could confirm that CNA sampled 40 budget meals and found them carb-heavy, but not the "none met" finding.
- The "6 in 10 eat out" figure is from the 2010 National Nutrition Survey, not 2018.
- Hospital plate waste is now the median of 30% across 32 studies (Williams & Walton, 2011).
