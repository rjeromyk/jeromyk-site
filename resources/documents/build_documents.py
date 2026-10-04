#!/usr/bin/env python3
"""Editable document source. Build HTML here; render.mjs creates tagged PDFs."""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent
BOOKING = 'https://www.jeromykovatana.com/contact#book'
SITE = 'https://www.jeromykovatana.com'

def box(title, body, style='tint'):
    return f'<aside class="box {style}"><h3>{title}</h3>{body}</aside>'

def decision(text):
    return f'<aside class="decision"><p class="label">Your next move</p><p>{text}</p></aside>'

def write(label, area=False):
    return f'<p class="write-label">{label}</p><div class="{"write-area" if area else "write-line"}" aria-label="Space for your answer"></div>'

def page(kicker, title, body, dek='', classes=''):
    return dict(kicker=kicker,title=title,body=body,dek=dek,classes=classes)

def cover(title, subtitle, intro, purpose):
    return page('The operator series · October 2026', title,
       f'''<div class="cover-layout"><div class="cover-intro"><p>{intro}</p>
       <span class="pill">Insurance agents</span><span class="pill">Agency owners</span>
       <p class="author">Jeromy Kovatana</p><p class="author-role">CTO, GOAT Leads<br>Founder, LeadsBakery</p>
       <p class="cover-note">{purpose}</p></div>
       <img class="cover-portrait" src="assets/headshot-pro.jpg" alt="Jeromy Kovatana wearing a GOAT hat"></div>''', subtitle, 'cover')

def author():
    return '''<div class="bio"><img src="assets/headshot-pro.jpg" alt="Jeromy Kovatana">
    <div><h3 style="margin-top:0">Finance discipline. Hands-on execution.</h3>
    <p>I worked in audit and financial modeling at <strong>Ernst &amp; Young and Grant Thornton</strong> before moving into a CFO role. That finance background shapes how I look at acquisition: money in, money out, and what actually stays in the business.</p>
    <p>Today I’m CTO of <strong>GOAT Leads</strong> and founder of <strong>LeadsBakery</strong>. My work connects advertising, funnels, lead routing, CRM workflows, and unit economics.</p></div></div>'''

def cta(lead):
    return f'''<p class="dek">{lead}</p>
    <div class="box tint"><p class="label">Free Funnel Teardown · 30 minutes</p>
    <h3 style="font-size:18pt;margin-top:0">Bring your numbers. Leave with a first move.</h3>
    <ul><li>Your leak stage.</li><li>What the math looks like fixed.</li><li>The one change I’d make first.</li><li>The recording and notes—yours whether we work together or not.</li></ul></div>
    <a class="cta-link" href="{BOOKING}">Get your Free Funnel Teardown →</a>
    <p class="cta-url"><a href="{BOOKING}">jeromykovatana.com/contact#book</a></p>
    <p class="small">If the teardown isn’t useful in the first 10 minutes, we call it there. No pitch.</p>
    <h3>Two ways to work together</h3>
    <p><strong>GOAT Leads:</strong> the platform, systems, and lead engine. <strong>Work with me directly:</strong> acquisition and operating systems inside your business. Scope follows your bottleneck, economics, and capacity.</p>
    <h3>Bring what you have</h3><p>A recent lead cohort, spend, contact and placed-policy counts, retained commissions, and a look at your routing and follow-up. If something is unknown, mark it unknown. That is useful information too.</p>
    <p class="small">Explore my work: <a href="{SITE}/">jeromykovatana.com</a> · Booking alternative: <a href="https://cal.com/jeromyk/funnel-teardown">cal.com/jeromyk/funnel-teardown</a></p>'''

