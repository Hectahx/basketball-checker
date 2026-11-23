---
name: Hall Pass
description: A private two-person booking agent for Sport Aston, drawn as a multi-sport hall floor.
colors:
  surround: "oklch(0.37 0.065 163)"
  surround-deep: "oklch(0.31 0.06 163)"
  surround-hover: "oklch(0.43 0.07 163)"
  surround-ink: "oklch(0.97 0.012 160)"
  surround-muted: "oklch(0.82 0.035 160)"
  primary: "oklch(0.37 0.065 163)"
  primary-hover: "oklch(0.31 0.06 163)"
  primary-ink: "oklch(0.97 0.012 160)"
  floor: "oklch(0.82 0.085 74)"
  floor-raised: "oklch(0.865 0.07 77)"
  floor-sunk: "oklch(0.775 0.09 72)"
  ink: "oklch(0.23 0.03 60)"
  ink-muted: "oklch(0.39 0.045 62)"
  rule: "oklch(0.64 0.07 70)"
  rule-soft: "oklch(0.73 0.075 72)"
  boundary: "oklch(0.985 0.008 90)"
  basketball: "oklch(0.56 0.17 38)"
  badminton: "oklch(0.48 0.15 258)"
  on-line: "oklch(0.99 0.005 90)"
  ok: "oklch(0.45 0.11 155)"
  ok-soft: "oklch(0.90 0.05 155)"
  pay: "oklch(0.45 0.1 68)"
  pay-soft: "oklch(0.91 0.1 92)"
  danger: "oklch(0.5 0.19 25)"
  danger-soft: "oklch(0.93 0.045 25)"
  focus: "oklch(0.48 0.15 258)"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  wordmark:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  meta:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
  numeral:
    fontFamily: "Barlow Condensed, Barlow, ui-sans-serif, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.1
    fontFeature: "tnum"
rounded:
  none: "0"
  chip: "3px"
  control: "4px"
  pill: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  2xl: "1.75rem"
  3xl: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.45rem 0.95rem"
    height: "2.5rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-ink}"
  button-secondary:
    backgroundColor: "{colors.floor-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.45rem 0.95rem"
    height: "2.5rem"
  button-danger-quiet:
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    padding: "0.45rem 0.95rem"
    height: "2.5rem"
  button-danger-quiet-armed:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
  input:
    backgroundColor: "{colors.floor-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.45rem 0.7rem"
    height: "2.5rem"
  segment:
    backgroundColor: "{colors.floor-raised}"
    textColor: "{colors.ink}"
    padding: "0.4rem 0.85rem"
    height: "2.5rem"
  segment-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
  segment-sport-selected-basketball:
    backgroundColor: "{colors.basketball}"
    textColor: "{colors.on-line}"
  segment-sport-selected-badminton:
    backgroundColor: "{colors.badminton}"
    textColor: "{colors.on-line}"
  chip-neutral:
    backgroundColor: "{colors.floor-sunk}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.meta}"
    rounded: "{rounded.chip}"
    padding: "0.12rem 0.5rem"
  chip-pay:
    backgroundColor: "{colors.pay-soft}"
    textColor: "{colors.pay}"
    rounded: "{rounded.chip}"
  chip-ok:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok}"
    rounded: "{rounded.chip}"
  chip-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    rounded: "{rounded.chip}"
  court-box:
    backgroundColor: "{colors.floor-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.9rem 1.15rem"
  court-cell-free:
    textColor: "{colors.ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.none}"
    height: "2.75rem"
  court-cell-mine-basketball:
    backgroundColor: "{colors.basketball}"
    textColor: "{colors.on-line}"
    rounded: "{rounded.none}"
  court-cell-mine-badminton:
    backgroundColor: "{colors.badminton}"
    textColor: "{colors.on-line}"
    rounded: "{rounded.none}"
  court-cell-theirs:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.none}"
  rule-row:
    backgroundColor: "{colors.floor-raised}"
    rounded: "{rounded.none}"
    padding: "1rem 1.15rem"
  nav-item:
    textColor: "{colors.surround-muted}"
    rounded: "{rounded.control}"
    padding: "0.65rem 0.75rem"
  nav-item-hover:
    backgroundColor: "{colors.surround-hover}"
    textColor: "{colors.surround-ink}"
  nav-item-active:
    textColor: "{colors.surround-ink}"
  switch-track:
    backgroundColor: "{colors.rule}"
    rounded: "{rounded.pill}"
    width: "2.5rem"
    height: "1.45rem"
  switch-track-on:
    backgroundColor: "{colors.primary}"
