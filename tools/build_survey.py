"""
PlateLoop survey kit: the online survey's questions for four groups, illustrative sample responses, an Excel analysis workbook and a findings infographic.

  pip install openpyxl pandas selenium
  python tools/build_survey.py

Writes survey/questions.js (the online survey's questions) and, in docs/survey/:
  plateloop-survey-analysis.xlsx          dashboard, one sheet per group, key findings and the sample responses (all formulas)
  plateloop-key-findings.pdf/.html       one-page findings infographic (the .html is animated)
The workbook and infographic design lives in tools/survey_design.py.

ALL RESPONSES ARE SYNTHETIC (randomly generated with a fixed seed) to demonstrate the analysis.
They are not real survey results. Replace them with real responses before drawing conclusions.
"""
import base64, os, random, sys, time
from decimal import Decimal, ROUND_HALF_UP
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'survey')
SEED = 35  # a demo draw that resembles a typical real survey (see README); change it to draw another
MAXROW = 1000  # analysis formulas cover rows 2..1000 so real data can be pasted in

L5 = {'agree': ['1 Strongly disagree', '2', '3', '4', '5 Strongly agree']}
# ================================================================ survey questions (single source of truth; the online survey reads them)
# question: (code, text, type, options or None, demo distribution)
#   type 'cat'   -> one option; dist = weights per option
#   type 'lik'   -> 1-5 scale; dist = weights for 1..5; options = (low label, high label)
#   type 'num'   -> number; dist = (mean, sd, min, max)
#   type 'text'  -> free text; dist = list of demo comments
GROUPS = [
 dict(key='Students', sheet='Students_Data', n=30, title='Students (secondary school and university)',
      intro='About your school or campus canteen lunch. Takes about 4 minutes. Anonymous.',
      qs=[
   ('S1', 'Which are you?', 'cat', ['Secondary school', 'University'], [.75, .25]),
   ('S2', 'How often do you leave food on your tray?', 'cat', ['Never', 'Rarely', 'Sometimes', 'Often', 'Almost always'], [.08, .20, .37, .25, .10]),
   ('S3', 'What is the main reason you leave food?', 'cat', ['Portion too big', 'Don’t like the taste', 'Not hungry', 'Ran out of time', 'Didn’t recognise the dish'], [.38, .27, .15, .12, .08]),
   ('S4', 'Would you take a smaller portion if you could ask for one easily?', 'cat', ['Yes', 'Maybe', 'No'], [.58, .27, .15]),
   ('S5', 'Are you told to finish everything on your plate?', 'cat', ['Yes', 'Sometimes', 'No'], None),
   ('S6', 'I would like to see what I ate at lunch (food groups and nutrients).', 'lik', ('Strongly disagree', 'Strongly agree'), [.06, .10, .24, .34, .26]),
   ('S7', 'Which would you rather see about your lunch?', 'cat', ['Food groups', 'Calories', 'Both', 'Neither'], [.46, .18, .22, .14]),
   ('S8', 'I would scan my tray before and after lunch if it fed a virtual pet.', 'lik', ('Strongly disagree', 'Strongly agree'), None),
   ('S9', 'A weekly class competition on food waste would motivate me.', 'lik', ('Strongly disagree', 'Strongly agree'), [.07, .10, .22, .33, .28]),
   ('S10', 'I would be comfortable signing in to a scanner with my face.', 'lik', ('Strongly disagree', 'Strongly agree'), [.14, .17, .25, .25, .19]),
   ('S11', 'Anything else about lunch or food waste at your canteen?', 'text', None, [
      'The rice portion is always too big for me.', 'I would eat more vegetables if they tasted better.', 'Sometimes I don’t know what the dish is.',
      'Queues are too long so I rush my food.', 'A pet game would be fun if it is not too childish.', 'I don’t want my name on a leaderboard.',
      'More fruit options please.', 'I prefer not to use face scanning.', 'Being told to finish everything makes me feel bad.', ''])]),
 dict(key='Kitchen', sheet='Kitchen_Data', n=8, title='Canteen and kitchen staff',
      intro='About how your canteen plans food and handles leftovers. Takes about 4 minutes.',
      qs=[
   ('K1', 'What is your role?', 'cat', ['Canteen operator', 'Cook', 'Kitchen assistant'], [.25, .42, .33]),
   ('K2', 'How do you mainly decide how much to cook each day?', 'cat', ['Past experience', 'Headcount × standard portion', 'Previous day’s leftovers', 'Written records'], [.50, .33, .12, .05]),
   ('K3', 'Roughly what percentage of the food you cook is thrown away on a typical day?', 'num', None, (22, 7, 5, 45)),
   ('K4', 'Do you know which dishes come back on trays most?', 'cat', ['Yes, accurately', 'Roughly', 'No'], [.17, .58, .25]),
   ('K5', 'How often do you prepare more food than is eaten?', 'cat', ['Never', 'Rarely', 'Weekly', 'Several times a week', 'Daily'], [.04, .13, .38, .33, .12]),
   ('K6', 'A suggested order for tomorrow, based on what was eaten, would be useful.', 'lik', ('Not useful', 'Very useful'), [.02, .05, .12, .36, .45]),
   ('K7', 'Seeing waste broken down by dish would be useful.', 'lik', ('Not useful', 'Very useful'), [.02, .04, .10, .35, .49]),
   ('K8', 'A monthly carbon report would be useful.', 'lik', ('Not useful', 'Very useful'), [.10, .18, .32, .25, .15]),
   ('K9', 'How many minutes a day do you spend planning orders and quantities?', 'num', None, (35, 12, 10, 75)),
   ('K10', 'I am worried a new system would add to my workload.', 'lik', ('Strongly disagree', 'Strongly agree'), [.08, .14, .26, .32, .20]),
   ('K11', 'Anything else?', 'text', None, [
      'We cook the same amount every day regardless of attendance.', 'Vegetables come back the most.', 'Exam weeks and trips change everything.',
      'I don’t have time to fill in forms.', 'If it saves money the boss will like it.', 'Soup is always wasted.', ''])]),
 dict(key='Hospital', sheet='Hospital_Data', n=6, title='Hospital staff (nurses, dietitians, ward managers)',
      intro='About how patients’ food intake is tracked on your ward. Takes about 4 minutes.',
      qs=[
   ('H1', 'What is your role?', 'cat', ['Nurse', 'Dietitian', 'Ward manager'], [.67, .22, .11]),
   ('H2', 'How is patients’ food intake mainly tracked on your ward?', 'cat', ['Food charts', 'Visual estimate', 'Patient report', 'Not tracked'], [.55, .25, .14, .06]),
   ('H3', 'I am confident our intake records are accurate.', 'lik', ('Strongly disagree', 'Strongly agree'), [.17, .36, .30, .14, .03]),
   ('H4', 'How many minutes per shift do you spend documenting food intake?', 'num', None, (28, 10, 5, 60)),
   ('H5', 'How quickly is a patient who stops eating usually noticed?', 'cat', ['Same day', 'After 2–3 days', 'After 4+ days', 'Often missed'], [.14, .44, .25, .17]),
   ('H6', 'What is the most common reason patients leave food?', 'cat', ['Poor appetite', 'Taste', 'Portion too big', 'Too tired', 'Pain or nausea'], [.36, .19, .17, .12, .16]),
   ('H7', 'Automatic intake records for every tray would be useful.', 'lik', ('Not useful', 'Very useful'), [.01, .03, .08, .30, .58]),
   ('H8', 'An alert that includes the patient’s reason for not eating would be useful.', 'lik', ('Not useful', 'Very useful'), [.02, .04, .10, .32, .52]),
   ('H9', 'Would patients benefit from choosing their next day’s meals and portion size?', 'cat', ['Yes', 'Maybe', 'No'], [.64, .28, .08]),
   ('H10', 'Anything else?', 'text', None, [
      'Food charts are filled in at the end of the shift from memory.', 'Elderly patients often leave most of their tray.', 'We need to know protein intake for wound healing.',
      'Alerts must not create more paperwork.', 'Patients would like more choice.', ''])]),
 dict(key='Office', sheet='Office_Data', n=6, title='Office workers',
      intro='About lunch at your workplace canteen. Takes about 4 minutes. Anonymous.',
      qs=[
   ('O1', 'Your age group', 'cat', ['20–29', '30–39', '40–49', '50+'], [.30, .35, .22, .13]),
   ('O2', 'How many days a week do you eat at the office canteen?', 'num', None, None),
   ('O3', 'Do you have a health goal for your meals?', 'cat', ['Lose weight', 'Build muscle', 'Steady energy', 'Eat balanced', 'None'], [.30, .14, .20, .21, .15]),
   ('O4', 'I know the nutrients in my canteen lunch.', 'lik', ('Strongly disagree', 'Strongly agree'), [.28, .38, .20, .10, .04]),
   ('O5', 'How often do you feel an energy dip in the afternoon?', 'cat', ['Never', 'Rarely', 'Sometimes', 'Often', 'Daily'], [.05, .15, .35, .32, .13]),
   ('O6', 'Would you pre-order lunch to skip the queue?', 'cat', ['Yes', 'Maybe', 'No'], [.56, .29, .15]),
   ('O7', 'A daily lunch suggestion for my health goal would be useful.', 'lik', ('Not useful', 'Very useful'), [.04, .08, .20, .38, .30]),
   ('O8', 'Would you share your meal data with your employer?', 'cat', ['Yes', 'Only anonymous totals', 'No'], [.16, .58, .26]),
   ('O9', 'How many minutes do you usually queue at lunch?', 'num', None, (11, 4, 2, 25)),
   ('O10', 'Anything else?', 'text', None, [
      'Healthy options run out early.', 'I never know how many calories are in the mixed rice.', 'Pre-ordering would save me 15 minutes.',
      'I don’t want HR to see what I eat.', 'Afternoon slump after noodles.', ''])]),
]

