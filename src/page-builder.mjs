import { cc, CC, pad, displayWidth } from "./tti-writer.mjs";
export { pad };

const COLS = 40;

// Truncate a string, no ellipsis (authentic teletext style)
export function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen);
}

// Create a dot-leader string: "Name.......XX" with optional colour for the number.
// When numColor is set, a control code is inserted before the number, consuming 1
// display column from the dot run (the control code occupies a cell position).
export function dotLeader(name, number, totalWidth, numColor = null) {
  const numStr = String(number).padStart(2, "0");
  const colorPrefix = numColor !== null ? cc(numColor) : "";
  const colorCols = numColor !== null ? 1 : 0;
  const maxName = totalWidth - numStr.length - colorCols - 1;
  const truncatedName = truncate(name, maxName);
  const dotCount = totalWidth - truncatedName.length - numStr.length - colorCols;
  const dots = ".".repeat(Math.max(dotCount, 1));
  return truncatedName + dots + colorPrefix + numStr;
}

// Mosaic separator row — yellow separated mosaic on blue background.
// Uses character 0x2C (middle-row sextant blocks) in separated mosaic mode,
// matching the original TV Today broadcast captures.
export function mosaicSeparator(index) {
  const block = String.fromCharCode(0x2c);
  return {
    index,
    content:
      cc(CC.BLUE) + cc(CC.NEW_BG) +
      cc(CC.MOSAIC_YELLOW) + cc(CC.SEPARATED) +
      block.repeat(35) + " ",
  };
}

// Build a full-width mosaic separator bar
export function separatorRow(index, color = CC.MOSAIC_RED) {
  const block = String.fromCharCode(0x7f);
  return { index, content: cc(color) + block.repeat(39) };
}

// Build double-height title rows (row index = top half, index+1 = bottom half)
// If bgColor is set, the row gets a background colour (set via mosaic colour + NEW_BG).
export function doubleHeightRows(index, text, color = CC.YELLOW, bgColor = null) {
  let content;
  if (bgColor !== null) {
    content = cc(bgColor) + cc(CC.NEW_BG) + cc(color) + cc(CC.DOUBLE_HEIGHT) + text;
  } else {
    content = cc(color) + cc(CC.DOUBLE_HEIGHT) + text;
  }
  return [
    { index, content },
    { index: index + 1, content },
  ];
}

// Center text within a given width
export function center(text, width) {
  if (text.length >= width) return text.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  return " ".repeat(left) + text + " ".repeat(width - left - text.length);
}

// Build the header row (row 0) with optional left text and right-aligned page number
export function headerRow(leftText, pageNumber) {
  const pageStr = pageNumber !== undefined ? pageNumber.toString(16).toUpperCase() : "";
  const gap = COLS - leftText.length - pageStr.length;
  if (gap < 1) {
    return { index: 0, content: pad(leftText + " " + pageStr, COLS) };
  }
  return { index: 0, content: leftText + " ".repeat(gap) + pageStr };
}

// Build a programme listing row with blue background, matching the reference:
// BLUE + NEW_BG + YELLOW + " HH:MM" + WHITE + "Title"
export function programmeRow(index, time, title) {
  const timeStr = time.padEnd(5);
  // 3 control codes (BLUE, NEW_BG, YELLOW) + space + time(5) + cc(WHITE) + title
  const maxTitle = COLS - 3 - 1 - 5 - 1; // = 30
  return {
    index,
    content:
      cc(CC.BLUE) + cc(CC.NEW_BG) +
      cc(CC.YELLOW) + " " + timeStr +
      cc(CC.WHITE) + truncate(title, maxTitle),
  };
}

// Build a text row with blue background and a single colour
export function blueBgRow(index, text, color = CC.YELLOW) {
  return {
    index,
    content: cc(CC.BLUE) + cc(CC.NEW_BG) + cc(color) + text,
  };
}

// Build a fastext colour bar for row 23
export function fastextBar(red, green, yellow, cyan) {
  const labels = [
    { color: CC.RED, text: red },
    { color: CC.GREEN, text: green },
    { color: CC.YELLOW, text: yellow },
    { color: CC.CYAN, text: cyan },
  ];
  let content = "";
  for (const label of labels) {
    const segment = pad(label.text, 10);
    content += cc(label.color) + segment;
  }
  return { index: 23, content };
}

// Build a text row with a single colour
export function textRow(index, text, color = CC.WHITE) {
  return { index, content: cc(color) + text };
}

// Format a Date as "HH:MM" in 24h format
export function formatTime24(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// Format a Date as "TUE 31 MAR" (no label prefix)
export function formatDateShort(date) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}