---

# Design System: Hall Pass

## Overview

**Creative North Star: "The Multi-Sport Hall Floor"**

Hall Pass is drawn as the floor of a shared sports hall. The app shell is the deep green painted surround outside the playing area. The work area is lacquered maple, edged by a white boundary line. Each sport keeps its own painted line colour, and booked time is drawn as a court box: a rectangle outlined in that sport's line. You should be able to read whether you have court time, and whether the robot worked, from the floor markings alone.

It is dense and direct. Regions sit on the maple and are separated by painted white lines, never boxed in floating cards. Times are set large in a condensed sports face with tabular figures, like a scoreboard. Colour is functional: green is the building, maple is where you work, orange-red and blue mark sport, amber means "pay for this in Sport Aston", and crimson with an icon means something failed. The system rejects the grey SaaS card dashboard.

Light and dark schemes follow `prefers-color-scheme`. In dark, the surround deepens, the maple becomes a dark stained floor, and the sport lines and status colours lift in lightness so they still read as paint.

**Key Characteristics:**
- Green surround shell, maple work surface, 2px white boundary line between them.
- Sport is shown by line colour, never by fill alone (except your own booked cells).
- Square court geometry for anything that represents court time; 4px corners only on controls.
- Barlow for the interface, Barlow Condensed with tabular figures for times and numerals.
- Flat: depth comes from tonal floor layers and painted lines, not shadows.

## Colors

A painted-hall palette: one deep green, one warm maple family, two sport line colours, and three status colours. Every value is OKLCH, as defined in `frontend/src/styles.css`; the dark-scheme counterparts live in that file's `prefers-color-scheme: dark` block and in the sidecar.

### Primary
- **Court Surround Green** (`surround`, also `primary` in light): the shell background (rail, mobile top bar, bottom tab bar) and the one action colour on the maple: primary buttons, the selected non-sport segment, a switch that is on. In dark, `primary` separates from the surround and becomes a light mint so actions stay visible against the dark floor.
- **Deep Surround** (`surround-deep` / `primary-hover`): pressed and hover state of primary actions.
- **Lit Surround** (`surround-hover`): hover fill for rail items and the rail's icon buttons.

### Secondary (sport lines)
- **Basketball Line Orange-Red** (`basketball`): outlines basketball court boxes, rule rows, editors, slot cells and the short sport-tag line; fills your own booked basketball cells and the selected Basketball segment.
- **Badminton Line Blue** (`badminton`): the same roles for badminton.
- **Line Ink** (`on-line`): text on a solid sport-line fill.

### Tertiary (status)
- **Payment Amber** (`pay` on `pay-soft`): awaiting payment in Sport Aston. Used for "Pay in Sport Aston" chips and warning notices only.
- **Success Green** (`ok` on `ok-soft`): booked, checked, saved.
- **Failure Crimson** (`danger` on `danger-soft`): failed checks, failed bookings, errors, armed destructive buttons.
- **Focus Blue** (`focus`): the 3px focus ring. It currently has the same value as the badminton line in light; it is a focus signal, never a sport signal.