# extra open-text comments, so every illustrative respondent has one
MORE_COMMENTS = {
    'S11': ['Lunch is too rushed, I only get 20 minutes.', 'I like the chicken rice but the portion is huge.', 'I would scan my tray if it gave me points.',
            'Please label the dishes, I never know what the curry is.', 'I skip vegetables when they are overcooked.', 'Smaller portions should cost less.',
            'Friends would compete if there was a class leaderboard.', 'I get hungry again by 3 pm.', 'I want to know if my lunch has enough protein for sport.',
            'The canteen throws away so much food at the end of the day.', 'Fine as it is, just less oily please.', 'More choice for vegetarians.'],
    'K11': ['Fridays are always quieter, we still cook the same.', 'Rice is the thing we throw away most.', 'Students leave the greens every time.',
            'Writing things down takes too long during service.', 'If it tells me how much to cook, I will use it.', 'Rainy days mean more students eat in.',
            'We guess from yesterday and hope.', 'A simple screen would be better than an app.'],
    'H10': ['Intake charts are often blank by the end of the day.', 'We only find out a patient isn’t eating when the family tells us.',
            'Dietitians need protein numbers, not just “half eaten”.', 'Night staff don’t see what was eaten at lunch.', 'Anything automatic would save time.',
            'Older patients struggle to open packets, so food comes back untouched.'],
    'O10': ['I eat at my desk most days.', 'The salad bar runs out by 12:30.', 'Would love to see protein per dish.', 'Pre-order would stop me wasting my lunch break in the queue.',
            'Keep my data away from my manager.', 'Mixed rice portions are random.', 'I get sleepy after the noodles.', 'Calorie counts would be nice, optional though.'],
}

