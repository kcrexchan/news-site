/**
 * Tide station registry — single source of truth for every station the
 * tide-table page can serve. To add a new station, append another object
 * here (slug must be unique; noaaId is the NOAA CO-OPS station ID).
 */
const tideStations = [
  {
    slug: 'half-moon-bay',
    name: 'Half Moon Bay',
    subtitle: 'Pillar Point Harbor, CA',
    noaaId: '9414131',
    lat: 37.5025,
    lng: -122.48217,
  },
];

export default tideStations;
