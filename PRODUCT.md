# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two friends (Saeed and one friend) who play at Sport Aston, Aston University's sports centre in Birmingham. They share one Sport Aston account. Each has their own Hall Pass login. Saeed is the admin. They use it equally on phones and laptops.

## Product Purpose

Hall Pass gets them court time at Sport Aston without having to watch the booking system. It checks availability for basketball and badminton in Sports Hall 1 and 2. Auto-booking rules grab matching sessions as soon as they appear. It can also book a session by hand. Success means a weekend session is held for them and they know it, without anyone staying up for a midnight release.

## Positioning

A private, two-person booking agent on top of Sport Aston's own mobile booking API. It acts on their behalf on a schedule, and shares one Aston account fairly between them.

## Operating Context

- Main jobs, all frequent: see what's booked and what still needs paying, book a slot by hand from live availability, check that rules ran (history), and set up or edit rules.
- Successful bookings are *holds*. Payment happens in Sport Aston itself, never in this app.
- Notifications go to Discord (a webhook per person, plus the admin channel) and Pushover.
- Sessions are hourly, usually on the half hour (e.g. 12:30, 13:30). Prices look like "£30.00". Times are Europe/London.
- A legacy cron CLI (`main.py`) runs separately on the same VM.

## Capabilities and Constraints

- Sports: basketball (Sports Hall 1 `WSCACT0009`, Sports Hall 2 `WSCACT0010`) and badminton (Sports Hall 1 `WSCACT0001`, Sports Hall 2 `WSCACT0004`). Badminton slots are per court.
- Rules: sport, halls, days of the week, a time window, a length of 1–4 consecutive hours, an optional preferred start (strict, or fallback to the nearest time), a check interval, lookahead days, optional max price, and alert toggles. A rule books one block per run and keeps running. Each rule's owner can edit it.
- Fairness between users on a shared account: exact preferred starts beat fallbacks, which beat rules with no preference. Ties go to whoever booked least recently.
- Accounts: the admin's shared Aston account (credentials from the server environment), plus optional private Aston accounts per user, encrypted at rest.
- Admin: invite links (7 days, single use), create users, enable/disable, promote/demote, grant/revoke shared access.
- Stack: FastAPI + SQLite backend (`app/`), React 19 + Vite frontend (`frontend/`), lucide-react icons.

## Brand Commitments

- Name: Hall Pass (renamed from "Basketball Booker", confirmed by the user to be sport-neutral).

## Evidence on Hand

- Real session data comes from the live Sport Aston API. There are no screenshots, logos or brand assets. Any example data in design work is synthetic.

## Product Principles

1. Show the state first: what's held, what's paid for elsewhere, what ran, what failed. Never make them guess whether the robot worked.
2. Fair between friends. Shared-account behaviour should be visible, not hidden.
3. Quick on a phone and dense enough on a laptop.
4. Honest failure. A Sport Aston outage or login failure must read differently from "nothing available".