### Neutral
- **Lacquered Maple** (`floor`): the main work surface inside the boundary.
- **Raised Maple** (`floor-raised`): court boxes, rule rows, inputs, segments, secondary buttons, slot detail.
- **Sunk Maple** (`floor-sunk`): neutral chips, read-only inputs, loading skeletons.
- **Floor Ink** (`ink`) and **Worn Ink** (`ink-muted`): body text and secondary text (descriptions, meta, table headers).
- **Floor Rule** (`rule`) and **Soft Rule** (`rule-soft`): control borders, the off switch track, dashed and dotted markings, list dividers.
- **Boundary White** (`boundary`): the 2px boundary around the court, the dividers between regions, the active rail item outline, the avatar box, the switch thumb.
- **Surround Ink** (`surround-ink`) and **Surround Muted** (`surround-muted`): text and icons on the green shell.

### Named Rules
**The Painted Line Rule.** Basketball orange-red and badminton blue mark sport and nothing else. They appear as outlines, the sport-tag line, the sport choice segment, and the fill of your own booked cells. Never use them for buttons, headings, links or status.

**The Two Signals Rule.** Amber always means "awaiting payment in Sport Aston". Crimson always means failure and always comes with an icon (circle-x in chips and notices). A Sport Aston outage must read as crimson failure, never as an empty, neutral "nothing available".

**The Surround Rule.** Green is the building, not decoration. On the maple it appears only as the primary action, a selected non-sport choice, or a switch that is on.

## Typography

**Display Font:** Barlow Condensed (with Barlow, ui-sans-serif)
**Body Font:** Barlow (with ui-sans-serif, system-ui)

**Character:** A sports-hall signage pairing. Barlow's rounded grotesque shapes carry the interface plainly; its condensed cut works like a scoreboard for times, dates and numerals. Both are self-hosted (`frontend/src/fonts.css`): Barlow 400/500/600/700 and Barlow Condensed 500/600/700.

### Hierarchy
- **Display** (Barlow Condensed 700, 2.5rem, line-height 1, tabular): the start time in a court box. Drops to 2rem on phones.
- **Wordmark** (Barlow Condensed 700, 1.625rem, line-height 1): "Hall Pass" beside the court-diagram mark. 1.375rem in the mobile top bar.
- **Headline** (Barlow 700, 1.875rem, line-height 1.15, -0.01em): page titles. 1.5rem on phones and in the sign-in card.
- **Title** (Barlow 700, 1.125rem, line-height 1.15): region headings. Day headings and h3 use 1rem.
- **Body** (Barlow 400, 1rem, line-height 1.45): running text, descriptions capped around 65ch.
- **Label** (Barlow 600, 0.875rem): field labels, legends, nav items, buttons (buttons inherit 1rem size at 600).
- **Meta** (Barlow 500, 0.875rem): chips, sport tags, owner names, table headers, legends. Hints and error text step down to 0.8125rem.
- **Numeral** (Barlow Condensed 600, 0.9375rem, line-height 1.1, tabular): week-grid cells and column headers; the phone time chips use 1.125rem at 700.

### Named Rules
**The Scoreboard Rule.** Times, dates in the grid and other numerals are set in Barlow Condensed with tabular figures. Prose and controls stay in Barlow. Time and number inputs and numeric table cells also use tabular figures.

**The Sentence Case Rule.** Labels, headings, buttons and chips are sentence case at normal tracking. The system has no uppercase or letter-spaced label style.

## Layout

The desktop shell is a two-column grid: a 15rem sticky green rail (wordmark, navigation, signed-in person with sign-out) and the maple court, inset 0.75rem from the top, right and bottom and edged by a 2px boundary line. The court pads `2rem clamp(1.25rem, 3vw, 2.75rem) 3rem`.

Each page opens with a page header: title and one-line state description on the left, actions on the right (secondary before primary). Below it, regions are separated by 2px boundary lines with generous padding (1.75rem to 2.5rem). The Overview is a two-column grid (about 1.65fr held sessions to 1fr rules and attempts), the side column ruled off by a vertical boundary line. Settings use two equal columns divided the same way.

