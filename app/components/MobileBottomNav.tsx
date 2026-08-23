'use client';

import Link from 'next/link';

const iconPath=(themeId:string,name:string)=>{
  if(themeId==='pip-boy'){
    if(name==='dms') return '/pipboy/cgi_dms.png';
    if(name==='create_post') return '/pipboy/cgi_create_post.webp';
    if(name==='settings') return '/pipboy/cgi_settings.webp';
  }
  if(themeId==='kcfd') return `/kcfd/kcfd_${name}.png`;
  if(themeId==='kc-bbq'){
    if(name==='dms') return '/kcbbq/kcbbq_dms_v3.png';
    if(name==='create_post') return '/kcbbq/kcbbq_create_post_v3.png';
    if(name==='settings') return '/kcbbq/kcbbq_settings_v3.png';
  }

  if(themeId==='kc-current' || themeId==='kc-sunset'){
    if(name==='dms') return '/kc-current/dms.png';
    if(name==='create_post') return '/kc-current/create_post.png';
    if(name==='settings') return '/kc-current/settings.png';
  }
  if(themeId==='18th-vine'){
    if(name==='dms') return '/18th-vine/messages.png';
    if(name==='create_post') return '/18th-vine/create_post.png';
    if(name==='settings') return '/18th-vine/settings.png';
  }
  if(themeId==='river-market'){
    if(name==='dms') return '/river-market/dms.png';
    if(name==='create_post') return '/river-market/create_post.png';
    if(name==='settings') return '/river-market/settings.png';
  }
  if(themeId==='aim') return `/aim/aim_${name}.png`;
  if(themeId==='sporting') return `/sporting/sporting_${name}.png`;
  if(themeId==='royals'){
    if(name==='dms') return '/royals/royals_dms_v2.png';
    if(name==='create_post') return '/royals/royals_create_post_v2.png';
    if(name==='settings') return '/royals/royals_settings_v2.png';
  }
  if(themeId==='chiefs'){
    if(name==='dms') return '/chiefs/chiefs_dms_v2.png';
    if(name==='create_post') return '/chiefs/chiefs_create_post_v2.png';
    if(name==='settings') return '/chiefs/chiefs_settings_v2.png';
  }
  if(themeId==='space'){
    if(name==='dms') return '/space/space_dms_v2.png';
    if(name==='create_post') return '/space/space_create_post_v2.png';
    if(name==='settings') return '/space/space_settings_v2.png';
  }
  if(themeId==='kcpd'){
    if(name==='dms') return '/kcpd/kcpd_dms_v2.png';
    if(name==='create_post') return '/kcpd/kcpd_create_post_v2.png';
    if(name==='settings') return '/kcpd/kcpd_settings_v2.png';
  }
  if(themeId==='city-fountains'){
    if(name==='dms') return '/city-fountains/fountains_dms_v2.png';
    if(name==='create_post') return '/city-fountains/fountains_create_post_v2.png';
    if(name==='settings') return '/city-fountains/fountains_settings_v2.png';
  }

  if(themeId==='cowtown'){
    if(name==='dms') return '/cowtown/cowtown_dms_v2.png';
    if(name==='create_post') return '/cowtown/cowtown_create_post_v2.png';
    if(name==='settings') return '/cowtown/cowtown_settings_v2.png';
  }
  if(themeId==='army'){
    if(name==='dms') return '/army/army_dms_v2.png';
    if(name==='create_post') return '/army/army_create_post_v2.png';
    if(name==='settings') return '/army/army_settings_v2.png';
  }
  if(themeId==='navy'){
    if(name==='dms') return '/navy/navy_dms_v2.png';
    if(name==='create_post') return '/navy/navy_create_post_v2.png';
    if(name==='settings') return '/navy/navy_settings_v2.png';
  }
  if(themeId==='marines'){
    if(name==='dms') return '/marines/marines_dms_v2.png';
    if(name==='create_post') return '/marines/marines_create_post_v2.png';
    if(name==='settings') return '/marines/marines_settings_v2.png';
  }
  if(themeId==='air-force'){
    if(name==='dms') return '/air-force/airforce_dms_v2.png';
    if(name==='create_post') return '/air-force/airforce_create_post_v2.png';
    if(name==='settings') return '/air-force/airforce_settings_v2.png';
  }
  return '';
};
const hasCustomIcons=(themeId:string)=>['pip-boy','kcfd','kc-bbq','kc-current','kc-sunset','18th-vine','river-market','aim','sporting','royals','chiefs','space','kcpd','city-fountains','cowtown','army','navy','marines','air-force'].includes(themeId);
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