def fill_comments(data):
    rnd = random.Random(SEED + 100)
    for G in GROUPS:
        code = next(q[0] for q in G['qs'] if q[2] == 'text')
        pool = [c for c in next(q[4] for q in G['qs'] if q[0] == code) if c] + MORE_COMMENTS[code]
        df = data[G['key']]
        df[code] = [v if v else rnd.choice(pool) for v in df[code]]
    return data

# ================================================================ demo data
def make_data():
    rnd = random.Random(SEED); data = {}
    for G in GROUPS:
        rows = []
        for i in range(G['n']):
            r = {'ID': f"{G['key'][0]}{i+1:03d}"}
            for code, text, typ, opts, dist in G['qs']:
                if typ == 'cat':
                    if code == 'S5':  # being told to finish depends on level
                        w = [.45, .35, .20] if r['S1'] == 'Secondary school' else [.10, .25, .65]
                    else: w = dist
                    r[code] = rnd.choices(opts, w)[0]
                elif typ == 'lik':
                    if code == 'S8':  # the pet appeals more to secondary students
                        w = [.03, .06, .16, .35, .40] if r['S1'] == 'Secondary school' else [.10, .16, .30, .28, .16]
                    else: w = dist
                    r[code] = rnd.choices([1, 2, 3, 4, 5], w)[0]
                elif typ == 'num':
                    if code == 'O2': r[code] = rnd.choices([0, 1, 2, 3, 4, 5], [.02, .05, .13, .25, .30, .25])[0]
                    else:
                        m, sd, lo, hi = dist; r[code] = int(min(hi, max(lo, round(rnd.gauss(m, sd)))))
                else:
                    r[code] = rnd.choice(dist) if rnd.random() < .45 else ''
            rows.append(r)
        data[G['key']] = pd.DataFrame(rows)
    return data


