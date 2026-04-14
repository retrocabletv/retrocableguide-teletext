import { parseXmltv } from "@iptv/xmltv";
import { parseM3U } from "@iptv/playlist";
import { generateIndexPages } from "./index-page.mjs";
import { generateSchedulePages } from "./schedule-page.mjs";

function parsePlaylistForTeletext(m3uText, config) {
  const parsed = parseM3U(m3uText);
  const entries = [];

  for (const item of parsed.items || parsed.channels || parsed) {
    const extras = item.extras || {};
    const groupTitle = item.groupTitle || extras["group-title"] || "";

    if (config.allowedGroups?.length) {
      if (!config.allowedGroups.includes(groupTitle)) continue;
    }

    let name = item.name || item.title || "";
    if (config.stripNamePrefixes) {
      name = name.replace(/^[A-Z]{2}\s*(?:\||-)\s*/i, "");
    }

    const num =
      Number(extras["channel-number"] || extras["tvg-chno"]) || null;

    entries.push({
      num,
      name,
      xmltvId: extras["tvg-id"] || item.tvgId || "",
    });
  }

  if (config.channelLimit) return entries.slice(0, config.channelLimit);
  return entries;
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function extractText(value) {
  if (!value) return "";
  if (typeof value === "string") return decodeEntities(value);
  if (Array.isArray(value)) return extractText(value[0]);
  if (typeof value === "object") return decodeEntities(String(value._value || value._ || value.value || value.$text || ""));
  return String(value);
}

function parseXmltvForTeletext(xml) {
  const result = parseXmltv(xml);
  const channels = (result.channels || []).map((ch) => ({
    id: ch.id,
    displayNames: (ch.displayNames || ch.displayName || []).map((n) =>
      extractText(n)
    ),
    iconUrl: ch.icon?.src || ch.icon?.[0]?.src || "",
  }));

  const seen = new Set();
  const programmes = (result.programmes || [])
    .map((p) => ({
      channel: p.channel,
      start: new Date(p.start),
      stop: p.stop ? new Date(p.stop) : null,
      title: extractText(p.title),
      subTitle: extractText(p.subTitle),
    }))
    .filter((p) => {
      const key = `${p.channel}|${p.start.getTime()}|${p.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return { channels, programmes };
}

function normaliseName(value) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function extractChannelNumber(value) {
  const match = value?.match(/\b(\d{1,4})\b/);
  return match ? Number(match[1]) : null;
}

function matchChannelsToSchedules(programmes, xmltvChannels, playlistEntries) {
  // Build programme groups by XMLTV channel ID
  const groups = new Map();
  for (const p of programmes) {
    if (!groups.has(p.channel)) {
      groups.set(p.channel, {
        id: p.channel,
        normalisedNames: new Set(),
        channelNumbers: new Set(),
        programmes: [],
      });
    }
    const g = groups.get(p.channel);
    g.programmes.push(p);
    const num = extractChannelNumber(p.channel);
    if (num !== null) g.channelNumbers.add(num);
  }

  for (const ch of xmltvChannels) {
    const g = groups.get(ch.id);
    if (g) {
      for (const dn of ch.displayNames) {
        g.normalisedNames.add(normaliseName(dn));
        const num = extractChannelNumber(dn);
        if (num !== null) g.channelNumbers.add(num);
      }
    }
  }

  for (const g of groups.values()) {
    g.programmes.sort((a, b) => a.start - b.start);
  }

  const groupList = Array.from(groups.values());

  return playlistEntries.map((channel) => {
    let bestGroup = null;
    let bestScore = 0;

    for (const g of groupList) {
      let score = 0;
      if (channel.xmltvId && g.id === channel.xmltvId) score += 100;
      if (channel.num && g.channelNumbers.has(channel.num)) score += 60;
      const nn = normaliseName(channel.name);
      if (nn && g.normalisedNames.has(nn)) score += 80;
      if (score > bestScore) { bestScore = score; bestGroup = g; }
    }

    const progs = bestScore > 0 && bestGroup ? bestGroup.programmes : [];
    return {
      num: channel.num,
      name: channel.name,
      programmes: progs.map((p) => ({
        start: p.start,
        stop: p.stop,
        title: p.subTitle ? `${p.title}: ${p.subTitle}` : p.title,
      })),
    };
  });
}

// Convert a decimal channel number to BCD for teletext page addressing.
// Channel 1 → 0x01, channel 10 → 0x10, channel 42 → 0x42.
function toBCD(n) {
  return ((Math.floor(n / 10) << 4) + (n % 10));
}

// Returns Map of sourceNum -> { slot (BCD page offset), displayNum (1-99) }
function buildSlotMap(channelData, config) {
  const map = new Map();
  if (!config.autoSlotMap && Object.keys(config.channelSlotMap).length > 0) {
    for (const [sourceNum, displayNum] of Object.entries(config.channelSlotMap)) {
      map.set(Number(sourceNum), { slot: toBCD(displayNum), displayNum });
    }
    return map;
  }
  // Use the channel's actual M3U number as the display number so that
  // channel 39 maps to page 139, not a sequential slot.
  for (const ch of channelData) {
    const displayNum = ch.num;
    if (displayNum !== null && displayNum >= 1 && displayNum <= 99) {
      map.set(ch.num, { slot: toBCD(displayNum), displayNum });
    }
  }
  return map;
}

// Filter programmes for a broadcast day.
// For "today" pages, startHour=6 captures the overnight tail from the previous
// evening (06:00 today → 06:00 tomorrow), matching UK broadcast convention.
// For "tomorrow" pages, startHour=0 shows the full day from midnight.
// Returns { programmes, spansNextDay } where spansNextDay is true if any
// programme starts after midnight (i.e. the schedule crosses into the next
// calendar day).
function filterProgrammesByDay(programmes, date, startHour = 0) {
  const dayStart = new Date(date);
  dayStart.setHours(startHour, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(startHour, 0, 0, 0);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  midnight.setDate(midnight.getDate() + 1);

  const filtered = programmes
    .filter((p) => {
      const starts = p.start;
      const stops = p.stop || new Date(starts.getTime() + 30 * 60000);
      return starts < dayEnd && stops > dayStart;
    })
    .sort((a, b) => a.start - b.start);

  const spansNextDay = filtered.some((p) => p.start >= midnight);

  return { programmes: filtered, spansNextDay };
}

export async function generateTeletext(config) {
  const [m3uResponse, xmltvResponse] = await Promise.all([
    fetch(config.m3uUrl),
    fetch(config.xmltvUrl),
  ]);

  if (!m3uResponse.ok) throw new Error(`M3U fetch failed: ${m3uResponse.status}`);
  if (!xmltvResponse.ok) throw new Error(`XMLTV fetch failed: ${xmltvResponse.status}`);

  const [m3uText, xml] = await Promise.all([m3uResponse.text(), xmltvResponse.text()]);

  const playlistEntries = parsePlaylistForTeletext(m3uText, config);
  const { channels: xmltvChannels, programmes } = parseXmltvForTeletext(xml);
  const channelData = matchChannelsToSchedules(programmes, xmltvChannels, playlistEntries);
  const slotMap = buildSlotMap(channelData, config);

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const pages = {};

  // Build channel list with slot assignments
  const channelsWithSlots = channelData
    .filter((ch) => slotMap.has(ch.num))
    .map((ch) => {
      const { slot, displayNum } = slotMap.get(ch.num);
      return { ...ch, slot, displayNum };
    })
    .sort((a, b) => a.slot - b.slot);

  // Generate index page(s)
  pages["P100.tti"] = generateIndexPages(channelsWithSlots, config);

  // Generate schedule pages for each channel
  for (const ch of channelsWithSlots) {
    const todayPage = config.todayPageBase + ch.slot;
    const tomorrowPage = config.tomorrowPageBase + ch.slot;
    const todayMag = (todayPage >> 8) & 0x7;
    const todayPg = todayPage & 0xff;
    const tomorrowMag = (tomorrowPage >> 8) & 0x7;
    const tomorrowPg = tomorrowPage & 0xff;

    const todayResult = filterProgrammesByDay(ch.programmes, today, 6);
    const tomorrowResult = filterProgrammesByDay(ch.programmes, tomorrow, 0);

    // Find prev/next channel pages for fastext navigation
    const chIndex = channelsWithSlots.indexOf(ch);
    const prevSlot = chIndex > 0 ? channelsWithSlots[chIndex - 1].slot : null;
    const nextSlot = chIndex < channelsWithSlots.length - 1 ? channelsWithSlots[chIndex + 1].slot : null;

    const prevTodayPage = prevSlot !== null ? config.todayPageBase + prevSlot : null;
    const nextTodayPage = nextSlot !== null ? config.todayPageBase + nextSlot : null;
    const prevTomorrowPage = prevSlot !== null ? config.tomorrowPageBase + prevSlot : null;
    const nextTomorrowPage = nextSlot !== null ? config.tomorrowPageBase + nextSlot : null;

    // Today's schedule
    pages[`P${todayPage.toString(16).toUpperCase()}.tti`] = generateSchedulePages({
      serviceName: config.serviceName,
      channelName: ch.name,
      channelNumber: ch.displayNum,
      programmes: todayResult.programmes,
      date: today,
      spansNextDay: todayResult.spansNextDay,
      dateLabel: "TODAY",
      magazine: todayMag,
      page: todayPg,
      cycleSeconds: config.scheduleCarouselSeconds,
      prevPage: prevTodayPage,
      nextPage: nextTodayPage,
      otherDayPage: tomorrowPage,
      indexPage: config.indexPage,
    });

    // Tomorrow's schedule
    pages[`P${tomorrowPage.toString(16).toUpperCase()}.tti`] = generateSchedulePages({
      serviceName: config.serviceName,
      channelName: ch.name,
      channelNumber: ch.displayNum,
      programmes: tomorrowResult.programmes,
      date: tomorrow,
      spansNextDay: tomorrowResult.spansNextDay,
      dateLabel: "TOMORROW",
      magazine: tomorrowMag,
      page: tomorrowPg,
      cycleSeconds: config.scheduleCarouselSeconds,
      prevPage: prevTomorrowPage,
      nextPage: nextTomorrowPage,
      otherDayPage: todayPage,
      indexPage: config.indexPage,
    });
  }

  return pages;
}
