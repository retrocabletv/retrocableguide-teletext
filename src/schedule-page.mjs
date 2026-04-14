import { CC, cc, buildCarousel, buildPage } from "./tti-writer.mjs";
import {
  mosaicSeparator,
  doubleHeightRows,
  headerRow,
  programmeRow,
  blueBgRow,
  truncate,
  formatTime24,
  formatDateShort,
} from "./page-builder.mjs";

// Layout matching the TV Today reference captures:
// Row 0:    header (service name + page number)
// Row 1:    mosaic separator (yellow separated blocks on blue)
// Row 2-3:  channel name double-height (yellow on blue, uppercase)
// Row 4:    mosaic separator
// Row 5:    Ch:XX  Tue 31 Mar  (yellow on blue)
// Row 6:    blank (blue bg)
// Rows 7-20: programme listings with wrapping (14 rows available)
// Row 21:   blank (blue bg)
// Row 22:   mosaic separator
// Row 23:   "Earlier/Later programmes follow>>>>" or blank (yellow on blue)

const FIRST_ROW = 7;
const LAST_ROW = 20;
const ROWS_AVAILABLE = LAST_ROW - FIRST_ROW + 1; // 14

// Max title length per row: 40 - 3 cc - 1 space - 5 time - 1 cc - 1 margin = 29
const MAX_TITLE = 29;
// Continuation indent: align under title start (space + 5 time + 1 space = 7)
const CONT_INDENT = 7;
// Max continuation title: 40 - 3 cc - 7 indent - 1 margin = 29
const MAX_CONT_TITLE = 29;

// Build display rows for a single programme, with wrapping if needed.
// Returns an array of 1 or 2 row objects.
function buildProgrammeRows(startRow, time, title) {
  if (title.length <= MAX_TITLE) {
    return [programmeRow(startRow, time, title)];
  }

  // Wrap: first line gets truncated at a word boundary, second line is continuation
  let breakAt = MAX_TITLE;
  // Try to break at a space
  const lastSpace = title.lastIndexOf(" ", MAX_TITLE);
  if (lastSpace > MAX_TITLE / 2) {
    breakAt = lastSpace;
  }

  const firstPart = title.slice(0, breakAt).trimEnd();
  const secondPart = title.slice(breakAt).trimStart();

  const rows = [programmeRow(startRow, time, firstPart)];

  if (secondPart.length > 0) {
    rows.push(
      blueBgRow(startRow + 1, " ".repeat(CONT_INDENT) + truncate(secondPart, MAX_CONT_TITLE), CC.WHITE)
    );
  }

  return rows;
}

// Pre-calculate how many display rows each programme needs
function programmeRowCount(title) {
  return title.length > MAX_TITLE ? 2 : 1;
}