playbook = [
 cover('The $3M/Month<br>Ad Playbook',
       'Seven operating decisions for a stronger insurance lead system.',
       'Buying more leads is easy. Knowing which leads you can afford—and building the system to work them—is the real job.',
       'Apply the same operating discipline at your scale. Includes a lead economics worksheet, a weekly scorecard, and a 30-day action plan.'),
 page('Start here', 'Build the system behind the spend.',
      '''<p>You can buy an inexpensive lead and still lose money. You can buy a more expensive lead and keep more money. The difference lives between the first click and the placed policy.</p>
      <p>This playbook connects seven decisions across that journey. It is not a requirement to spend $3M—or even $100K—a month. Use the principles at a budget and workload your business can support.</p>'''+author()+
      '''<div class="cols"><div class="box tint"><h3>Writing your own business?</h3><p>Start with your allowable lead cost, contact process, and one source you can measure. A spreadsheet and a disciplined weekly review can be enough to begin.</p></div>
      <div class="box tint"><h3>Running an agency?</h3><p>Look at economics by source and product, routing by agent, and whether your team can work the volume you plan to buy.</p></div></div>
      <h3>Read it once. Then use it weekly.</h3><p>Pages 3–9 cover the seven decisions. Page 10 shows the spend receipts behind my experience. Page 11 is your scorecard and action plan. Bring that page to the teardown on page 12.</p>
      <p class="small">This is an operating framework, not a promise of profit. Outcomes depend on your product, compensation, lead source, sales process, and execution.</p>'''),
 page('Decision 01 · Economics', 'Run acquisition like a P&amp;L.',
      '''<p>The useful question is not “How cheap is this lead?” It is “What can I pay for this lead and still retain the contribution my business needs?”</p>
      <div class="box dark"><p class="label" style="color:var(--mint)">The per-lead ceiling</p>
      <p><strong>Break-even CPL = lead-to-placed rate × net retained contribution per placed policy − working cost per lead.</strong></p>
      <p class="small">CPL = cost per delivered lead. This is a per-lead ceiling, not cost per acquired policy. Choose a buying target below it to leave room for overhead, profit, and uncertainty.</p></div>
      <table><thead><tr><th>Illustrative completed cohort</th><th class="num">Example</th></tr></thead><tbody>
      <tr><td>Delivered leads → leads with a placed policy</td><td class="num">200 → 16</td></tr>
      <tr><td>Lead-to-placed rate</td><td class="num">16 ÷ 200 = 8%</td></tr>
      <tr><td>Net retained contribution per placed policy</td><td class="num">$400</td></tr>
      <tr><td>Working cost per lead</td><td class="num">$2</td></tr>
      <tr><td>Break-even CPL</td><td class="num">8% × $400 − $2 = $30</td></tr>
      <tr><td>Chosen reserve → target CPL</td><td class="num">$6 per lead → $24</td></tr></tbody></table>
      <p class="small">Hypothetical numbers, not client results or benchmarks. This example counts one placed policy per converted lead. At $24 CPL: 16 × $400 − 200 × ($24 + $2) = $1,200 before overhead and tax.</p>
      <p style="font-size:10.4pt"><strong>Keep the inputs honest.</strong> Net retained contribution accounts for splits, expected chargebacks, and policy-level costs. Working cost covers lead handling. Count expenses once. For multiple policies, multiply the share of leads with a placed policy by average total net policy contribution per converted lead. Use a mature cohort and track cash separately from modeled contribution.</p>
      <p class="small">Use your own inputs on the working page (page 11). Keep a separate cash ledger for payments, advances, and reversals.</p>'''+
      decision('Set your ceiling before you change a budget. A bid strategy can help control delivery; it cannot repair bad unit economics.')),
 page('Decision 02 · Weekly winners', 'Refresh for a reason.',
      '''<p>A winning ad is an asset. Review it each week, but do not restart it just because a calendar says so. Performance can change because of creative fatigue, auction costs, audience mix, tracking, or sales execution.</p>
      <h3>Read the signal before changing the campaign</h3>
      <table><thead><tr><th>What changed?</th><th>What to inspect next</th></tr></thead><tbody>
      <tr><td>Delivery cost rose</td><td>Auction costs, reach, frequency, and whether spend moved into a different audience.</td></tr>
      <tr><td>Response to the ad fell</td><td>Hook, creative relevance, placement, and audience saturation.</td></tr>
      <tr><td>Lead cost rose after the click</td><td>Message match, page speed, form errors, and tracking changes.</td></tr>
      <tr><td>Lead cost held; placed results fell</td><td>Lead mix, routing, response times, agent capacity, and cohort maturity.</td></tr></tbody></table>
      <div class="box tint"><h3>Make the smallest useful change</h3><p>If the problem is the hook, test a new hook. If a form broke, repair it. If agents are behind, fix the backlog before buying more. Keep a record of what changed and when.</p></div>
      <div class="cols"><div><h3>For an individual agent</h3><p>Compare your recent cohorts from the same source. Ask whether you worked them consistently before blaming the ad or vendor.</p></div><div><h3>For an agency owner</h3><p>Look by source, product, and agent. A blended average can hide one strong segment and one leaking segment.</p></div></div>
      <h3>One change worth testing this week</h3>'''+write('Observed signal → suspected cause → proposed change:')+
      decision('Keep the current winner as your control. A relaunch is an experiment—not a guaranteed reset of fatigue.')),
 page('Decision 03 · Testing grounds', 'Buy learning you can use.',
      '''<p>A test should answer a business question. “Let’s try more ads” is activity. “Does a clearer qualification message improve placed-policy economics?” is a test you can learn from.</p>
      <div class="box tint"><h3>Write the test before you spend</h3><ol><li><strong>Hypothesis:</strong> what change should affect what outcome?</li><li><strong>Comparison:</strong> which current approach is the control?</li><li><strong>Spend and capacity:</strong> what can you afford, and who will work the leads?</li><li><strong>Decision:</strong> what evidence will make you keep, stop, or revise it?</li></ol></div>
      <p>Protect the budget that supports current production. Separate experimental spend when it makes measurement clearer, while avoiding unnecessary campaign fragmentation. The right structure depends on budget, volume, objective, and the platform’s current options.</p>
      <div class="cols"><div><h3>Agent-sized application</h3><p>Use one source, one product, and one change at a time. A vendor trial or a follow-up change can be a better first test than a new ad account.</p></div><div><h3>Agency-sized application</h3><p>Tag test leads through the CRM. Compare contact, placement, retained contribution, and how long results take to mature.</p></div></div>
      <h3>Your next test</h3>'''+write('I believe changing ___ will improve ___ because ___:',True)+write('Control / test spend / owner / review date:')+
      '''<p class="small">No fixed “50 leads” rule or universal daily budget establishes a winner. Smaller samples are noisy; different products take different time to place. If the evidence is thin, call the result inconclusive.</p>'''+
      decision('Graduate a test when the quality and economics support the decision—not just when the cost per lead looks good.')),
 page('Decision 04 · Segmentation', 'Different products. Different math.',
      '''<p>Final expense, mortgage protection, IUL, and other insurance products can attract different buyers and create different operating demands. Give each segment the reporting it needs before deciding how many campaigns or accounts you need.</p>
      <h3>Separate the decision before separating the account</h3>
      <ul><li><strong>Economics:</strong> product, compensation, placement lag, and retained contribution.</li><li><strong>Experience:</strong> the consumer’s actual intent, ad message, landing page, and form.</li><li><strong>Operations:</strong> the agent who can serve the lead, routing rules, and available capacity.</li><li><strong>Reporting:</strong> source and product tags that stay with the record through placement.</li></ul>
      <div class="box tint"><h3>Structure follows the business</h3><p>Separate campaigns, datasets, or accounts only when the business and measurement need it. More accounts create more administration and can divide useful signals. They do not remove business-wide platform obligations.</p></div>
      <p>Use accurate product claims, current platform requirements, and the carrier and contact rules that apply to your work. Do not design around evading a review or hiding the identity of the business.</p>
      <h3>Map one segment</h3>
      <table class="worksheet"><tbody><tr><td>Product / audience / geography</td><td class="answer"></td></tr><tr><td>Contribution target / placement lag</td><td></td></tr><tr><td>Ad → form → source tag</td><td></td></tr><tr><td>Routing owner / capacity / fallback</td><td></td></tr><tr><td>Where placement is recorded</td><td></td></tr></tbody></table>'''+
      decision('Create a clean view of segment economics first. Change account structure when that view identifies a real operating need.')),
 page('Decision 05 · Creative', 'Give buyers a reason to respond.',
      '''<p>Video and images are formats, not strategies by themselves. The creative needs to earn attention, explain the offer, and set an expectation the next page and agent can honor.</p>
      <div class="cols"><div><h3>What is the buyer thinking?</h3><p>Write the question, concern, or decision the consumer is actually facing. Build the hook around that—not around a marketer’s clever line.</p></div><div><h3>What happens after the click?</h3><p>Make the action clear. The person should understand what they are requesting and what kind of follow-up to expect.</p></div></div>
      <h3>Test the message, then the execution</h3>
      <table><thead><tr><th>Variable</th><th>A useful comparison</th></tr></thead><tbody>
      <tr><td>Hook</td><td>Two different buyer questions, with the same offer.</td></tr>
      <tr><td>Explanation</td><td>A straightforward image versus a short video explaining the same request.</td></tr>
      <tr><td>Expectation</td><td>Clear next-step wording versus wording that leaves follow-up unclear.</td></tr>
      <tr><td>Outcome</td><td>Contact and placement by creative tag—not clicks alone.</td></tr></tbody></table>
      <div class="box tint"><h3>Compare formats when the data supports it</h3><p>Separate format budgets if you need a controlled comparison and have enough volume. Combining formats may be more practical at smaller budgets. Use the platform’s current tools; do not force a structure just to make a tidy spreadsheet.</p></div>
      <h3>Your next creative brief</h3>'''+write('Buyer concern / honest offer / expected next step:')+
      decision('Keep a creative when it brings buyers your team can serve at economics you can sustain. “Cheap leads” alone do not settle the decision.')),
 page('Decision 06 · Front-end match', 'Keep the promise after the click.',
      '''<p>An ad, a landing page, a form, and the first conversation should feel like one experience. When the message changes between those steps, you spend money buying confusion.</p>
      <h3>Walk your funnel like a consumer</h3>
      <ol><li><strong>Ad:</strong> what did I believe I was asking for?</li><li><strong>Page:</strong> does the product and promise match?</li><li><strong>Form:</strong> are the requested fields and follow-up clear?</li><li><strong>Confirmation:</strong> do I know what happens next?</li><li><strong>Conversation:</strong> does the agent know the request I made?</li></ol>
      <div class="box tint"><h3>Localize only what you can stand behind</h3><p>Use geography, language, and product context when they improve relevance. Do not imply a local office, carrier affiliation, government endorsement, or benefit that is not real. Have fluent reviewers check translated consumer-facing copy.</p></div>
      <p><strong>Check on a phone.</strong> Open the real page, read the offer, and test the form and confirmation in a safe test environment. Look for tiny text, slow images, fields hidden by overlays, and a page that sends visitors somewhere unexpected.</p>
      <h3>One promise, end to end</h3>
      <table class="worksheet"><thead><tr><th>Step</th><th>What the consumer expects</th></tr></thead><tbody><tr><td>Ad</td><td></td></tr><tr><td>Page + form</td><td></td></tr><tr><td>First contact</td><td></td></tr></tbody></table>'''+
      decision('Repair the first break in expectation. You do not need a different page for every state unless it improves relevance or operations.')),
 page('Decision 07 · Speed to lead', 'Every lead needs an owner.',
      '''<p>A lead cannot turn into a useful conversation while it sits in a queue nobody owns. Routing, response time, and follow-up discipline are part of acquisition—not work to sort out after you scale.</p>
      <div class="box tint"><h3>Define the handoff</h3><ul><li><strong>Delivery:</strong> record creation time and delivery time.</li><li><strong>Ownership:</strong> assign an agent who can serve the request.</li><li><strong>First action:</strong> record the first attempt and the first live contact separately.</li><li><strong>Fallback:</strong> decide who handles an unavailable agent or failed delivery.</li><li><strong>Next step:</strong> record disposition and the next follow-up date.</li></ul></div>
      <p>Set a response target your team can meet and measure it. Automate routing and reminders where they help, but verify the workflow. An automated message is not a completed human conversation.</p>
      <p>Build a follow-up cadence around what the person requested, the product, and valid contact permissions. Honor opt-outs and applicable restrictions. More attempts are not useful if the team has the wrong context or the person no longer wants contact.</p>
      <div class="cols"><div><h3>For an individual agent</h3><p>Use a reliable alert, a next-action list, and a clear schedule for working leads. Do not buy volume you cannot work.</p></div><div><h3>For an agency owner</h3><p>Review time-to-attempt, contact rate, backlog, and placed results by agent. Check the fallback and duplicate rules.</p></div></div>
      <h3>Make the next handoff explicit</h3>'''+write('New lead owner / first-action target / unavailable-owner fallback:')+write('Unworked-lead report / person reviewing it / review schedule:')+
      decision('Measure delivery → first attempt → live contact → placed policy. Improve the leaking stage before increasing volume.')),
 page('Experience · Receipts', '$38M+ in managed ad spend.',
      '''<p class="small">These are redacted views of accounts under my management. They document spend across the periods shown—not profit, a client guarantee, or one month’s spend.</p>
      <figure class="receipt meta"><div class="stat-row"><strong>Meta Ads Manager</strong><span class="stat">$30,113,707.30</span></div><img src="assets/ads-manager-proof.jpg" alt="Redacted Meta Ads Manager view showing $30,113,707.30 in total spend across 11 insurance ad accounts"><figcaption>July 15, 2024–July 13, 2026 · 11 insurance ad accounts · Names and IDs redacted.</figcaption></figure>
      <figure class="receipt google"><div class="stat-row"><strong>Google Ads</strong><span class="stat">$8,102,912.50</span></div><img src="assets/google-ads-proof.jpg" alt="Redacted Google Ads view showing $8,102,912.50 in total advertising cost"><figcaption>November 1, 2024–August 15, 2026 · Account and manager details redacted.</figcaption></figure>
      <div class="box tint"><h3>Why this matters to your business</h3><p>At scale, advertising, cash flow, data, routing, and sales execution have to work together. That is the operating perspective I bring to an agent’s funnel or an agency’s infrastructure.</p></div>
      <p class="small">Combined displayed spend: $38,216,619.80. The windows overlap and differ by platform. Google conversions and Meta leads are different measures; this page does not add them together as unique people.</p>
      <p class="small">View the larger receipts and current work: <a href="https://www.jeromykovatana.com/results">jeromykovatana.com/results</a></p>'''),
 page('Working page · 30-day plan', 'Find the leak. Make one move.',
      '''<p>Use one consistent cohort and let placement results mature. Leads delivered this week and policies placed this week may belong to different groups.</p>
      <table class="worksheet"><thead><tr><th>My source / product / cohort dates:</th><th class="answer">______________________</th></tr></thead><tbody>
      <tr><td>Delivered leads / spend / cost per lead</td><td></td></tr><tr><td>First-attempt timing / live contacts</td><td></td></tr><tr><td>Applications / placed policies</td><td></td></tr><tr><td>Lead-to-placed rate / retained contribution</td><td></td></tr><tr><td>Working costs / target CPL</td><td></td></tr></tbody></table>
      <div class="cols"><div><h3>Week 1 · See the system</h3><p>Calculate the lead ceiling. Map the consumer journey and routing handoff. Mark missing data.</p><h3>Week 2 · Repair the leak</h3><p>Fix one high-impact break: message match, form, routing, response, or follow-up.</p></div><div><h3>Week 3 · Run one test</h3><p>Write the hypothesis, control, spend, owner, and decision. Keep the rest consistent.</p><h3>Week 4 · Review the evidence</h3><p>Keep, revise, or stop. If placement is still maturing, schedule another review before scaling.</p></div></div>
      <p class="small">Suggested sequence—not a promised 30-day result. Some products need a longer observation window.</p>'''+write('My biggest unknown or leak:')+write('The first change / owner / completion date:')+write('The metric / cohort / review date that will tell us if it helped:')+
      '''<p class="small">Bring this page to your <a href="https://www.jeromykovatana.com/contact#book">Free Funnel Teardown</a>. A blank field is a place to start, not a reason to wait.</p>'''),
 page('Work with Jeromy', 'Turn the numbers into a decision.', cta('Get a clear view of where your funnel leaks and which change to make first.')+
      '''<p class="tiny">© 2026 Jeromy Kovatana. Updated October 2026. Examples are educational and illustrative. This document does not promise a particular revenue, lead cost, placement rate, or profit.</p>''')
]

