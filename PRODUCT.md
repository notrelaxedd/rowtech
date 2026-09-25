# Product

## Register

brand

## Platform

web

## Users

Primary: rowing coaches and the people who run programs (the site names high school, college and club coaches) deciding whether force data from every seat would change how they coach and pick crews. They arrive from a shared link, often on a phone at the boathouse, and they are sceptical of gadgets that promise numbers they can't trust.

Secondary: individual athletes, mostly scullers and small-boat rowers, who want to see their own stroke. The site has no section for them today; the beta form lets an applicant say they are an athlete. (Founder intention, not yet on the site.)

## Product Purpose

Force, the seat node, reads a 50 kg load cell in series on each seat's rigger backstay. It records the force curve of every stroke, shows the rower their own peak and curve live on its 3.5″ screen, saves each session to microSD, and runs its own Wi-Fi network: a phone or laptop joins it and downloads the session files in a browser, and the seat number is set on the node's own web page. Vieve, the RowTech cox box, is in development: the cox's voice to the boat's speakers, and the hub that puts every seat on one clock. The team dashboard (`/app`) takes a node's session files, or several seats as one outing in a zip, for going through stroke by stroke. The site exists to recruit beta testers: success is qualified applications from coaches, programs and athletes, stored in the Supabase `beta_signups` table.

## Positioning

Force from every seat in the boat, measured on the water, stroke by stroke.

The home page headline is "The force curve from every seat in the boat." (awaiting the founders' confirmation).

## Conversion & proof

- Primary CTA: "Apply for the beta", the orange button, which goes to the `/beta` form ("Apply for the beta."). Secondary: the product pages, `/force` and `/vieve` ("See Force", "See Force and its specifications", "See Vieve and its specifications").
- The line a visitor remembers after 10 seconds: every seat, every stroke, measured.
- Belief ladder: the node measures something real (a force curve per stroke, not a guess); it is practical in a real boathouse (its own network, no app, survives the dock power-off); the crew view is where it is heading and beta crews shape it; applying costs nothing and commits to nothing. (Founder intentions in part: the site doesn't mention the dock power-off or that beta crews shape the crew view. Applying costs nothing; beta crews who take part buy testing units at the cost of their materials, per the home page and `/terms`.)
- Proof on hand: no testimonials, press or logos yet. Force and Vieve are drawn on the site as vector concept renders, after "Vieve V1 + Force, concept A" (2026-09-22), in the site's own colours: they are the design, not photographs of finished hardware, and dimensions and parts are proposed. The numbers on every screen are computed from the same stroke model the rest of the page uses, not typed in. The home page lists what beta crews get: testing units at the cost of their materials, a direct line to the people building it, keeping units or sending them back for a discount on the finished product, and a replacement if a unit fails; the beta's terms are on `/terms`. After applying, the form says we read every application, reply personally within 24 to 48 hours, and get in touch by email.

## Brand Personality

A precise instrument: engineered, calm, exact. The voice is a coach who is also an engineer, plain about what is measured and what is not, never hyped. The device's own look (black ground, trace cyan, REC green, warning amber) carries the brand.

## Anti-references

None given.

## Design Principles

- Show the instrument. The real screens and real curves are the imagery; decoration comes second.
- Claim only what is measured. Timing works today and needs no calibration; force needs calibrating against known weights, no node has been calibrated yet, and until then force reads in raw sensor units. Watts are not shown until the rigger geometry is characterised. Say so plainly.
- Coaches first. Lead with the crew and the boat; the single athlete is a second door, not the front one (the second door isn't built yet).
- A light ask. The beta form is short (name, email and program are required; the rest is optional), promises nothing it can't keep, and says what happens next.

## Accessibility & Inclusion

No specific requirements given.
