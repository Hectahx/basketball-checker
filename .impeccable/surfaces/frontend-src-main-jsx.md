---
version: 1
slug: "frontend-src-main-jsx"
primary_target: "frontend/src/main.jsx"
related_targets: ["frontend/src"]
---

# Hall Pass app shell

Scope: the whole authenticated app (Overview, Book, Rules, History, Account, People) and the sign-in/invite screen. Mode: Operate.

Audience and job: two friends sharing one Sport Aston account, on phone and laptop equally. They come to see what is held and what needs paying, to book a session by hand, to check the rules actually ran, and to set up or edit rules.

Constraints: standard web controls only. Payment stays in Sport Aston. Data is live from the API; any sample data is synthetic.

## Direction contract

THESIS: The app is a multi-sport hall floor. Each sport keeps its painted line colour, and booked time is drawn as a court box. It refuses the grey SaaS card dashboard.

OWN-WORLD: The shell is the deep green painted court surround. The work area is lacquered maple, edged by a white boundary line. Basketball is line orange-red and badminton is line blue, used only to mark sport. Amber means awaiting payment, crimson plus an icon means failure. Barlow carries the UI, and Barlow Condensed carries times and numerals (tabular).

STORY: Open the app and you know within a second whether you have court time and whether the robot worked. Book any free slot in two taps, and edit a rule without starting over.

FIRST VIEWPORT: Desktop has a green rail on the left with the wordmark, navigation and the signed-in person. On maple to the right is "Your court time": upcoming holds as court-box rows with big condensed times, day, hall, length, owner and payment state. Beside it is the rules column with on/off, last run and the result of the last check. On phone there's a green top bar, the holds first, the rules below, and a bottom tab bar. The primary action is Book a session.

FORM: Pick card (my top-ranked grounded candidate: multi-sport hall floor lines), position 1 on the ordered list. seed:9e1b7fda8b8ec4be. Signature move: the Book view's week grid (days by start times), with free cells outlined in the sport's line colour and held time drawn as a solid court box spanning its hours.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
