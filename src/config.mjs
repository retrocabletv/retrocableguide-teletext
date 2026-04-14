export const TELETEXT_CONFIG = {
  // Feed URLs (duplicated from main config to avoid CJS/ESM issues)
  m3uUrl: "http://192.168.20.186:9191/output/m3u/RetroCable",
  xmltvUrl: "http://192.168.20.186:9191/output/epg/RetroCable",
  allowedGroups: [],
  stripNamePrefixes: true,
  channelLimit: 0,

  // Teletext-specific
  outputDir: "./teletext-pages",
  serviceName: "TV Guide",
  indexTitle: "THE CHANNEL GUIDE INDEX",
  indexPage: 0x100,
  todayPageBase: 0x100,
  tomorrowPageBase: 0x200,
  scheduleCarouselSeconds: 15,
  indexCarouselSeconds: 10,

  // Channel slot mapping: channel number -> BCD page offset (channels 1-99)
  // When autoSlotMap is true, slots are derived from M3U channel numbers
  autoSlotMap: true,
  channelSlotMap: {},
};
