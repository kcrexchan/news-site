import React, { useState } from 'react';
import Head from 'next/head';

/* =========================================================================== */
/*  Particle canvas hook (same as index.jsx)                                */
/* =========================================================================== */
function useParticles(canvasRef) {
  const init = React.useRef(false);
  React.useEffect(() => {
    if (init.current || !canvasRef.current) return;
    init.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId, w, h;
    const particles = [];
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.8 + 0.5,
        dx: (Math.random() - 0.5) * 0.35, dy: -(Math.random() * 0.4 + 0.1),
        alpha: Math.random() * 0.4 + 0.1,
      });
    }
    function draw(time) {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        const hue = 200 + Math.sin(time / 5000 + p.x * 0.01) * 40;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 60%, ${35 + Math.sin(time / 3000) * 10}%, ${p.alpha})`;
        ctx.fill();
        for (const q of particles) {
          if (q === p) continue;
          const dist = Math.hypot(p.x - q.x, p.y - q.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(100,180,255,${0.05 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > w) p.dx *= -1;
        if (p.y < 0 || p.y > h) p.dy *= -1;
      }
      animId = requestAnimationFrame(draw);
    }
    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
}

/* =========================================================================== */
/*  Animated gradient hook                                                   */
/* =========================================================================== */
function useAnimatedGradient() {
  const [hue, setHue] = React.useState(0);
  React.useEffect(() => {
    let raf;
    function tick(t) { setHue((t / 30) % 60); raf = requestAnimationFrame(tick); }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const c1 = `hsl(${200 + hue}, 55%, ${38 - hue * 0.04}%)`;
  const c2 = `hsl(${220 + hue * 0.7}, 50%, ${40 - hue * 0.03}%)`;
  return { gradient: `linear-gradient(135deg, ${c1}, ${c2})`, accent1: c1, accent2: c2 };
}

/* =========================================================================== */
/*  Data                                                                       */
/* =========================================================================== */
const categories = [
  {
    icon: '🎢',
    title: 'Attractions',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/West_Edmonton_Mall,_Edmonton,_Alberta_(22116840181).jpg/960px-West_Edmonton_Mall,_Edmonton,_Alberta_(22116840181).jpg',
    imageCredit: 'Wikimedia Commons',
    items: [
      { name: 'West Edmonton Mall', desc: 'Largest mall in North America — 800+ stores, waterpark, theme park, and an indoor lagoon with dolphins.' },
      { name: 'Fort Edmonton Park', desc: 'Living history museum spanning 150 years of Edmonton history. Walk through recreated streets from the 1880s to the 1950s.' },
      { name: 'Whyte Avenue', desc: "Edmonton's iconic bohemian street in Old Strathcona — shops, restaurants, live music, and street performers." },
      { name: 'Rogers Place', desc: 'Home of the Edmonton Oilers. Catch an NHL game or attend concerts and events year-round.' },
    ],
  },
  {
    icon: '🌳',
    title: 'Parks & Outdoors',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Edmonton_Downtown_Skyline_daytime.jpg/960px-Edmonton_Downtown_Skyline_daytime.jpg',
    imageCredit: 'Wikimedia Commons',
    items: [
      { name: 'North Saskatchewan River Valley', desc: 'Largest urban parkland system in North America — 17,000+ hectares of trails, wildlife, and scenic views.' },
      { name: 'Ellerslie Lagoon', desc: 'Peaceful lagoon in the river valley. Kayak, paddleboard, or just relax on the beach. Great for families.' },
      { name: 'Whytecliff Duck Pond', desc: 'A downtown gem — feed the ducks, walk the trails, and enjoy the tundra ecosystem right in the city.' },
      { name: 'River Valley Trail System', desc: 'Over 160 km of paved and natural trails for walking, running, cycling, and winter skating.' },
    ],
  },
  {
    icon: '🏛️',
    title: 'Museums & Culture',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Royal-Alberta-Museum-Buildings-01.jpg/960px-Royal-Alberta-Museum-Buildings-01.jpg',
    imageCredit: 'Wikimedia Commons',
    items: [
      { name: 'Royal Alberta Museum', desc: "Alberta's premier museum — natural history, human history, and stunning architecture on the North Saskatchewan River." },
      { name: 'Neon Sign Museum', desc: 'FREE outdoor museum of restored historic neon signs in downtown Edmonton. Best visited at night when they glow!' },
      { name: 'Art Gallery of Alberta', desc: 'Striking architecture housing contemporary and historical Canadian art. Free admission for Alberta residents.' },
      { name: 'TELUS World of Science', desc: 'Hands-on science centre with IMAX, Zeidler Dome, and interactive exhibits. Great for kids and curious adults.' },
    ],
  },
  {
    icon: '🍜',
    title: 'Food & Drink',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Whyte_Avenue_at_104_Street_01_11-04-2022.jpg/960px-Whyte_Avenue_at_104_Street_01_11-04-2022.jpg',
    imageCredit: 'Wikimedia Commons',
    items: [
      { name: 'Whyte Avenue', desc: 'The heart of Edmonton dining — everything from casual pubs to fine dining, plus live music every night.' },
      { name: 'Little Italy (95th Street)', desc: 'Authentic Italian restaurants, cafes, and gelato shops in a charming neighbourhood.' },
      { name: '124th Street', desc: 'South Edmonton\'s newest food destination — Korean fried chicken, Asian fusion, and trendy spots.' },
      { name: "Bernadette's", desc: 'Indigenous-owned restaurant in downtown Edmonton. Award-winning Indigenous cuisine that tells a story.' },
    ],
  },
  {
    icon: '🆓',
    title: 'Free Activities',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Edmonton_neon_sign_museum_east.jpg/960px-Edmonton_neon_sign_museum_east.jpg',
    imageCredit: 'Wikimedia Commons',
    items: [
      { name: 'Neon Sign Museum', desc: 'Stroll past 20+ restored neon signs telling Edmonton\'s history. Free, outdoors, and magical at night.' },
      { name: 'River Valley Trails', desc: 'Hike, bike, or skate the extensive trail network — completely free and stunning in every season.' },
      { name: 'Summer Festivals', desc: 'Edmonton hosts dozens of free festivals: International Jazz Festival, Heritage Park Stampede, and more.' },
      { name: 'Public Art & Murals', desc: 'Self-guided walking tours of street art, murals, and sculptures throughout downtown and Oliver districts.' },
    ],
  },
  {
    icon: '🎪',
    title: 'Seasonal Events',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Edmonton_Fringe_%283842089284%29.jpg/960px-Edmonton_Fringe_%283842089284%29.jpg',
    imageCredit: 'Wikimedia Commons',
    items: [
      { name: 'Edmonton Fringe Festival (Aug)', desc: 'Canada\'s largest fringe festival — 11 days of comedy, theatre, and street performances. World-class!' },
      { name: 'K-Days (Aug)', desc: "Edmonton's signature event — midway, rodeo, livestock shows, and concerts. A city-wide celebration." },
      { name: 'Winter Lights Festival (Dec-Jan)', desc: 'Downtown transformed with massive light installations across Churchill Square and the river valley.' },
      { name: 'Edmonton Folk Festival (Jul)', desc: 'One of the world\'s great folk festivals — 3 days of music at Whyte Avenue\'s Clarke Park.' },
    ],
  },
];

const tips = [
  { icon: '🚗', title: 'Getting Around', text: 'Edmonton is car-friendly but has a solid transit system (ETS). The Metro bus and LRT cover most areas. Tailscale-friendly remote work spots everywhere.' },
  { icon: '🌡️', title: 'Weather', text: 'Summers (Jun-Aug) are warm and short — 25-30°C with long days. Winters are cold (-20°C) but the city embraces it with festivals and indoor activities. Spring and fall are brief.' },
  { icon: '💰', title: 'Budget', text: 'Many top attractions are free (river valley, neon museum, festivals). Paid attractions like West Edmonton Mall and Fort Edmonton Park offer combo passes. Food is affordable compared to other Canadian cities.' },
  { icon: '📅', title: 'Best Time', text: 'June to September for outdoor activities and festivals. December to January for Winter Lights. Year-round for museums, shopping, and food scenes.' },
];

const externalLinks = [
  { name: 'Explore Edmonton', url: 'https://exploreedmonton.com', desc: 'Official tourism site' },
  { name: 'City of Edmonton Parks', url: 'https://www.edmonton.ca/activities_parks_recreation', desc: 'Parks, trails, and recreation' },
  { name: 'ETS Transit', url: 'https://www.edmonton.ca/transportation', desc: 'Bus and LRT schedules' },
  { name: 'Weather Canada', url: 'https://weather.gc.ca/city/pages/ab-7_metric_e.html', desc: 'Edmonton forecast' },
];

/* =========================================================================== */
/*  Page                                                                       */
/* =========================================================================== */
export default function EdmontonPage() {
  const canvasRef = React.useRef(null);
  useParticles(canvasRef);
  const animGrad = useAnimatedGradient();
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const [expandedCat, setExpandedCat] = useState(null);

  const v = {
    bg: 'var(--bg-primary)',
    cardBg: 'var(--bg-card)',
    border: 'var(--border-color)',
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
  };

  const s = {
    page: { minHeight: '100vh', background: v.bg, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif", color: v.textPrimary, position: 'relative', overflowX: 'hidden' },
    canvasLayer: { position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' },
    content: { maxWidth: 960, margin: '0 auto', padding: '5rem 2rem', position: 'relative', zIndex: 1 },

    hero: { textAlign: 'center', marginBottom: '3.5rem', opacity: 0, animation: 'heroFadeIn 0.8s ease-out forwards' },
    title: { fontSize: 48, fontWeight: 700, margin: '0 0 12px', background: animGrad.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', transition: 'background 2s ease' },
    subtitle: { fontSize: 17, color: v.textSecondary, margin: '0 0 20px' },

    sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: animGrad.accent1, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, transition: 'color 2s ease' },
    labelBar: { width: 3, height: 16, borderRadius: 2, background: animGrad.gradient, transition: 'background 2s ease' },

    categoryCard: (i) => ({
      background: v.cardBg, border: `1px solid ${v.border}`, borderRadius: 16, overflow: 'hidden',
      marginBottom: 24, transition: 'all 0.3s ease',
      transform: i === hoveredIdx ? 'translateY(-2px)' : 'translateY(0)',
      boxShadow: i === hoveredIdx ? '0 8px 32px rgba(100,180,255,0.1)' : 'none',
    }),
    categoryImage: { width: '100%', height: 220, objectFit: 'cover', display: 'block' },
    categoryContent: { padding: '24px' },
    categoryTitle: { fontSize: 22, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 10 },
    itemRow: { display: 'flex', gap: 16, marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(100,180,255,0.03)', border: `1px solid ${v.border}` },
    itemName: { fontSize: 15, fontWeight: 600, color: v.textPrimary, marginBottom: 4 },
    itemDesc: { fontSize: 13, lineHeight: 1.6, color: v.textSecondary, margin: 0 },
    imageCredit: { fontSize: 10, color: v.textMuted, textAlign: 'right', padding: '6px 12px', background: 'rgba(0,0,0,0.2)' },

    tipCard: { background: v.cardBg, border: `1px solid ${v.border}`, borderRadius: 12, padding: '20px', marginBottom: 16 },
    tipTitle: { fontSize: 15, fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 },
    tipText: { fontSize: 13, lineHeight: 1.7, color: v.textSecondary, margin: 0 },

    linkCard: { display: 'inline-flex', flexDirection: 'column', padding: '16px 24px', borderRadius: 12, background: v.cardBg, border: `1px solid ${v.border}`, textDecoration: 'none', color: v.textPrimary, fontSize: 14, fontWeight: 600, transition: 'all 0.3s ease', marginRight: 12, marginBottom: 12 },
    linkDesc: { fontSize: 12, color: v.textSecondary, fontWeight: 400, marginTop: 4 },

    footer: { marginTop: '3rem', paddingTop: '2rem', borderTop: `1px solid ${v.border}`, textAlign: 'center', fontSize: 13, color: v.textMuted },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: 6, color: animGrad.accent1, textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: '2rem', transition: 'opacity 0.2s' },
  };

  return (
    <>
      <Head>
        <title>Edmonton Explorer · What to Do</title>
        <meta name="description" content="Things to do, eat, and explore in Edmonton, Alberta — attractions, parks, museums, food, and seasonal events." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          ::-webkit-scrollbar { width: 8px; }
          ::-webkit-scrollbar-track { background: var(--bg-secondary); border-radius: 4px; }
          ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, #4a90d9, #6ba3ff); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, #2563eb, #7c3aed); }
          ::selection { background: rgba(100,180,255,0.3); color: var(--text-primary); }
          body { overflow-x: hidden; }
          @keyframes heroFadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes containerSlideIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes shimmerMove { 0% { left: -60px; } 100% { left: calc(100% + 20px); } }
        `}</style>
      </Head>

      <div style={s.page}>
        <canvas ref={canvasRef} style={s.canvasLayer} />
        <div style={s.content}>
          {/* Hero */}
          <div style={s.hero}>
            <a href="/" style={s.backLink}>← Back to Dashboard</a>
            <h1 style={s.title}>🏙️ Edmonton Explorer</h1>
            <p style={s.subtitle}>Things to do, eat, and explore in Alberta's capital city</p>
          </div>

          {/* Categories */}
          {categories.map((cat, i) => (
            <div key={i} style={s.categoryCard(hoveredIdx === i ? 1 : 0)}
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(-1)}>
              <img src={cat.image} alt={cat.title} style={s.categoryImage} loading="lazy" />
              <div style={s.categoryContent}>
                <h2 style={s.categoryTitle}>{cat.icon} {cat.title}</h2>
                {cat.items.map((item, j) => (
                  <div key={j} style={s.itemRow}>
                    <div>
                      <div style={s.itemName}>{item.name}</div>
                      <p style={s.itemDesc}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={s.imageCredit}>📷 {cat.imageCredit}</div>
            </div>
          ))}

          {/* Tips */}
          <div style={{ opacity: 0, transform: 'translateY(20px)', animation: 'containerSlideIn 1s cubic-bezier(.25,.46,.45,.94) 0.3s forwards' }}>
            <div style={s.sectionLabel}>
              <span style={s.labelBar} /> Quick Tips
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {tips.map((tip, i) => (
                <div key={i} style={s.tipCard}>
                  <div style={s.tipTitle}>{tip.icon} {tip.title}</div>
                  <p style={s.tipText}>{tip.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* External Links */}
          <div style={{ marginTop: '2.5rem', opacity: 0, transform: 'translateY(20px)', animation: 'containerSlideIn 1s cubic-bezier(.25,.46,.45,.94) 0.5s forwards' }}>
            <div style={s.sectionLabel}>
              <span style={s.labelBar} /> Useful Links
            </div>
            <div>
              {externalLinks.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={s.linkCard}>
                  {link.name}
                  <span style={s.linkDesc}>{link.desc}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Footer */}
          <footer style={s.footer}>
            <p>Images from Wikimedia Commons · Data curated from Explore Edmonton & local guides</p>
          </footer>
        </div>
      </div>
    </>
  );
}
