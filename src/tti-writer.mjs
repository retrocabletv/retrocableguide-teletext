// Teletext control codes (Level 1)
export const CC = {
  BLACK: 0x00, RED: 0x01, GREEN: 0x02, YELLOW: 0x03,
  BLUE: 0x04, MAGENTA: 0x05, CYAN: 0x06, WHITE: 0x07,
  FLASH: 0x08, STEADY: 0x09, END_BOX: 0x0a, START_BOX: 0x0b,
  NORMAL_SIZE: 0x0c, DOUBLE_HEIGHT: 0x0d,
  MOSAIC_BLACK: 0x10, MOSAIC_RED: 0x11, MOSAIC_GREEN: 0x12,
  MOSAIC_YELLOW: 0x13, MOSAIC_BLUE: 0x14, MOSAIC_MAGENTA: 0x15,
  MOSAIC_CYAN: 0x16, MOSAIC_WHITE: 0x17,
  CONCEAL: 0x18, CONTIGUOUS: 0x19, SEPARATED: 0x1a,
  ESC: 0x1b, BLACK_BG: 0x1c, NEW_BG: 0x1d,
  HOLD_MOSAIC: 0x1e, RELEASE_MOSAIC: 0x1f,
};

// Convert a teletext control code to its high-byte representation.
// Per the MRG TTI spec, control codes below 0x20 have bit 8 set (add 0x80)
// so they are stored as actual bytes 0x80-0x9F in the file.
export function cc(code) {
  return String.fromCharCode(code + 0x80);
}

// Count display columns — every character (including control code bytes) is one column
export function displayWidth(text) {
  return text.length;
}

// Pad a string to exactly `width` display columns
export function pad(text, width) {
  const w = displayWidth(text);
  if (w >= width) return text;
  return text + " ".repeat(width - w);
}

// Build an OL (Output Line) record
export function ol(row, content) {
  return `OL,${row},${pad(content, 40)}`;
}

// Format a page number as the 5-digit PN value: mppss
// magazine (1-8), page (hex 00-FF), subcode (decimal 00-99)
export function formatPN(magazine, page, subcode) {
  const m = magazine;
  const pp = page.toString(16).padStart(2, "0").toUpperCase();
  const ss = String(subcode).padStart(2, "0");
  return `${m}${pp}${ss}`;
}

// Format a 3-digit page reference for FL (fastext links): mpp
export function formatPageRef(pageNumber) {
  if (pageNumber === null || pageNumber === undefined) return "8FF";
  const magazine = (pageNumber >> 8) & 0x7;
  const page = pageNumber & 0xff;
  return `${magazine || 8}${page.toString(16).padStart(2, "0").toUpperCase()}`;
}

// Build a complete TTI page block (single subpage)
export function buildPage({
  description = "",
  magazine = 1,
  page = 0x00,
  subcode = 0,
  cycleSeconds = null,
  rows = [],
  fastext = null,
}) {
  const lines = [];

  if (description) lines.push(`DE,${description}`);
  lines.push(`PN,${formatPN(magazine, page, subcode)}`);
  lines.push(`SC,${String(subcode).padStart(4, "0")}`);
  if (cycleSeconds !== null) lines.push(`CT,${cycleSeconds},T`);
  lines.push("PS,8000");

  for (const row of rows) {
    lines.push(ol(row.index, row.content));
  }

  if (fastext) {
    const links = [
      formatPageRef(fastext.red),
      formatPageRef(fastext.green),
      formatPageRef(fastext.yellow),
      formatPageRef(fastext.cyan),
      formatPageRef(fastext.link),
      formatPageRef(fastext.index),
    ];
    lines.push(`FL,${links.join(",")}`);
  }

  return lines.join("\n");
}

// Build a carousel: multiple subpages sharing the same page number
export function buildCarousel({ description, magazine, page, cycleSeconds, subpages, fastext }) {
  return subpages
    .map((rows, i) =>
      buildPage({
        description: description ? `${description} ${i + 1}/${subpages.length}` : "",
        magazine,
        page,
        subcode: i,
        cycleSeconds,
        rows,
        fastext: typeof fastext === "function" ? fastext(i) : fastext,
      })
    )
    .join("\n");
}