// Paginate programmes into subpages, respecting wrapping row counts
function paginateProgrammes(programmes) {
  if (programmes.length === 0) return [[]];

  const pages = [];
  let currentPage = [];
  let rowsUsed = 0;

  for (const prog of programmes) {
    const needed = programmeRowCount(prog.title);
    if (rowsUsed + needed > ROWS_AVAILABLE && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      rowsUsed = 0;
    }
    currentPage.push(prog);
    rowsUsed += needed;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function buildScheduleSubpage({
  serviceName,
  channelName,
  channelNumber,
  pageNumber,
  programmes,
  dateStr,
  paginationHint,
}) {
  const rows = [];

  // Row 0: service name + page number
  rows.push(headerRow(serviceName, pageNumber));

  // Row 1: mosaic separator
  rows.push(mosaicSeparator(1));

  // Row 2-3: channel name double-height (uppercase, yellow on blue)
  rows.push(...doubleHeightRows(2, channelName.toUpperCase(), CC.YELLOW, CC.BLUE));

  // Row 4: mosaic separator
  rows.push(mosaicSeparator(4));

  // Row 5: Ch:XX  Date (yellow on blue)
  const chStr = channelNumber !== null ? `Ch:${channelNumber}` : "";
  rows.push(blueBgRow(5, " " + chStr + " " + dateStr, CC.YELLOW));

  // Row 6: blank with blue background
  rows.push(blueBgRow(6, "", CC.YELLOW));

  // Rows 7-20: programme listings with wrapping
  let currentRow = FIRST_ROW;
  if (programmes.length === 0) {
    rows.push(blueBgRow(currentRow, " No information available", CC.WHITE));
    currentRow++;
  } else {
    for (const prog of programmes) {
      const progRows = buildProgrammeRows(currentRow, formatTime24(prog.start), prog.title);
      rows.push(...progRows);
      currentRow += progRows.length;
    }
  }

  // Fill remaining rows 7-20 with blue background
  for (let r = currentRow; r <= LAST_ROW; r++) {
    rows.push(blueBgRow(r, "", CC.YELLOW));
  }

  // Row 21: blank with blue background
  rows.push(blueBgRow(21, "", CC.YELLOW));

  // Row 22: mosaic separator
  rows.push(mosaicSeparator(22));

  // Row 23: pagination hint (Earlier/Later) or blank for single pages.
  // Matches the TV Today reference: "Earlier programmes follow>>>>" on later
  // subpages, "Later programmes follow>>>>" on earlier subpages, blank when
  // all programmes fit on one page.
  if (paginationHint === "later") {
    rows.push({
      index: 23,
      content:
        cc(CC.BLUE) + cc(CC.NEW_BG) +
        cc(CC.YELLOW) + " Later programmes follow" +
        cc(CC.FLASH) + ">>>>",
    });
  } else if (paginationHint === "earlier") {
    rows.push({
      index: 23,
      content:
        cc(CC.BLUE) + cc(CC.NEW_BG) +
        cc(CC.YELLOW) + " Earlier programmes follow" +
        cc(CC.FLASH) + ">>>>",
    });
  } else {
    rows.push(blueBgRow(23, "", CC.YELLOW));
  }

  return rows;
}

export function generateSchedulePages({
  serviceName,
  channelName,
  channelNumber,
  programmes,
  date,
  spansNextDay,
  dateLabel,
  magazine,
  page,
  cycleSeconds,
  prevPage,
  nextPage,
  otherDayPage,
  indexPage,
}) {
  const baseDateStr = formatDateShort(date);
  const spanDateStr = baseDateStr + " - " + formatDateShort(
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  );

  const fastext = {
    red: prevPage,
    green: nextPage,
    yellow: indexPage,
    cyan: otherDayPage,
    link: null,
    index: indexPage,
  };

  const pageNumber = (magazine << 8) | page;
  const paginatedPages = paginateProgrammes(programmes);

  // Midnight boundary for this date — programmes starting at or after this
  // time mean the subpage spans into the next calendar day.
  const midnight = new Date(date);
  midnight.setHours(24, 0, 0, 0);

  function subpageDateStr(progs) {
    if (!spansNextDay) return baseDateStr;
    return progs.some((p) => p.start >= midnight) ? spanDateStr : baseDateStr;
  }

  if (paginatedPages.length === 1) {
    const rows = buildScheduleSubpage({
      serviceName,
      channelName,
      channelNumber,
      pageNumber,
      programmes: paginatedPages[0],
      dateStr: subpageDateStr(paginatedPages[0]),
      paginationHint: null,
    });
    return buildPage({
      description: `${channelName} ${dateLabel}`,
      magazine,
      page,
      subcode: 0,
      rows,
      fastext,
    });
  }

  const subpages = paginatedPages.map((pageProgrammes, i) =>
    buildScheduleSubpage({
      serviceName,
      channelName,
      channelNumber,
      pageNumber,
      programmes: pageProgrammes,
      dateStr: subpageDateStr(pageProgrammes),
      // First subpage(s) say "Later", last subpage(s) say "Earlier"
      paginationHint: i < paginatedPages.length - 1 ? "later" : "earlier",
    })
  );

  return buildCarousel({
    description: `${channelName} ${dateLabel}`,
    magazine,
    page,
    cycleSeconds,
    subpages,
    fastext,
  });
}
