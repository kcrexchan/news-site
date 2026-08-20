import { useState } from 'react';
import { useRouter } from 'next/router';

const DATA = {
  title: "Earn While You Wander",
  subtitle: "Realistic ways to generate income from Lake Louise, the Rockies, and anywhere with WiFi",
  categories: {
    photography: {
      title: "📸 Photography & Visual Content",
      intro: "Lake Louise is one of the most photographed locations on Earth. Your shots have real commercial value if you approach them strategically.",
      items: [
        { name: "Stock Photo Licensing (Adobe Stock, Shutterstock, Alamy)", description: "Upload your Lake Louise and Banff photos to multiple stock platforms simultaneously. Adobe Stock offers the best integration with Creative Cloud buyers; Shutterstock has the highest traffic volume; Alamy pays higher per-sale commissions (20-50% vs 15-30%). Realistic earnings: hobby contributors earn $10-100/month, part-time photographers make $100-1,000/month. The key is uploading 500+ images across platforms with proper metadata/keywords.", earningPotential: "$10 - $1,000+/month (passive)", link: "https://contributor.stock.adobe.com/", text: "Adobe Stock Contributor" },
        { name: "Print-on-Demand (Redbubble, Society6, Etsy + Printful)", description: "Upload your best Lake Louise photos to Redbubble or Society6 — they handle printing and shipping on posters, canvas prints, phone cases, tote bags, etc. You earn 5-10% commission per sale with zero inventory cost. For higher margins (~40%), use Etsy + Printful integration where you set your own prices.", earningPotential: "$20 - $500/month (passive)", link: "https://www.redbubble.com/", text: "Redbubble" },
        { name: "Sell Direct Prints via Your Own Site", description: "Use your existing news-site infrastructure to add a print store. Platforms like SmugMug ($180/year) or Photoshelter give you full control over pricing and margins (~70%+). Lake Louise prints are premium-priced — buyers expect it given the location.", earningPotential: "$50 - $2,000/month (passive)", link: "", text: "" },
        { name: "Commercial Photography Permit", description: "For professional/commercial shoots inside Banff National Park, you need a Professional Film and Photography Permit from Parks Canada. This covers commercial use of your images (advertising, editorial, etc.). The Town of Banff also requires separate film permits for work done in town limits.", earningPotential: "Required for professional work", link: "https://parks.canada.ca/pn-np/ab/banff/info/permis-permit/", text: "Parks Canada Permits" },
      ]
    },
    local: {
      title: "🏔️ Local Opportunities at Lake Louise/Banff",
      intro: "The Rockies have a massive summer tourism economy. If you're willing to work in-season, there are several ways to earn directly.",
      items: [
        { name: "Photography Tours/Guides", description: "Banff and Lake Louise have dozens of established photography tour operators (VistaChase, Mountain Photo Tours). You could freelance as a guide for them — they need people who know the area. Rates typically range $150-300/day plus tips.", earningPotential: "$150 - $300/day + tips", link: "", text: "" },
        { name: "Tour Guide / Shuttle Driver (RADventures, Into the Wild Tours)", description: "Companies like RADventures and Into the Wild Tours hire seasonal guides for Banff/Lake Louise tours. They offer industry-leading wages, performance bonuses, tips, free/discounted experiences.", earningPotential: "$18-35/hour + tips", link: "https://www.radventurescanada.com/join-our-team/", text: "RADventures Careers" },
        { name: "Fairmont Chateau Lake Louise Seasonal Jobs", description: "The iconic hotel has year-round and seasonal positions — hospitality, front desk, food service, concierge. lakelouisejobs.com lists current openings.", earningPotential: "$17 - $25/hour + benefits", link: "https://lakelouisejobs.com/", text: "Lake Louise Jobs" },
        { name: "Gear Rental via Fat Llama", description: "If you have quality camera gear, list it on Fat Llama for rental by locals and visitors. Average earnings $15-40/day per item.", earningPotential: "$15 - $40/day per item rented", link: "", text: "" },
      ]
    },
    remote: {
      title: "💻 Remote Income (Works From Anywhere)",
      intro: "You don't need to be local to earn. These income streams work from any WiFi connection — perfect for travel days.",
      items: [
        { name: "Freelance Development/Consulting", description: "With your React/Svelte/Angular background, freelance dev work is the highest-earning remote option. Platforms: Upwork ($50-150/hr), Toptal (top 3%, $60-200/hr). You could take on a few hours of work each day while traveling.", earningPotential: "$50 - $200/hour", link: "https://www.upwork.com/", text: "Upwork" },
        { name: "Content Creation / Newsletter Sponsorships", description: "Your news-site infrastructure is already set up. You could monetize it through newsletter sponsorships, affiliate links for local LLM tools/hardware, or premium subscriptions.", earningPotential: "$500 - $3,000+/month", link: "", text: "" },
        { name: "AI-Assisted Content & Digital Products", description: "Create and sell digital products (templates, guides, courses) using AI tools for efficiency. Platforms: Gumroad, Teachable, Podia.", earningPotential: "$100 - $2,000/month", link: "", text: "" },
        { name: "Remote Side Hustles (2026 Trends)", description: "According to recent data, the most profitable remote side hustles in 2026 are: AI prompt engineering ($50-150/hr), technical writing for SaaS companies ($40-100/hr), and building micro-SaaS products.", earningPotential: "$30 - $150/hour", link: "", text: "" },
      ]
    },
    quickStart: {
      title: "🚀 Quick-Start Recommendations",
      intro: "If you want to start earning within days of your trip, here's the fastest path:",
      items: [
        { name: "1. Upload Lake Louise photos to Adobe Stock + Shutterstock TODAY", description: "Pick your best 50-100 shots from today and upload them now. Proper keywords are critical: 'Lake Louise', 'Banff National Park', 'turquoise lake', 'Canadian Rockies', 'glacier'. Each image takes ~5 minutes to keyword properly.", earningPotential: "$0 immediate, $10-100/month passive", link: "", text: "" },
        { name: "2. Apply for RADventures seasonal guide position (remote application)", description: "You can apply online before your trip ends. They hire year-round and summer positions fill fast.", earningPotential: "$18-35/hour + tips", link: "https://www.radventurescanada.com/join-our-team/", text: "RADventures Careers" },
        { name: "3. Set up Redbubble/Society6 account for your photos", description: "Upload your best shots to these platforms — they handle everything else (printing, shipping, customer service). Takes about 10 minutes per image.", earningPotential: "$20-500/month passive", link: "", text: "" },
      ]
    }
  },
  importantNotes: {
    banffRegulations: [
      "Drones are strictly prohibited in Banff National Park (no commercial permits available for recreational use)",
      "Commercial filming/photography requires Parks Canada permit ($100-500+ depending on scale)",
      "All visitors need a Parks Canada pass to enter the park",
      "Wildlife harassment fines can exceed $2,500 CAD — keep distance from animals"
    ],
    taxNote: [
      "As a non-resident working temporarily in Canada, you may have tax obligations. Consult a cross-border tax professional.",
      "Income earned remotely (from outside Canada) is generally not taxable in Canada."
    ]
  }
};

