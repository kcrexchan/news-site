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
  {
    slug: 'san-francisco',
    name: 'San Francisco',
    subtitle: 'Golden Gate / Fisherman\'s Wharf, CA',
    noaaId: '9414290',
    lat: 37.8063,
    lng: -122.4659,
  },
  {
    slug: 'berkeley',
    name: 'Berkeley',
    subtitle: 'Berkeley Pier, CA',
    noaaId: '9414816',
    lat: 37.8650,
    lng: -122.3070,
  },
  {
    slug: 'point-pinole',
    name: 'Point Pinole',
    subtitle: 'Richmond Inner Harbor (nearest NOAA station), CA',
    noaaId: '9414849',
    lat: 37.9100,
    lng: -122.3580,
  },
  {
    slug: 'antioch',
    name: 'Antioch',
    subtitle: 'San Joaquin River, CA',
    noaaId: '9415064',
    lat: 38.0200,
    lng: -121.8150,
  },
  {
    slug: 'rio-vista',
    name: 'Rio Vista',
    subtitle: 'Sacramento River, CA',
    noaaId: '9415316',
    lat: 38.1450,
    lng: -121.6920,
  },
  {
    slug: 'pittsburg',
    name: 'Pittsburg',
    subtitle: 'New York Slough, CA',
    noaaId: '9415096',
    lat: 38.0367,
    lng: -121.8800,
  },
  {
    slug: 'threemile-slough',
    name: 'Threemile Slough',
    subtitle: 'Sacramento-San Joaquin Delta, CA',
    noaaId: '9415193',
    lat: 38.0867,
    lng: -121.6850,
  },
];

export default tideStations;
