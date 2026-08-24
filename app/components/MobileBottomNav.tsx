'use client';

import Link from 'next/link';

const NAV_V7_THEME_IDS=['pip-boy','kcfd','kc-bbq','kc-current','kc-sunset','18th-vine','river-market','aim','sporting','royals','chiefs','space','kcpd','city-fountains','cowtown','army','navy','marines','air-force'] as const;
const iconPath=(themeId:string,name:string)=>{
  const themeKey=themeId==='kc-sunset'?'kc-current':themeId;
  if(!NAV_V7_THEME_IDS.includes(themeId as any)) return '';
  const iconKey=name==='dms'?'messages':name==='create_post'?'post':'settings';
  return `/nav-v7/${themeKey}-${iconKey}-v7.webp`;
};
const hasCustomIcons=(themeId:string)=>NAV_V7_THEME_IDS.includes(themeId as any);
const ThemeIcon=({themeId,name,className=''}:{themeId:string;name:string;className?:string})=><img src={iconPath(themeId,name)} alt="" className={`nkc-theme-art-icon ${className}`} draggable={false}/>;

const luminance=(hex:string)=>{const v=(hex||'#000000').replace('#','').slice(0,6).padEnd(6,'0');const c=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255).map(x=>x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};

export default function MobileBottomNav({theme,active=''}:{theme:any;active?:string}){
  const inactive=contrast(theme.header,theme.accent)>=2.2?theme.accent:[theme.text,theme.pillTextActive,'#ffffff','#000000'].filter(Boolean).sort((a,b)=>contrast(theme.header,b)-contrast(theme.header,a))[0];
  const item=(key:string)=>active===key?{backgroundColor:theme.pillActive,color:theme.pillTextActive}:{color:inactive};
  return <nav className="nkc-mobile-actions nkc-mobile-bottom-nav" data-theme={theme.id} aria-label="Mobile navigation" style={{backgroundColor:theme.header,color:inactive,borderColor:theme.border,'--nkc-bottom-inactive':inactive,'--nkc-bottom-glow':theme.accent,'--nkc-bottom-surface':theme.card} as any}>
    <Link href="/dms" className={`nkc-bottom-nav-orb-item ${active==='messages'?'is-active':''}`} style={item('messages')}>{hasCustomIcons(theme.id)?<ThemeIcon themeId={theme.id} name="dms" className="nkc-custom-theme-nav-icon"/>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 9h8M8 12.5h5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}<span className="nkc-nav-label">Messages</span></Link>
    <Link href="/?compose=1#composer" className="nkc-bottom-nav-plus" aria-label="Create post" style={{color:inactive} as any}>{hasCustomIcons(theme.id)?<ThemeIcon themeId={theme.id} name="create_post" className="nkc-custom-theme-plus-icon"/>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>}<span className="nkc-nav-label">Post</span></Link>
    <Link href="/?settings=1" className={`nkc-bottom-nav-orb-item ${active==='settings'?'is-active':''}`} style={item('settings')}>{hasCustomIcons(theme.id)?<ThemeIcon themeId={theme.id} name="settings" className="nkc-custom-theme-nav-icon"/>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.7 3.6h4.6l.6 2.1 1.8 1 2.1-.5 2.3 4-1.5 1.6v2.1l1.5 1.6-2.3 4-2.1-.5-1.8 1-.6 2.1H9.7L9.1 20l-1.8-1-2.1.5-2.3-4 1.5-1.6v-2.1L2.9 10l2.3-4 2.1.5 1.8-1z" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round"/><circle cx="12" cy="12.8" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>}<span className="nkc-nav-label">Settings</span></Link>
  </nav>;
}