export default function Income() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('photography');

  return (
    <div className="income-page">
      <style>{`
        .income-page { max-width: 960px; margin: 0 auto; padding: 48px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .income-header { text-align: center; margin-bottom: 56px; }
        .income-header h1 { font-size: 2.75rem; background: linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #4facfe 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; font-weight: 800; letter-spacing: -0.5px; }
        .income-header p { color: #6b7280; font-size: 1.1rem; max-width: 600px; margin: 0 auto; }
        .tab-nav { display: flex; gap: 8px; justify-content: center; margin-bottom: 48px; flex-wrap: wrap; background: #f9fafb; padding: 6px; border-radius: 16px; max-width: 700px; margin-left: auto; margin-right: auto; }
        .tab-btn { padding: 12px 24px; border: none; background: transparent; color: #374151; font-size: 0.95rem; font-weight: 600; cursor: pointer; border-radius: 12px; transition: all 0.2s ease; }
        .tab-btn:hover { background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .tab-btn.active { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; box-shadow: 0 4px 16px rgba(245, 87, 108, 0.35); }
        .content-card { background: linear-gradient(135deg, #ffffff 0%, #fefefe 100%); border-radius: 20px; padding: 40px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 32px; border: 1px solid #f3f4f6; }
        .content-card h2 { font-size: 1.75rem; color: #1f2937; margin-bottom: 12px; font-weight: 700; }
        .content-card > p:first-of-type { color: #6b7280; line-height: 1.7; font-size: 1.05rem; margin-bottom: 32px; }
        .card-grid { display: grid; gap: 16px; }
        .item-card { background: linear-gradient(135deg, #fafbfc 0%, #f8f9fa 100%); border-radius: 14px; padding: 28px; border-left: 4px solid transparent; transition: all 0.2s ease; }
        .item-card:nth-child(1) { border-left-color: #667eea; }
        .item-card:nth-child(2) { border-left-color: #f5576c; }
        .item-card:nth-child(3) { border-left-color: #4facfe; }
        .item-card:nth-child(4) { border-left-color: #43e97b; }
        .item-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
        .item-card h3 { font-size: 1.15rem; color: #1f2937; margin-bottom: 8px; font-weight: 700; }
        .item-card p { color: #4b5563; line-height: 1.7; font-size: 0.95rem; margin-bottom: 12px; }
        .tag-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .tag { display: inline-block; padding: 4px 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
        .tag.red { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
        .tag.blue { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
        .tag.green { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
        .link-btn { color: #667eea; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: opacity 0.2s; padding: 4px 0; border-bottom: 1px dashed rgba(102,126,234,0.4); }
        .link-btn:hover { opacity: 0.7; }
        .notes-section { background: linear-gradient(135deg, #fef9f0 0%, #fef3e8 100%); border-radius: 16px; padding: 32px; margin-top: 40px; border: 1px solid #fde6c8; }
        .notes-section h3 { font-size: 1.25rem; color: #92400e; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .notes-section ul { list-style: none; padding: 0; margin: 0; }
        .notes-section li { color: #78350f; line-height: 1.6; font-size: 0.95rem; padding: 6px 0; border-bottom: 1px solid rgba(253,230,200,0.5); }
        .notes-section li:last-child { border-bottom: none; }
        @media (max-width: 768px) {
          .income-header h1 { font-size: 2rem; }
          .content-card { padding: 24px; }
          .item-card { padding: 20px; }
          .tab-btn { padding: 10px 16px; font-size: 0.85rem; }
        }
      `}</style>

      <button onClick={() => router.back()} style={{position:'fixed',top:16,left:16,zIndex:9999,padding:'10px 20px',fontSize:'18px',fontWeight:'bold',background:'rgba(0,0,0,0.85)',color:'#fff',border:'2px solid rgba(255,255,255,0.3)',borderRadius:'10px',cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>
        ← Back
      </button>
      <div className="income-header">
        <h1>Earn While You Wander</h1>
        <p>{DATA.subtitle}</p>
      </div>

      <nav className="tab-nav">
        {Object.entries(DATA.categories).map(([id, cat]) => (
          <button key={id} className={`tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
            {cat.title.split(' ')[0]} {cat.title.split(' ').slice(1).join(' ')}
          </button>
        ))}
      </nav>

      <div className="content-card">
        <h2>{DATA.categories[activeTab].title}</h2>
        <p>{DATA.categories[activeTab].intro}</p>
        <div className="card-grid">
          {DATA.categories[activeTab].items.map((item, i) => (
            <div key={i} className="item-card">
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <div className="tag-row">
                <span className={`tag ${['', 'red', 'blue', 'green'][i] || ''}`}>{item.earningPotential}</span>
                {item.link && item.text && (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="link-btn">{item.text} →</a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="notes-section">
        <h3>⚠️ Important Notes</h3>
        <ul>
          {DATA.importantNotes.banffRegulations.map((note, i) => (
            <li key={i}>📌 {note}</li>
          ))}
          {DATA.importantNotes.taxNote.map((note, i) => (
            <li key={`tax-${i}`}>💰 {note}</li>
          ))}
        </ul>
      </div>

      <footer style={{ textAlign: 'center', marginTop: 48, color: '#a0a0a0', fontSize: '0.85rem' }}>
        Built while exploring the Canadian Rockies · July 2026
      </footer>
    </div>
  );
}