# ================================================================ workbook findings (the workbook itself is built in survey_design.py)
def findings_formulas(A):
    """The 13 key findings as Excel formulas over the group sheets; finding_texts() mirrors them in Python."""
    P = lambda key, fmt='0%': f'TEXT({A[key]},"{fmt}")'
    LB, SH = A[('S3', 'range')]
    findings = [
     ('Students', f'="The most common reason for leaving food is \'"&INDEX({LB},MATCH(MAX({SH}),{SH},0))&"\' ("&TEXT(MAX({SH}),"0%")&"); "&{P(("S4","Yes"))}&" would take a smaller portion if they could ask easily."', 'The before scan and right-portion rewards in Loopi: a small plate finished counts fully.'),
     ('Students', f'="When seeing what they ate, "&{P(("S7","Food groups"))}&" would rather see food groups and "&{P(("S7","Calories"))}&" calories."', 'Loopi shows food groups by default; calories stay optional.'),
     ('Students', f'="Interest in scanning trays to feed a virtual pet averages "&{P(("S8","avg"),"0.0")}&" out of 5; "&{P(("S8","agree"))}&" agree."', 'The Loopi pet as the reason students scan.'),
     ('Students', f'={P(("S10","agree"))}&" of students are comfortable with face sign-in."', 'Keep the class-and-number alternative; face sign-in stays optional.'),
     ('Kitchen', f'=TEXT({A[("K2","Past experience")]}+{A[("K2","Headcount × standard portion")]},"0%")&" of kitchen staff decide quantities by experience or headcount; "&{P(("K4","Yes, accurately"))}&" know accurately which dishes come back."', 'Kitchen dashboard: waste by dish and a forecast from real eating data.'),
     ('Kitchen', f'="Kitchen staff estimate "&{P(("K3","Average"),"0")}&"% of cooked food is thrown away and spend "&{P(("K9","Average"),"0")}&" minutes a day planning quantities."', 'A suggested order for tomorrow saves planning time and cuts over-preparation.'),
     ('Kitchen', f'="A suggested order is rated useful by "&{P(("K6","agree"))}&" and waste by dish by "&{P(("K7","agree"))}&"; "&{P(("K10","agree"))}&" worry about extra workload."', 'Measurement is automatic: no forms or manual entry for kitchen staff.'),
     ('Hospital', f'={P(("H3","agree"))}&" of hospital staff trust their intake records; documenting intake takes "&{P(("H4","Average"),"0")}&" minutes a shift."', 'Loopi Care records every tray automatically.'),
     ('Hospital', f'="Staff say a patient who stops eating is noticed the same day in "&{P(("H5","Same day"))}&" of cases."', 'Nurse-station alerts after poor meals, the same day.'),
     ('Hospital', f'="Automatic intake records are rated useful by "&{P(("H7","agree"))}&"; "&{P(("H9","Yes"))}&" say patients would benefit from choosing tomorrow’s meals."', 'Loopi Care: per-tray intake and patient meal choice.'),
     ('Office', f'={P(("O4","agree"))}&" of office workers know the nutrients in their lunch; "&TEXT({A[("O5","Often")]}+{A[("O5","Daily")]},"0%")&" feel an afternoon energy dip often or daily."', 'Loopi Work: nutrients per lunch and a 3 pm energy check-in.'),
     ('Office', f'={P(("O6","Yes"))}&" would pre-order lunch to skip a typical "&{P(("O9","Average"),"0")}&"-minute queue."', 'Pre-ordering in Loopi Work; kitchens cook to orders.'),
     ('Office', f'={P(("O8","Yes"))}&" would share meal data with their employer; "&{P(("O8","Only anonymous totals"))}&" would share anonymous totals only."', 'Private by default: employers see team totals, never names.'),
    ]
    return findings

