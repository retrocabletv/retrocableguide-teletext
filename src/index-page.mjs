import { CC, cc, buildCarousel, buildPage } from "./tti-writer.mjs";
import {
  doubleHeightRows,
  headerRow,
  textRow,
  dotLeader,
  center,
  pad,
} from "./page-builder.mjs";

const CHANNELS_PER_COLUMN = 15; // rows 4-18
const COLUMNS = 2;
const CHANNELS_PER_PAGE = CHANNELS_PER_COLUMN * COLUMNS;
const COL_WIDTH = 19;

function buildIndexSubpage(channels, subpageIndex, totalSubpages, config) {
  const rows = [];

  // Row 0: service name + page number
  rows.push(headerRow(config.serviceName, 0x100));

  // Row 1-2: yellow double-height title on blue background, centered, full width
  // The blue bg extends full width because the mosaic blue + NEW_BG fills the row
  const titleText = center(config.indexTitle, 36); // 40 - 4 control code display cols
  rows.push(...doubleHeightRows(1, titleText, CC.YELLOW, CC.BLUE));

  // Row 3: column headers in white
  const hdrLeft = pad("Channel Name", 15) + "Chan";
  const hdrRight = " " + pad("Channel Name", 14) + "Chan";
  rows.push({ index: 3, content: cc(CC.WHITE) + hdrLeft + hdrRight });

  // Rows 4-18: two-column channel listing (15 rows)
  // Left column: yellow names + yellow numbers
  // Right column: cyan names + cyan numbers
  for (let row = 0; row < CHANNELS_PER_COLUMN; row++) {
    const rowIndex = row + 4;
    let content = "";

    for (let col = 0; col < COLUMNS; col++) {
      const nameColor = col === 0 ? CC.YELLOW : CC.CYAN;
      content += cc(nameColor);

      const channelIndex = col * CHANNELS_PER_COLUMN + row;
      if (channelIndex < channels.length) {
        const ch = channels[channelIndex];
        content += dotLeader(ch.name, ch.displayNum, COL_WIDTH);
      } else {
        content += " ".repeat(COL_WIDTH);
      }
    }

    rows.push({ index: rowIndex, content });
  }

  // Row 20-21: instructions in white
  rows.push(textRow(20, 'Press "1" then Chan.No for Today\'s', CC.WHITE));
  rows.push(textRow(21, '      "2" then Chan.No for Tomorrow\'s', CC.WHITE));

  // Row 22: "More Channels follow" only when there are further subpages
  if (subpageIndex < totalSubpages - 1) {
    rows.push({
      index: 22,
      content: cc(CC.GREEN) + "More Channels follow " + cc(CC.FLASH) + ">>>>",
    });
  }

  return rows;
}

export function generateIndexPages(channels, config) {
  const totalSubpages = Math.ceil(channels.length / CHANNELS_PER_PAGE) || 1;

  if (totalSubpages === 1) {
    return buildPage({
      description: "Channel Guide Index",
      magazine: 1,
      page: 0x00,
      subcode: 0,
      rows: buildIndexSubpage(channels, 0, 1, config),
    });
  }

  const subpages = [];
  for (let i = 0; i < totalSubpages; i++) {
    const start = i * CHANNELS_PER_PAGE;
    const pageChannels = channels.slice(start, start + CHANNELS_PER_PAGE);
    subpages.push(buildIndexSubpage(pageChannels, i, totalSubpages, config));
  }

  return buildCarousel({
    description: "Channel Guide Index",
    magazine: 1,
    page: 0x00,
    cycleSeconds: config.indexCarouselSeconds,
    subpages,
  });
}