Spacing follows a rem rhythm of 0.25 / 0.5 / 0.75 / 1 / 1.25 / 1.75 / 2.5. Lists stack court boxes and rule rows at 0.75rem; inside rows, gaps run 0.5rem to 1.25rem. Controls are 2.5rem tall.

Responsive behaviour:
- At 1100px the Overview collapses to one column; the side column moves below, divided by a horizontal boundary line.
- At 900px settings and form grids go to one column.
- At 760px the rail becomes a fixed bottom tab bar on the green surround (short labels, safe-area padding), a green top bar carries the wordmark and avatar, and the court runs edge to edge with only a top boundary line. Page actions stretch to full width; court boxes move their status to a row beneath; the Book week grid becomes per-day lists of time chips.

## Elevation & Depth

The system is flat. Depth is tonal and painted: the green surround sits behind the maple court, and on the maple three floor tones (sunk, floor, raised) separate surfaces. Lines do the rest: the 2px boundary, 2px sport outlines, 1.5px control borders and 1px soft dividers. Inside the rule editor, inputs drop to the base floor tone so they sit into the raised panel.

### Shadow Vocabulary
- **Sign-in lift** (`box-shadow: 0 18px 40px -18px oklch(0.15 0.04 160 / 0.6)`): only the sign-in card floating over the surround.
- **Tab bar lift** (`box-shadow: 0 -6px 18px -10px oklch(0.15 0.04 160 / 0.5)`): only the mobile bottom tab bar over scrolling content.
- **Thumb** (`box-shadow: 0 1px 2px oklch(0 0 0 / 0.25)`): the switch thumb.

### Named Rules
**The Painted Floor Rule.** No surface on the maple casts a shadow; the switch thumb's 1px contact shadow is the only one. To separate a surface, change its floor tone or draw a line. Inset box-shadows are used only to paint lines (the active rail item, the selected court cell).

## Shapes

Anything that represents court or court time is square: court boxes, rule rows, the rule editor, slot detail panels, grid cells, legend swatches, the avatar, region dividers. Controls get gently squared-off corners (4px): buttons, inputs, selects, segmented groups, rail items, notices. Chips use 3px. Only the switch is fully round.

Line style carries meaning:
- **Solid sport line**: in play, bookable, or held.
- **Dashed line**: marked out, not in play (a paused rule, a slot held by someone else, an empty state).
- **Dotted soft line**: no session exists in this grid cell.
- **Doubled line** (inset 3px floor gap, then a 2px sport line): the selected cell, like the key inside a court.

The brand mark is a court diagram: boundary rectangle, halfway line and centre circle in 2.5px strokes. The sign-in screen paints the same half-court markings faintly (14% boundary white) on the surround.

### Named Rules
**The Court Line Rule.** Court time is a square box with a 2px line. Never round a court box or cell, and never give it a fill-plus-shadow card treatment.

## Components

### Buttons
Plain, firm and quick, with no gloss.
- **Shape:** 4px corners, 2.5rem minimum height, 1.5px border, Barlow 600, icon (16px lucide) before the label with a 0.45rem gap.
- **Primary:** surround green with surround ink. One per view, for the main job (Book a session, Save rule, Sign in).
- **Secondary:** raised maple with a floor-rule border; border darkens to worn ink on hover.
- **Danger quiet:** transparent with a soft rule border and crimson text. It arms on first click (crimson border, crimson-soft fill, "Click again to confirm") and confirms on the second, instead of a modal.
- **Text button:** inline underlined text in ink, rule-coloured underline that turns to the text colour on hover.
- **Hover / Focus / Active:** 160ms colour transitions on the ease-out curve; 1px press-down on active; 3px focus ring offset 2px. Disabled drops to 55% opacity.
- In tables, buttons compact to 2.15rem.

