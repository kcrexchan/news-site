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
  {
    slug: 'bodega-bay',
    name: 'Bodega Bay',
    subtitle: 'Bodega Harbor Entrance, CA',
    noaaId: '9415625',
    lat: 38.3083,
    lng: -123.055,
  },
];

export default tideStations;