def question(number, title, ask, evidence, read, followup):
    return f'''<article class="question"><p class="kicker">Question {number:02d}</p><h3>{title}</h3>
    <p><strong>Ask:</strong> “{ask}”</p><p><strong>Look for:</strong> {evidence}</p>
    <p><strong>Read the answer:</strong> {read}</p>
    <div class="answer"><p><strong>Follow-up:</strong> {followup}</p><div class="write-area" aria-label="Space to record the vendor answer"></div></div></article>'''

checklist = [
 cover('The Lead Vendor<br>Vetting Checklist',
       'Know what you’re buying. Test it fairly. Follow the math to placed policies.',
       'A lead price tells you what you paid for a record. This guide helps you decide whether that record can work with your offer, your agents, and your follow-up system.',
       '<strong>Ask ten questions.</strong> Request evidence.<br><strong>Record the answers.</strong> Resolve unknowns.<br><strong>Run a bounded trial.</strong> Track what matters.<br><br>Includes an evidence worksheet and a vendor trial scorecard.'),
 page('Questions 01–02 · Product and permission', 'Start with the consumer’s request.',
      question(1,'What, exactly, am I buying?',
       'Define the product in writing: age, sharing, geography, insurance interest, and source.',
       'Definitions of fresh, aged, exclusive, and shared; number of buyers and resale rules; what exclusivity covers and for how long; whether the vendor generates inquiries or buys from partners.',
       'Fresh, aged, shared, and partner-sourced products can serve different jobs. Evaluate the disclosed product and price against how your team will work it. The label must mean the same thing to both parties.',
       'Which details can I verify on the records I receive?')+
      '<div class="rule"></div>'+
      question(2,'What did the person request?',
       'Show me the experience that created the inquiry and the contact-permission evidence retained.',
       'A redacted example of the ad, page, form, offer, and permission wording; the request and timestamps; the channels and recipient categories described; how those records can be retrieved.',
       'An insurance quote request and an incentive-driven form fill create different conversations. Review the actual request and permission evidence with the person responsible for your contact rules.',
       'Can you show a redacted example from this exact product?')),
 page('Questions 03–04 · Records and handoff', 'Know what arrives—and where it goes.',
      question(3,'Can I inspect a complete sample?',
       'Show me a redacted record and walk me through its fields and timestamps.',
       'Product, geography, source IDs, inquiry time, and delivery time; partner acquisition time where relevant; age and known distribution history for aged inventory; a link to permission evidence.',
       'Measure fresh lead age from the consumer’s inquiry to your delivery. A sample shows the format; the trial shows whether live records consistently match it. Mark unknown history as unknown.',
       'Which fields are consistently present, and which may be missing?')+
      '<div class="rule"></div>'+
      question(4,'How do routing and duplicates work?',
       'What happens between the order and an agent owning the lead?',
       'Delivery and field mapping; volume, pause, and overflow rules; failure alerts; duplicate definition and lookback window; checks against your CRM, including other vendors’ records.',
       'Separate vendor delivery from internal assignment. “No duplicates” needs a scope: this order, the vendor’s inventory, or your existing records. Each delivered lead needs an available owner.',
       'Can we safely verify delivery and its failure alert before the paid trial?')),
 page('Questions 05–06 · Fit and remedies', 'Agree on what “good” means.',
      question(5,'Does this product fit our business?',
       'Who is the product designed for, and what did those people expect?',
       'Insurance interest, geography, language, and available qualifying information; the attracting offer; screening performed; the screening your team is expected to do.',
       'Match the product to your service area, product lines, agent capacity, and actual process. A product another agency works well can still be a poor fit for your team.',
       'What would make my agency a poor fit for this product?')+
      '<div class="rule"></div>'+
      question(6,'What happens when a record is invalid?',
       'Show me the acceptance and remedy policy before I order.',
       'Definitions for invalid contacts, duplicates, wrong geography or product, and missing required data; claim deadlines and evidence; resolution time; replacement, credit, or refund terms and credit expiry.',
       'A disconnected number, a valid person who did not answer, and someone who chose not to buy are different events. Keep record-quality disputes separate from sales outcomes and apply agreed definitions.',
       'Walk me through a claim from submission to resolution.')),
 page('Questions 07–08 · Evidence and ownership', 'Demand a useful denominator.',
      question(7,'Which outcomes can you substantiate?',
       'When you say these leads perform, what result are you counting?',
       'Cohort dates, lead counts, spend, and rate denominators; definitions of contact, appointment, written and placed policy; maturity window; source attribution and the agent process behind the result.',
       'Sales screenshots need context. Some vendors cannot see buyers’ policy outcomes. Evaluate what they can demonstrate, then agree on what you will track in your own trial.',
       'Can we reconcile delivery, CRM, and policy records by source?')+
      '<div class="rule"></div>'+
      question(8,'Who owns a problem?',
       'If delivery stops or records do not match the order, what happens next?',
       'Support channel, responsible owner or team, coverage hours, response expectations, escalation process, and issue tracking; clear responsibility for delivery versus your CRM and routing.',
       'A direct contact and a ticket queue can both work. Judge support by clear ownership, visible progress, and reliable resolution. Confirm the process before an urgent issue arrives.',
       'What information helps you diagnose a failed delivery quickly?')),
 page('Questions 09–10 · Terms and trial', 'Make the commitment measurable.',
      question(9,'What is the full cost—and how do we stop?',
       'Show me the costs and exit conditions for the trial and ongoing orders.',
       'Lead price, setup and platform fees, minimums, billing and renewal rules, notice periods, pauses; handling of prepaid balances and disputes; what you can export and retain when you leave.',
       'Compare the whole commitment. A longer agreement may have a commercial reason; understand the reason and conditions before signing. Know what happens when the trial ends.',
       'What happens if I place no further order after the trial?')+
      '<div class="rule"></div>'+
      question(10,'Can we run a fair, measurable trial?',
       'What evidence will help us continue, adjust, or stop?',
       'Comparable cases or permitted references and how those buyers were selected; budget and volume limits; delivery and review dates, follow-up process, decision criteria, and data owners.',
       'A reference provides context. Your trial establishes fit. Log lead age, agent assignment, response timing, and follow-up. Allow placement results to mature before deciding.',
       'Which result would make each of us recommend stopping?')),
 page('Working page · Evidence', 'Put the answers on one page.',
      '''<div class="cols"><div>'''+write('Vendor / product:')+write('Lead age / sharing / source:')+'''</div><div>'''+write('Reviewer / date:')+write('Insurance interest / geography:')+'''</div></div>
      <div class="box tint"><p class="small"><strong>0</strong> = unclear or unanswered · <strong>1</strong> = stated, awaiting evidence · <strong>2</strong> = documented and checkable.<br>The score tracks evidence completeness. Product fit and trial economics determine the decision.</p></div>
      <table class="check worksheet"><thead><tr><th>Question</th><th style="width:13%">0–2</th><th>Evidence / follow-up needed</th></tr></thead><tbody>'''+
      ''.join(f'<tr><td>{i:02d} · {label}</td><td></td><td></td></tr>' for i,label in enumerate(['Product definition','Request + permission','Records + age','Routing + duplicates','Product fit','Invalids + remedies','Outcome evidence','Support + ownership','Cost + exit terms','Trial plan'],1))+
      '''</tbody></table><h3>Resolve these before the paid trial</h3><p class="small">□ Product, age, sharing, and source are clear.<br>□ Request and permission evidence reviewed; product fits our capacity.<br>□ Costs, invalid criteria, remedies, and exit terms agreed.<br>□ Delivery works; agents own records; measurement is ready.</p>
      <p class="write-label"><strong>Decision:</strong> □ Defined trial &nbsp; □ Clarify first &nbsp; □ Pass</p>'''+write('Unresolved question / next action / owner / due date:')),
 page('Working page · Trial', 'Measure a fair trial.',
      '''<div class="cols"><div>'''+write('Vendor / product / budget:')+write('Delivery dates / outcome review date:')+'''</div><div>'''+write('Volume limit / follow-up owner:')+write('Continue / adjust / stop criteria:')+'''</div></div>
      <p class="small">Track unique leads at each stage; count total policies separately. Define “placed” against your policy records. Compare similar product, age, sharing, capacity, and follow-up conditions.</p>
      <table class="worksheet"><thead><tr><th>Trial measure</th><th style="width:29%">Count / value</th></tr></thead><tbody>
      <tr><td>Vendor spend, including order fees</td><td>$</td></tr><tr><td>Delivered / accepted leads</td><td> / </td></tr><tr><td>Unique leads attempted / reached</td><td> / </td></tr><tr><td>Unique leads booked / attended</td><td> / </td></tr><tr><td>Unique leads with written / placed policy</td><td> / </td></tr><tr><td>Total policies placed</td><td></td></tr><tr><td>Invalids disputed / remedied</td><td> / </td></tr><tr><td>Delivery-to-first-attempt timing</td><td></td></tr><tr><td>Outcomes as of / maturity status</td><td></td></tr></tbody></table>
      <div class="cols"><div><h3>Read the funnel</h3><p class="small"><strong>Reach rate:</strong> unique leads reached ÷ accepted leads.<br><strong>Show rate:</strong> attended ÷ booked.<br><strong>Placement rate:</strong> unique leads with a placed policy ÷ accepted leads.</p></div><div><h3>Read the acquisition cost</h3><p class="small"><strong>Vendor cost per placed policy:</strong> vendor spend ÷ total policies placed.<br>Add labor and platform costs separately when assessing total acquisition economics.</p></div></div>
      <p class="small">For zero denominators, mark “no result yet.” Use “N/A” without appointments. Immature outcomes stay pending.</p>'''+write('First leak / next change / owner:')),
 page('Work with Jeromy', 'Bring the answers. Bring the numbers.',
      cta('Use the checklist to understand the product. Use the trial scorecard to understand your system. I can help you connect the two.')+
      '''<div class="box"><h3>The operator’s perspective</h3><p>My background spans audit at Ernst &amp; Young and Grant Thornton, then a CFO role. As CTO of GOAT Leads and founder of LeadsBakery, I connect acquisition, operations, and the math from a paid record to a placed policy.</p></div>
      <p class="tiny">© 2026 Jeromy Kovatana. Updated October 2026. The evidence score is a discussion tool, not a vendor certification or prediction of results. Review contact permissions and applicable requirements for your own process.</p>''')
]

