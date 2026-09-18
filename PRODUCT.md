# CartRune

## Product truth

CartRune is a mobile-first collection for physical video games. It helps a collector identify a boxed game, confirm the exact release, save it to a personal shelf, track play progress, and eventually share reviews and activity with other collectors.

## Primary user scene

A person is standing in front of a shelf or holding a game case. They want to know whether the game is already catalogued, choose the correct platform/region/edition, and add it to their collection in a few seconds. Later they return to update status, hours, progress, and rating.

## Product hierarchy

1. Scan or search for a game.
2. Confirm the exact physical release.
3. Add it to the user's shelf.
4. Track playing, backlog, and completed status.
5. Review and share activity.

## MVP success

The core loop succeeds when a user can scan a real cover, receive up to three useful candidates, select the correct release, add it to a library, and see it reflected in the collection without losing context.

## Surface modes

- Home: Operate — resume the collection and start the next action.
- Library: Operate — scan, filter, and browse owned games.
- Scanner: Experience/Operate — fast camera interaction with clear fallback paths.
- Discover: Read/Operate — search and compare catalog entries.
- Profile and Feed: Read/Operate — personal identity and community activity.

## Design commitment

CartRune uses the Mobbin profile from the merged project design skill: gallery-white surfaces, near-black ink, neutral tint hierarchy, calm 24px cards, pill controls, and game artwork as the source of color. It is not a dark gaming dashboard. Blue is reserved for high-value scan/search actions and match confidence.

## Non-goals for the first release

- A full social network before the scan-to-shelf loop is reliable.
- Server-side LLM or GPU inference.
- Microservices, Kafka, or premature offline vector search.
