import React from 'react'
import Head from 'next/head'

const items = [
  {title:'Bezeit 36-in Wall-Mounted Single-Sink Black Bath Vanity',desc:'Black vanity with white resin top, self-assembly needed. Model BV3601-BK-WM.',img:'https://v3b.fal.media/files/b/0aa5fc74/iOz_ZzwoEI0Q4Nu6iFx5p_qswUVxPv.png',meta:'Home Depot · 1:39 PM',link:'https://www.homedepot.com/p/Bezeit-36-in-Wall-Mounted-Single-Sink-Black-Bath-Vanity-with-White-Resin-Top-Self-Assembly-Needed-BV3601-BK-WM/336068452'},
  {title:'17 Stories 47.2-118″ Extendable Oval Dining Table',desc:'Engineered wood, extends 47″ to 110″ for 8-10 people.',img:'https://v3b.fal.media/files/b/0aa5fc74/jRjcaoP7Rq2yi6IOUnLsY_AcHDmpqT.png',meta:'Wayfair w117686692 · 3:15 PM',link:'https://www.wayfair.com/furniture/pdp/17-stories-472-118-extendable-oval-dining-table-for-8-10-person-rectangular-wooden-indoor-dinner-tables-large-kitchen-dining-table-with-storage-w117686692.html'},
  {title:'MW Lighting 4ft LED Linear Light',desc:'Black 30/40/50W selectable, 3000K-6500K, up to 5750 lumens.',img:'https://v3b.fal.media/files/b/0aa5fc86/kj6SHWiBnb1W0b1z0jhNN_XBbBreu1.png',meta:'Wayfair lzmj1822',link:'https://www.wayfair.com/lighting/pdp/mw-lighting-4ft-black-30w40w50w-selectable-integrated-led-linear-light-3000k-6500k-hanging-office-shop-light-fixture-lzmj1822.html'},
  {title:'Ivy Bronx Alvisa Outdoor Wall Light 2-Pack',desc:'Matte black aluminum, dusk-to-dawn sensor, waterproof.',img:'https://v3b.fal.media/files/b/0aa5fc75/PNvFrZ_eiglCmxpIww_pa_oAcSDfDY.png',meta:'Wayfair w001065167 · 3:25 PM',link:'https://www.wayfair.com/lighting/pdp/ivy-bronx-alvisa-outdoor-wall-light-in-2-lights-dusk-to-dawn-with-aluminum-w001065167.html'},
  {title:'Koda 46″ LED Shop Light w/ Motion Sensor',desc:'3800 lumens, 4000K, motion-activated with remote.',img:'https://v3b.fal.media/files/b/0aa5fc89/-0l_jR5R_XQVQL3HbVtyT_VwKg9LPo.png',meta:'Wayfair kdab1028 · 3:31 PM',link:'https://www.wayfair.com/lighting/pdp/koda-46-led-indoor-and-outdoor-shop-light-with-motion-sensor-kdab1028.html'},
  {title:'Ebern Designs 14.5″h Dimmable LED Outdoor Wall Light',desc:'Black aluminum, dimmable with dusk-to-dawn.',img:'https://v3b.fal.media/files/b/0aa5fc7d/Skl9FAXGZIR2DK_hhaaua_02mwyXpQ.png',meta:'Wayfair w119870835',link:'https://www.wayfair.com/lighting/pdp/ebern-designs-14-5h-dimmable-led-black-aluminum-outdoor-wall-light-with-dusk-to-dawn-w119870835.html'},
  {title:'Wrought Studio Jazzlynn LED Wall Light',desc:'Modern LED wall fixture, contemporary design.',img:'https://v3b.fal.media/files/b/0aa5fc7d/qbLFgLeQeBuejLt_86-MJ_dA9HYioO.png',meta:'Wayfair w100525116',link:'https://www.wayfair.com/lighting/pdp/wrought-studio-jazzlynn-led-wall-light-w100525116.html'},
  {title:'Trent Austin Design Tulsita Outdoor Flush Mount Lantern',desc:'13″H glass, black wrought iron, dusk-to-dawn.',img:'https://v3b.fal.media/files/b/0aa5fc7c/6f07yJ8n6jP7VsaMh9FPc_EfVqX7LM.png',meta:'Wayfair w003549990',link:'https://www.wayfair.com/lighting/pdp/trent-austin-design-tulsita-black-1-bulb-13-h-glass-outdoor-flush-mount-wall-lantern-with-dusk-to-dawn-w003549990.html'},
  {title:'Wrought Studio 354 Slender Sideway Outdoor Bar Sconce',desc:'Hardwired LED bar, slender sideways design.',img:'https://v3b.fal.media/files/b/0aa5fc7c/Qb_iDeire7DlJUjMeAaZs_p2jh5dof.png',meta:'Wayfair w120000259 · 3:41 PM',link:'https://www.wayfair.com/lighting/pdp/wrought-studio-354-slender-sideway-outdoor-hardwired-bar-wall-sconce-with-led-light-source-w120000259.html'},
  {title:'Winston Porter Durable Metal Wall Hook',desc:'27.6×2.0×27.6 in, 22 lbs capacity, for coats/bags.',img:'https://v3b.fal.media/files/b/0aa5fc81/DoYsEXD5ws15dTkR5jGn5_oFKffO3W.png',meta:'Wayfair w113564041',link:'https://www.wayfair.com/decor-rugs/pdp/winston-porter-durable-metal-wall-hook-276-x-20-x-276-inches-sturdy-metal-body-thickness-04-inches-max-weight-capacity-22-lbs-perfect-for-organizing-coats-bags-and-accessories-stylish-and-functional-home-decor-w113564041.html'},
]

export default function ProductRoundup(){
  return (<>
    <Head><title>Product Roundup · Local LLM Hub</title></Head>
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'#e0e0e0',fontFamily:'Inter,sans-serif'}}>
      <header style={{padding:'2rem 1rem',textAlign:'center',borderBottom:'1px solid #222'}}>
        <a href="/" style={{color:'#4a90d9'}}>← Homescreen</a>
        <h1 style={{margin:'.5rem 0',background:'linear-gradient(135deg,#4a90d9,#6ba3ff)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Product Roundup</h1>
        <p>10 items from Home Depot & Wayfair</p>
      </header>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'1.5rem',padding:'2rem',maxWidth:1200,margin:'auto'}}>
        {items.map((it,i)=>(
          <a key={i} href={it.link} target="_blank" rel="noopener noreferrer" style={{textDecoration:'none',color:'inherit'}}>
            <div style={{background:'#111',border:'1px solid #222',borderRadius:16,overflow:'hidden'}}>
              <img src={it.img} alt="" style={{width:'100%',height:220,objectFit:'cover'}}/>
              <div style={{padding:'1rem'}}>
                <h3 style={{margin:'.2rem 0 .5rem'}}>{it.title}</h3>
                <p style={{color:'#9a9a9a',fontSize:14}}>{it.desc}</p>
                <div style={{fontSize:12,color:'#777',marginTop:'.5rem'}}>{it.meta}</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  </>)
}