def render(slug, title, pages):
    sections=[]
    for i,p in enumerate(pages,1):
        tag='h1' if i==1 else 'h2'
        sections.append(f'''<section class="page {p['classes']}" aria-label="Page {i}">
        <header class="masthead"><span class="brand"><img src="assets/jk-mark.png" alt="">Jeromy Kovatana</span><span>{escape(title)}</span></header>
        <div class="page-body"><p class="kicker">{p['kicker']}</p><{tag}>{p['title']}</{tag}>
        {f'<p class="dek">{p["dek"]}</p>' if p['dek'] else ''}{p['body']}</div>
        <footer class="footer"><a href="{SITE}/">jeromykovatana.com</a><span>October 2026 · {i:02d} / {len(pages):02d}</span></footer></section>''')
    output=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="author" content="Jeromy Kovatana"><title>{escape(title)} — Jeromy Kovatana</title><link rel="stylesheet" href="document.css"></head><body><main>{''.join(sections)}</main></body></html>'''
    # Reuse existing site assets when this source lives at resources/documents.
    if (ROOT.parent.parent/'headshot-pro.jpg').is_file():
        output=output.replace('src="assets/', 'src="../../')
    (ROOT/(slug+'.html')).write_text(output)

if __name__ == '__main__':
    render('playbook', '$3M/Month Ad Playbook', playbook)
    render('vendor-vetting-checklist', 'Lead Vendor Vetting Checklist', checklist)
