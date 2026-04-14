# retrocableguide-teletext

A standalone teletext page generator that produces `.tti` files compatible with [vbit2](https://github.com/peterkvt80/vbit2) for output on a Raspberry Pi, and optionally `.t42` files for browser-based viewers. The page layout is modelled on off-air captures of the cable channel guide service from 1999.

It's the sibling of [retrocableguide](https://github.com/alexkinch/retrocableguide) but runs completely independently — it has its own M3U/XMLTV feed config and does not depend on the React app.

## Pages

| Page | Content |
|------|---------|
| 100 | Channel Guide Index (carousel if >30 channels) |
| 101–199 | Today's schedules (channel 1 = page 101, channel 42 = page 142, etc.) |
| 201–299 | Tomorrow's schedules (same mapping) |

Schedule pages use a broadcast-day model: "today" runs 06:00–06:00 (capturing the overnight tail), "tomorrow" runs midnight–midnight. Multi-page schedules carousel with "Earlier/Later programmes follow>>>>" indicators. The date header spans both days when programmes cross midnight (e.g. "Sat 23 Jan - Sun 24 Jan").

Channel numbers are assigned sequentially (1–99) from M3U order after group filtering. Page offsets use BCD encoding so decimal channel numbers map directly to teletext page numbers (e.g. channel 42 → BCD `0x42` → page `0x142` displays as "142").

User navigation: press `1` then channel number for today, `2` then channel number for tomorrow.

## Install

```bash
npm install
```

## Running

```bash
# One-shot generation
node bin/generate.mjs --output-dir ./teletext-pages

# Long-running server (regenerates every 15 minutes)
# Point --output-dir at vbit2's pages directory for live updates
node bin/server.mjs --output-dir /path/to/vbit2/pages --interval 15

# Compile to .t42 for browser viewers (not needed for vbit2)
# Requires TheMarco/teletext at ~/Projects/TheMarco/teletext
node bin/build-t42.mjs --input-dir ./teletext-pages
```

## Config

All settings live in [`src/config.mjs`](./src/config.mjs):

| Key | Default | Description |
|-----|---------|-------------|
| `m3uUrl` / `xmltvUrl` | `"…"` | Feed endpoints |
| `allowedGroups` | `[]` | M3U group filter |
| `serviceName` | `"TV Guide"` | Header text on all pages |
| `indexTitle` | `"THE CHANNEL GUIDE INDEX"` | Double-height title on the index page |
| `todayPageBase` | `0x100` | Today schedule pages start here |
| `tomorrowPageBase` | `0x200` | Tomorrow schedule pages start here |
| `scheduleCarouselSeconds` | `15` | Carousel cycle time for schedule pages |
| `indexCarouselSeconds` | `10` | Carousel cycle time for index pages |
| `autoSlotMap` | `true` | Auto-assign channel numbers 1–99 from M3U order |
| `channelSlotMap` | `{}` | Manual override `{ sourceNum: displayNum }` |

## Layout

```
src/
├── config.mjs         # Teletext configuration
├── generator.mjs      # Orchestrator: fetch feeds, match channels, generate pages
├── index-page.mjs     # Channel Guide Index page generator
├── schedule-page.mjs  # Per-channel schedule page generator
├── page-builder.mjs   # Layout utilities (separators, programme rows, fastext)
└── tti-writer.mjs     # Control codes, OL line builder, page/carousel assembly
bin/
├── generate.mjs       # CLI: one-shot .tti generation
├── server.mjs         # CLI: long-running .tti regeneration server
└── build-t42.mjs      # CLI: compile .tti → .t42 (via TheMarco/teletext)
```

## Notes

- TTI control codes use `\xNN` hex escape notation (compatible with both vbit2 and TheMarco's viewer).
- Double-height rows emit both top and bottom half rows.
- Fastext links: Red = prev channel, Green = next channel, Yellow = index, Cyan = toggle day.
- vbit2 reads `.tti` files directly from a directory; the `.t42` compile step is only needed for browser viewers.
- Channels beyond 99 are not supported (BCD encoding limit).