### Chips
- **Style:** 3px corners, 1px border, meta type, a 14px status icon before the label.
- **Tones:** neutral (sunk maple, worn ink), ok (success green), pay (amber), danger (crimson). Each tinted tone uses its soft background and a border mixed from the strong colour.

### Court Box (signature)
The held-session row. Square, 2px border in the sport's line colour, raised maple. Three columns: the big condensed start time with "to HH:MM" beneath; day, hall and a meta line (sport tag, length, price per hour, rule or "Booked by hand"); and the status chip with the owner ("for jordan") when it belongs to the other person. On phones the status drops into a full-width row.

### Week Grid (signature)
The Book view's days-by-start-times table with 4px gaps between square cells. Free cells are outlined in the sport line and show which halls are free (H1, H2); hover tints them 14% with the sport colour. Your held time is a solid sport-line fill spanning its hours ("Yours · 2h"). Time held by someone else is a dashed rule outline with their name in worn ink. Cells with no session are dotted. The selected cell takes the doubled line and opens a slot-detail panel (raised maple, sport-line border) in the row beneath, listing each hall with its price and a Book button. A legend repeats the four marks.

### Rule Row
Square, raised maple, 2px sport-line border, with the on/off switch on the left, the rule name, sport tag, schedule summary and health (a checked or failed chip, with the error text in crimson) in the middle, and actions on the right. A paused rule switches to a dashed rule-coloured border on a transparent floor. The rule editor uses the same frame with 1.5rem padding, a two-column form grid and a "More settings" disclosure.

### Inputs / Fields
- **Style:** 2.5rem tall, 1.5px floor-rule border, 4px corners, raised maple fill; read-only fields use sunk maple. Label above in label type, hint below in worn ink at 0.8125rem.
- **Hover / Focus:** border darkens to worn ink; focus shows the 3px focus ring.
- **Segmented choices:** joined native radios or checkboxes with shared 1.5px borders and 4px outer corners. Selected fills surround green; the sport choice fills with the chosen sport's line colour instead.
- **Switch:** 2.5rem by 1.45rem round track, floor-rule when off and surround green when on, boundary-white thumb sliding on the ease-out curve in 180ms.

### Navigation
- **Desktop rail:** items in Barlow 600 with 19px icons, surround-muted at rest, lit-surround fill on hover, and the current page outlined by a 2px inset boundary-white line, like a marked court. The signed-in person sits at the bottom in a square boundary-outlined avatar.
- **Mobile:** a fixed bottom tab bar on the surround with stacked icon and short label at 0.75rem, and a green top bar with the wordmark and avatar.

### Notices and Empty States
Notices are inline lines, not toasts: 4px corners, 1.5px tinted border on the tone's soft fill, an 18px icon in the tone colour, body text in ink and an optional Dismiss text button. They slide in 4px over 220ms. Errors are announced as alerts. Empty states are a 2px dashed rule box with a title, a short explanation and actions.

## Do's and Don'ts

### Do:
- **Do** separate regions on the maple with 2px boundary-white lines and padding, not cards.
- **Do** outline anything that represents court time in its sport's line colour at 2px, square.
- **Do** set times and numerals in Barlow Condensed with tabular figures.
- **Do** pair every status colour with an icon, and keep amber for "pay in Sport Aston" and crimson for failure.
- **Do** use dashed lines for "not in play" (paused, held by someone else) and dotted lines for "no session".
- **Do** keep one primary action per view, in surround green.
- **Do** confirm destructive actions with the two-click armed button rather than a modal.
- **Do** keep motion short on the ease-out curve (160 to 220ms) and honour reduced motion.

### Don't:
- **Don't** build grey SaaS card dashboards: no floating white cards, no drop shadows on maple surfaces.
- **Don't** use the basketball or badminton line colours for anything except marking sport.
- **Don't** show a Sport Aston outage or login failure as an empty, neutral state.
- **Don't** round court boxes, grid cells or rule rows.
- **Don't** add uppercase, letter-spaced labels above headings.