# ================================================================ findings PDF
def P(v):
    """Percent rounded half-up, the same way Excel's TEXT(x,"0%") does, so the PDF and the workbook agree."""
    return f'{int(Decimal(str(v * 100)).quantize(Decimal(0), rounding=ROUND_HALF_UP))}%'

def finding_texts(data):
    """The same findings as the workbook's formulas, computed in Python for the PDF."""
    S, K, Hh, O = (data[k] for k in ('Students', 'Kitchen', 'Hospital', 'Office'))
    sh = lambda df, c, o: P((df[c] == o).mean()); ag = lambda df, c: P((df[c] >= 4).mean())
    shares = S.S3.value_counts(normalize=True); order = GROUPS[0]['qs'][2][3]
    top = max(order, key=lambda o: shares.get(o, 0))  # first option wins a tie, like Excel's MATCH
    half = lambda v: f'{Decimal(str(v)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)}'
    whole = lambda v: f'{Decimal(str(v)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)}'
    return [
     (f'The most common reason for leaving food is ‘{top}’ ({P(shares.get(top, 0))}); {sh(S,"S4","Yes")} would take a smaller portion if they could ask easily.', 'The before scan and right-portion rewards in Loopi: a small plate finished counts fully.'),
     (f'When seeing what they ate, {sh(S,"S7","Food groups")} would rather see food groups and {sh(S,"S7","Calories")} calories.', 'Loopi shows food groups by default; calories stay optional.'),
     (f'Interest in scanning trays to feed a virtual pet averages {half(S.S8.mean())} out of 5; {ag(S,"S8")} agree.', 'The Loopi pet as the reason students scan.'),
     (f'{ag(S,"S10")} of students are comfortable with face sign-in.', 'Keep the class-and-number alternative; face sign-in stays optional.'),
     (f'{P(((K.K2=="Past experience")|(K.K2=="Headcount × standard portion")).mean())} of kitchen staff decide quantities by experience or headcount; {sh(K,"K4","Yes, accurately")} know accurately which dishes come back.', 'Kitchen dashboard: waste by dish and a forecast from real eating data.'),
     (f'Kitchen staff estimate {whole(K.K3.mean())}% of cooked food is thrown away and spend {whole(K.K9.mean())} minutes a day planning quantities.', 'A suggested order for tomorrow saves planning time and cuts over-preparation.'),
     (f'A suggested order is rated useful by {ag(K,"K6")} and waste by dish by {ag(K,"K7")}; {ag(K,"K10")} worry about extra workload.', 'Measurement is automatic: no forms or manual entry for kitchen staff.'),
     (f'{ag(Hh,"H3")} of hospital staff trust their intake records; documenting intake takes {whole(Hh.H4.mean())} minutes a shift.', 'Loopi Care records every tray automatically.'),
     (f'Staff say a patient who stops eating is noticed the same day in {sh(Hh,"H5","Same day")} of cases.', 'Nurse-station alerts after poor meals, the same day.'),
     (f'Automatic intake records are rated useful by {ag(Hh,"H7")}; {sh(Hh,"H9","Yes")} say patients would benefit from choosing tomorrow’s meals.', 'Loopi Care: per-tray intake and patient meal choice.'),
     (f'{ag(O,"O4")} of office workers know the nutrients in their lunch; {P(((O.O5=="Often")|(O.O5=="Daily")).mean())} feel an afternoon energy dip often or daily.', 'Loopi Work: nutrients per lunch and a 3 pm energy check-in.'),
     (f'{sh(O,"O6","Yes")} would pre-order lunch to skip a typical {whole(O.O9.mean())}-minute queue.', 'Pre-ordering in Loopi Work; kitchens cook to orders.'),
     (f'{sh(O,"O8","Yes")} would share meal data with their employer; {sh(O,"O8","Only anonymous totals")} would share anonymous totals only.', 'Private by default: employers see team totals, never names.'),
    ]

def to_pdf(html_path, pdf_path):
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    from capture import serve, PORT
    from selenium import webdriver
    h = serve(); o = webdriver.ChromeOptions(); o.add_argument('--headless=new'); d = webdriver.Chrome(options=o)
    try:
        rel = os.path.relpath(html_path, ROOT).replace(os.sep, '/')
        d.get(f'http://127.0.0.1:{PORT}/{rel}'); time.sleep(2.5)
        pdf = d.execute_cdp_cmd('Page.printToPDF', {'printBackground': True, 'preferCSSPageSize': True})
        open(pdf_path, 'wb').write(base64.b64decode(pdf['data']))
    finally:
        d.quit(); h.shutdown()

def write_questions_js():
    """The online survey (survey/index.html) reads its questions from here, so it always matches the workbook's columns."""
    import json
    groups = [{'key': G['key'], 'title': G['title'], 'intro': G['intro'], 'sheet': G['sheet'],
               'questions': [{'code': c, 'text': t, 'type': ty, 'options': list(o) if o else None} for c, t, ty, o, _ in G['qs']]} for G in GROUPS]
    os.makedirs(os.path.join(ROOT, 'survey'), exist_ok=True)
    NL = chr(10)
    body = '// Generated by tools/build_survey.py. Edit the questions there, then rebuild.' + NL + 'window.SURVEY = ' + json.dumps(groups, ensure_ascii=False, indent=1) + ';' + NL
    open(os.path.join(ROOT, 'survey', 'questions.js'), 'w', encoding='utf-8', newline=NL).write(body)

def main():
    os.makedirs(OUT, exist_ok=True)
    write_questions_js()
    data = fill_comments(make_data())
    sys.path.insert(0, os.path.join(ROOT, 'tools')); import survey_design as D
    texts = finding_texts(data)
    D.build(GROUPS, data, findings_formulas, os.path.join(OUT, 'plateloop-survey-analysis.xlsx'), SEED)
    hp = os.path.join(OUT, 'plateloop-key-findings.html'); open(hp, 'w', encoding='utf-8').write(D.infographic(GROUPS, data))
    to_pdf(hp, os.path.join(OUT, 'plateloop-key-findings.pdf'))
    print('done:', os.listdir(OUT))
    for t, _ in texts: print(' -', t)

if __name__ == '__main__':
    main()
