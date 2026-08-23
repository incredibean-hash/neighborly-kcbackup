'use client';
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { track } from '@vercel/analytics';
import { supabase } from '../lib/community';
import { THEMES, DEFAULT_THEME_ID } from '../lib/themes';

const CATS = ['All','General','For Sale & Free','Safety Alert','Recommendation','Event','Lost & Found'];
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '493019301743-e2djce6rmlpntl05terd0uopslij1gtu.apps.googleusercontent.com';

// Google sign-in can fail or open a blank page inside social-media and other
// embedded app browsers. Detect the common in-app browser identifiers so the
// user gets useful instructions before the Google account chooser opens.
const isEmbeddedAppBrowser=()=>{
  if(typeof navigator==='undefined') return false;
  const ua=navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|MessengerForiOS|Instagram|LinkedInApp|Snapchat|TikTok|Twitter|Line\/|;\s*wv\)|\bwv\b/i.test(ua);
};

const colorLuminance=(hex:string)=>{
  const value=(hex||'#000000').replace('#','').slice(0,6).padEnd(6,'0');
  const channels=[0,2,4].map(i=>parseInt(value.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
};
const contrastRatio=(a:string,b:string)=>{const x=colorLuminance(a),y=colorLuminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const themedNavColor=(theme:any)=>contrastRatio(theme.header,theme.accent)>=2.2
  ? theme.accent
  : [theme.text,theme.pillTextActive,'#ffffff','#000000'].filter(Boolean).sort((a,b)=>contrastRatio(theme.header,b)-contrastRatio(theme.header,a))[0];

const linkifyText=(value:any)=>String(value||'').split(/(https?:\/\/[^\s<]+)/gi).map((part,index)=>
  /^https?:\/\//i.test(part)
    ? <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all font-semibold hover:opacity-75" onClick={event=>event.stopPropagation()}>{part}</a>
    : part
);

const customThemeIconPath=(themeId:string,name:string)=>{
  if(themeId==='pip-boy') return `/pipboy/vaultboy_${name}.png`;
  if(themeId==='kcfd') return `/kcfd/kcfd_${name}.png`;
  if(themeId==='kc-bbq') return `/kcbbq/kcbbq_${name}.png`;
  if(themeId==='aim') return `/aim/aim_${name}.png`;
  if(themeId==='sporting') return `/sporting/sporting_${name}.png`;
  if(themeId==='royals') return `/royals/royals_${name}.png`;
  if(themeId==='chiefs') return `/chiefs/chiefs_${name}.png`;
  return '';
};
const hasCustomThemeIcons=(themeId:string)=>themeId==='pip-boy'||themeId==='kcfd'||themeId==='kc-bbq'||themeId==='aim'||themeId==='sporting'||themeId==='royals'||themeId==='chiefs';
const ThemeIcon=({themeId,name,alt='',className=''}:{themeId:string;name:string;alt?:string;className?:string})=>
  <img src={customThemeIconPath(themeId,name)} alt={alt} className={`nkc-theme-art-icon ${className}`} draggable={false}/>;

// Header-only colors sampled from the matching heart artwork. These do not
// affect the bottom navigation, cards, composer, or the rest of each theme.
const heartHeaderPalette=(theme:any)=>({
  royals:{surface:'#061b4f',primary:'#f3c457',secondary:'#f7fbff'},
  chiefs:{surface:'#260202',primary:'#ff9d42',secondary:'#fff4e6'},
  sporting:{surface:'#061b3d',primary:'#5daeff',secondary:'#f0f7ff'},
  'kc-current':{surface:'#00333d',primary:'#54eff5',secondary:'#efffff'},
  'kc-sunset':{surface:'#00333d',primary:'#54eff5',secondary:'#efffff'},
  space:{surface:'#160629',primary:'#c978ff',secondary:'#f7eaff'},
  aim:{surface:'#ffdf00',primary:'#1456d9',secondary:'#ffffff'},
  'pip-boy':{surface:'#001306',primary:'#68ff9a',secondary:'#d9ffe5'},
  kcpd:{surface:'#061a42',primary:'#78baff',secondary:'#f3f8ff'},
  kcfd:{surface:'#270202',primary:'#ff6945',secondary:'#fff0e9'},
  army:{surface:'#121808',primary:'#d1b657',secondary:'#f5f0dc'},
  navy:{surface:'#06142b',primary:'#f2c967',secondary:'#f5f9ff'},
  marines:{surface:'#280302',primary:'#f1a642',secondary:'#fff2df'},
  'air-force':{surface:'#061a3b',primary:'#83cfff',secondary:'#f1f8ff'},
  cowtown:{surface:'#251006',primary:'#e89442',secondary:'#fff0dc'},
  'kc-bbq':{surface:'#260a03',primary:'#ff7540',secondary:'#fff0e8'},
  'city-fountains':{surface:'#002d38',primary:'#5af5f1',secondary:'#edffff'},
  'kc-heartland':{surface:'#221806',primary:'#efbf57',secondary:'#fff7df'}
} as Record<string,{surface:string;primary:string;secondary:string}>)[theme.id] || {surface:theme.header,primary:themedNavColor(theme),secondary:theme.text};

// A PKCE authorization code may only be redeemed once. React Strict Mode mounts
// effects twice in development, and a fast double render can do the same in
// production, so the exchange is guarded at module scope rather than per mount.
let oauthCodeExchangeStarted = false;

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Images must be 15 MB or smaller.');
  const img = document.createElement('img');
  const canvas = document.createElement('canvas');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not decode that image.'));
    img.src = dataUrl;
  });
  const max = 1200;
  let { width, height } = img;
  if (width > max || height > max) {
    if (width > height) { height = Math.round(height * max / width); width = max; }
    else { width = Math.round(width * max / height); height = max; }
  }
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not available in this browser.');
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not prepare that image.')), 'image/jpeg', 0.78);
  });
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

async function withTimeout<T>(promise: PromiseLike<T>, ms = 30000): Promise<T> {
  return await Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Upload timed out. Please try the image again.')), ms))
  ]);
}

async function syncCommunityProfile(user:any, fallback?:any){
  if(!user) return null;
  const selectCols='id,auth_user_id,full_name,email,street_address,zip,neighborhood_id,avatar_url,is_admin,is_founder,is_verified,founder_number';
  const { data: existingRows, error: lookupError } = await supabase
    .from('profiles')
    .select(selectCols)
    .eq('auth_user_id', user.id)
    .order('id', { ascending:true })
    .limit(1);
  const existing = existingRows?.[0] || null;
  if(lookupError) console.warn('Profile lookup warning:', lookupError.message);

  const profile = {
    auth_user_id: user.id,
    full_name: existing?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || fallback?.full_name || user.email?.split('@')[0] || 'Neighbor',
    email: user.email || existing?.email || fallback?.email || '',
    street_address: existing?.street_address ?? fallback?.street_address ?? '',
    zip: existing?.zip ?? fallback?.zip ?? '',
    neighborhood_id: existing?.neighborhood_id ?? fallback?.neighborhood_id ?? null,
    avatar_url: existing?.avatar_url || null,
  };

  let saved:any = null;
  let error:any = null;
  if(existing?.id){
    ({ data: saved, error } = await supabase.from('profiles').update(profile).eq('id', existing.id).select(selectCols).single());
  } else {
    const profileId = globalThis.crypto?.randomUUID?.() || `${user.id}-${Date.now()}`;
    ({ data: saved, error } = await supabase.from('profiles').insert({ id: profileId, ...profile }).select(selectCols).single());
    if(error && (error.code === '23505' || /duplicate/i.test(error.message || ''))){
      const retry = await supabase.from('profiles').select(selectCols).eq('auth_user_id', user.id).order('id',{ascending:true}).limit(1);
      const row = retry.data?.[0];
      if(row?.id){
        const updated = await supabase.from('profiles').update(profile).eq('id', row.id).select(selectCols).single();
        saved = updated.data; error = updated.error;
      }
    }
  }
  if(error){
    console.error('Could not sync community profile:', error);
    return {...fallback, ...profile, ...(existing || {}), user_id:user.id};
  }
  return {...fallback, ...profile, ...(saved || {}), user_id:user.id};
}

export default function Page(){
  const [hoods,setHoods]=useState<any[]>([]);
  const [posts,setPosts]=useState<any[]>([]);
  const [comments,setComments]=useState<Record<string,any[]>>({});
  const [likes,setLikes]=useState<Record<string,any[]>>({});
  const [cLikes,setCLikes]=useState<Record<string,any[]>>({});
  const [openComments,setOpenComments]=useState<Record<string,boolean>>({});
  const [commentText,setCommentText]=useState<Record<string,string>>({});
  const [hood,setHood]=useState('Meadow Brooks Heights');
  const [cat,setCat]=useState('All');
  const [postCategory,setPostCategory]=useState('General');
  const [scope,setScope]=useState<'local'|'kc'>('kc');
  const [showExplore,setShowExplore]=useState(false);
  const [body,setBody]=useState('');
  const [profile,setProfile]=useState<any>(null);
  const [showJoin,setShowJoin]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [showCreatePost,setShowCreatePost]=useState(false);
  const [showFeedback,setShowFeedback]=useState(false);
  const [feedbackText,setFeedbackText]=useState('');
  const [feedbackSending,setFeedbackSending]=useState(false);
  const [feedbackSent,setFeedbackSent]=useState(false);
  const [themeId,setThemeId]=useState(DEFAULT_THEME_ID);
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [joinZip,setJoinZip]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [uploading,setUploading]=useState(false);
  const [editingPostId,setEditingPostId]=useState<string|null>(null);
  const [editBody,setEditBody]=useState('');
  const [editCategory,setEditCategory]=useState('General');
  const [editFile,setEditFile]=useState<File|null>(null);
  const [editSaving,setEditSaving]=useState(false);
  const editFileInputRef=useRef<HTMLInputElement>(null);
  const googleButtonRef=useRef<HTMLDivElement>(null);
  const [googleLoading,setGoogleLoading]=useState(false);
  const [embeddedBrowser,setEmbeddedBrowser]=useState(false);
  const [browserLinkCopied,setBrowserLinkCopied]=useState(false);
  const [emailCodeSent,setEmailCodeSent]=useState(false);
  const [emailCode,setEmailCode]=useState('');
  const [emailAuthLoading,setEmailAuthLoading]=useState(false);
  const [emailAuthMessage,setEmailAuthMessage]=useState('');
  const [showThemePicker,setShowThemePicker]=useState(false);
  const [authReady,setAuthReady]=useState(false);
  const [postSuccess,setPostSuccess]=useState(false);
  const [toast,setToast]=useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const postComposerRef = useRef<HTMLTextAreaElement>(null);
  const fullPostComposerRef = useRef<HTMLTextAreaElement>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [weather,setWeather]=useState<{temp:number;precip:number;summary:string}|null>(null);
  const [forecast,setForecast]=useState<{date:string;high:number;low:number;precip:number;summary:string;hours:{time:string;temp:number;precip:number;summary:string;wind:string}[]}[]>([]);
  const [expandedWeatherDay,setExpandedWeatherDay]=useState<string|null>(null);
  const [radarUrl,setRadarUrl]=useState('https://radar.weather.gov/ridge/standard/KEAX_loop.gif');
  const [neighborCount,setNeighborCount]=useState<number|null>(null);
  const [blockedUsers,setBlockedUsers]=useState<Set<string>>(new Set());
  const [isLoading,setIsLoading]=useState(true);
  const [commenting,setCommenting]=useState<Record<string,boolean>>({});
  const [reportingPost,setReportingPost]=useState<any>(null);
  const [reportReason,setReportReason]=useState('Harassment or bullying');
  const [reportDetails,setReportDetails]=useState('');
  const [reportSending,setReportSending]=useState(false);

  const theme = THEMES[themeId] || THEMES['royals'];
  const headerImage = theme.headerImage || '/neighborly-kc-header-banner.png';
  const cur = hoods.find((x:any)=>x.slug==hood) || hoods[0] || {name:'Meadow Brooks Heights', zip:'64155', id: '5fb249cb-1667-475b-ab8c-43e1df245ace', slug:'meadow-brooks-heights'};
  const navThemeColor = themedNavColor(theme);
  const heartHeader = heartHeaderPalette(theme);

  // Apply the saved theme before the browser paints the app. Using a normal
  // effect here lets the default theme flash first, which makes the whole
  // mobile layout appear to jitter on load.
  useLayoutEffect(()=>{
    document.documentElement.classList.add('nkc-theme-booting');
    const saved=localStorage.getItem('nkc_theme');
    const migrated=saved==='kc-sunset'?'kc-current':saved;
    setThemeId(migrated && THEMES[migrated] ? migrated : DEFAULT_THEME_ID);
    const frame=window.requestAnimationFrame(()=>document.documentElement.classList.remove('nkc-theme-booting'));
    return()=>{
      window.cancelAnimationFrame(frame);
      document.documentElement.classList.remove('nkc-theme-booting');
    };
  },[]);

  const trackSignupEvent = useCallback((name:string, method?:string) => {
    if(typeof window==='undefined') return;
    track(name,method?{method}:undefined);
  },[]);

  const resetMobileViewAfterSignIn = useCallback(() => {
    setShowJoin(false);
    if(typeof window==='undefined') return;
    const active=document.activeElement as HTMLElement | null;
    active?.blur?.();
    const reset=()=>{
      window.scrollTo({top:0,left:0,behavior:'auto'});
      document.documentElement.scrollLeft=0;
      document.body.scrollLeft=0;
    };
    reset();
    window.requestAnimationFrame(()=>window.requestAnimationFrame(reset));
  },[]);

  useEffect(()=>{
    if(showJoin) trackSignupEvent('Signup Opened');
    else {
      setEmailCodeSent(false);
      setEmailCode('');
      setEmailAuthMessage('');
    }
  },[showJoin,trackSignupEvent]);

  useEffect(()=>{
    setEmbeddedBrowser(isEmbeddedAppBrowser());
  },[]);

  useEffect(()=>{
    if(!showJoin) setBrowserLinkCopied(false);
  },[showJoin]);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const category=params.get('category');
    if(category && CATS.includes(category)){
      setCat(category);
      setPostCategory(category);
      window.requestAnimationFrame(()=>document.getElementById('composer')?.scrollIntoView({behavior:'auto',block:'center'}));
    }
    if(params.get('compose')==='1'){
      setShowCreatePost(true);
    }
    if(params.get('settings')==='1'){
      setShowExplore(false);
      setShowSettings(true);
    }

    // These URL flags are one-time navigation instructions. Remove them as
    // soon as they have been consumed so browser refresh always returns to the
    // main feed instead of reopening Create Post or Settings.
    const hadTransientRoute=params.has('compose')||params.has('settings')||params.has('category')||window.location.hash==='#composer';
    if(hadTransientRoute){
      params.delete('compose');
      params.delete('settings');
      params.delete('category');
      const remaining=params.toString();
      window.history.replaceState({},'',`${window.location.pathname}${remaining?`?${remaining}`:''}`);
    }
  },[]);

  useEffect(()=>{
    if(!showCreatePost) return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{ document.body.style.overflow=previous; };
  },[showCreatePost]);

  useEffect(()=>{
    document.documentElement.style.backgroundColor=theme.bg;
    document.body.style.backgroundColor=theme.bg;
    const themeMeta=document.querySelector('meta[name="theme-color"]');
    themeMeta?.setAttribute('content',theme.header);
  },[theme.bg,theme.header]);

  // Android Chrome/PWA can occasionally leave the document's scrolling layer
  // frozen after a permission prompt or after the app resumes. Reassert the
  // normal page-scrolling styles whenever the feed becomes active again.
  useEffect(()=>{
    const restorePageScroll=()=>{
      document.documentElement.style.overflowY='auto';
      document.documentElement.style.touchAction='pan-y pinch-zoom';
      document.body.style.overflowY='visible';
      document.body.style.position='static';
      document.body.style.touchAction='pan-y pinch-zoom';
    };
    const onVisibility=()=>{if(document.visibilityState==='visible')restorePageScroll();};
    restorePageScroll();
    window.addEventListener('pageshow',restorePageScroll);
    window.addEventListener('focus',restorePageScroll);
    document.addEventListener('visibilitychange',onVisibility);
    return()=>{
      window.removeEventListener('pageshow',restorePageScroll);
      window.removeEventListener('focus',restorePageScroll);
      document.removeEventListener('visibilitychange',onVisibility);
    };
  },[]);

  // Optimized viewport handler with debounce
  useEffect(()=>{
    let timeoutId: NodeJS.Timeout;
    const vv=window.visualViewport;
    if(!vv) return;
    const update=()=>{
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const bottom=Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
        const keyboardOpen = bottom > 120 || vv.height < window.innerHeight * 0.75;
        document.documentElement.style.setProperty('--nkc-vv-bottom', `${bottom}px`);
        document.documentElement.classList.toggle('nkc-keyboard-open', keyboardOpen);
      }, 100);
    };
    update();
    vv.addEventListener('resize',update);
    vv.addEventListener('scroll',update);
    window.addEventListener('resize',update);
    return()=>{
      clearTimeout(timeoutId);
      vv.removeEventListener('resize',update);
      vv.removeEventListener('scroll',update);
      window.removeEventListener('resize',update);
      document.documentElement.classList.remove('nkc-keyboard-open');
    };
  },[]);

  const loadAll = useCallback(async (postIds:string[]) => {
    if(!postIds.length) return;
    const {data:com}=await supabase.from('comments').select('*').in('post_id', postIds).order('created_at',{ascending:false});
    if(com){
      const authorIds=[...new Set(com.map((comment:any)=>comment.author_id).filter(Boolean))];
      const {data:commentProfiles}=authorIds.length?await supabase.from('profiles').select('auth_user_id,full_name,email').in('auth_user_id',authorIds):{data:[]};
      const names=new Map((commentProfiles||[]).map((person:any)=>[person.auth_user_id,person]));
      const namedComments=com.map((comment:any)=>{
        const person=names.get(comment.author_id);
        const realName=person?.full_name?.trim();
        return person&&realName&&realName.toLowerCase()!=='neighbor'?{...comment,author_name:realName}:comment;
      });
      const g: Record<string,any[]> = {}; namedComments.forEach((c:any)=>{ if(!g[c.post_id]) g[c.post_id]=[]; g[c.post_id].push(c); });
      setComments(g);
      const cIds=com.map((c:any)=>c.id);
      if(cIds.length){ const {data:cl}=await supabase.from('likes').select('*').in('comment_id', cIds); if(cl){ const cg: Record<string,any[]> = {}; cl.forEach((l:any)=>{ if(!cg[l.comment_id]) cg[l.comment_id]=[]; cg[l.comment_id].push(l); }); setCLikes(cg); } }
    }
    const {data:lk}=await supabase.from('likes').select('*').in('post_id', postIds).is('comment_id', null);
    if(lk){ const lg: Record<string,any[]> = {}; lk.forEach((l:any)=>{ if(!lg[l.post_id]) lg[l.post_id]=[]; lg[l.post_id].push(l); }); setLikes(lg); }
  }, []);

  // Use Google's browser button and exchange its ID token directly with
  // Supabase. This keeps the account chooser on Google/NeighborlyKC and avoids
  // advertising the raw project-id.supabase.co callback domain.
  useEffect(()=>{
    if(!showJoin || embeddedBrowser) return;
    let cancelled=false;

    const renderGoogleButton=()=>{
      const google=(window as any).google;
      if(cancelled || !google?.accounts?.id || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML='';
      google.accounts.id.initialize({
        client_id:GOOGLE_CLIENT_ID,
        callback:async(response:any)=>{
          if(!response?.credential) return;
          setEmailCodeSent(false);
          setEmailCode('');
          trackSignupEvent('Signup Started','google');
          setGoogleLoading(true);
          setEmailAuthMessage('');
          const {data,error}=await supabase.auth.signInWithIdToken({
            provider:'google',
            token:response.credential
          });
          if(error){
            setEmailAuthMessage(error.message || 'Google login could not complete.');
            setGoogleLoading(false);
            return;
          }
          if(data.user) {
            const pr=await syncCommunityProfile(data.user);
            if(pr) setProfile(pr);
          }
          setGoogleLoading(false);
          resetMobileViewAfterSignIn();
          trackSignupEvent('Signup Completed','google');
        }
      });
      google.accounts.id.renderButton(googleButtonRef.current,{
        type:'standard',
        theme:'outline',
        size:'large',
        text:'continue_with',
        shape:'pill',
        logo_alignment:'left',
        width:window.innerWidth < 640 ? Math.max(240,Math.min(300,window.innerWidth-72)) : 320
      });
    };

    const existing=document.getElementById('google-identity-services');
    if((window as any).google?.accounts?.id) renderGoogleButton();
    else if(existing) existing.addEventListener('load',renderGoogleButton,{once:true});
    else {
      const script=document.createElement('script');
      script.id='google-identity-services';
      script.src='https://accounts.google.com/gsi/client';
      script.async=true;
      script.defer=true;
      script.onload=renderGoogleButton;
      script.onerror=()=>setEmailAuthMessage('Could not load Google sign in. Please try email instead.');
      document.head.appendChild(script);
    }
    return()=>{cancelled=true;existing?.removeEventListener('load',renderGoogleButton);};
  },[showJoin,embeddedBrowser,resetMobileViewAfterSignIn,trackSignupEvent]);

  const copyRegularBrowserLink = async () => {
    const address=`${window.location.origin}/`;
    try{
      await navigator.clipboard.writeText(address);
      setBrowserLinkCopied(true);
      window.setTimeout(()=>setBrowserLinkCopied(false),3000);
    }catch{
      setEmailAuthMessage(`Open ${address} in your regular browser.`);
    }
  };

  const sendEmailLoginCode = async () => {
    const target = email.trim().toLowerCase();
    if(!target) return setEmailAuthMessage('Enter your email address first.');
    setEmailAuthLoading(true);
    trackSignupEvent('Signup Started','email');
    setEmailAuthMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: target,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: name.trim(), street_address: '', zip: joinZip.trim() },
      },
    });
    if(error){
      const msg = error.message || 'Could not start email sign in.';
      setEmailAuthMessage(/database error saving new user/i.test(msg) ? 'Supabase is blocking new accounts right now. Run the included Supabase auth login fix, then try again.' : msg);
    } else {
      setEmailCodeSent(true);
      trackSignupEvent('Login Link Sent','email');
      setEmailAuthMessage(`Check ${target}. We emailed you a secure sign-in link.`);
    }
    setEmailAuthLoading(false);
  };

  const verifyEmailLoginCode = async () => {
    const target = email.trim().toLowerCase();
    const token = emailCode.replace(/\D/g, '').slice(0, 6);
    if(token.length !== 6) return setEmailAuthMessage('Enter the 6-digit code from your email.');
    setEmailAuthLoading(true);
    setEmailAuthMessage('');
    const { data, error } = await supabase.auth.verifyOtp({ email: target, token, type: 'email' });
    if(error){
      setEmailAuthMessage(error.message || 'That code is invalid or expired.');
    } else if(data.user){
      await syncCommunityProfile(data.user, { full_name: name.trim(), street_address: '', zip: joinZip.trim() });
      setEmailCode('');
      setEmailCodeSent(false);
      setEmailAuthMessage('Signed in successfully.');
      resetMobileViewAfterSignIn();
      trackSignupEvent('Signup Completed','email');
      // Force profile refresh
      const { data: { user: refreshedUser } } = await supabase.auth.getUser();
      if(refreshedUser) {
        const profile = await syncCommunityProfile(refreshedUser);
        setProfile(profile);
      }
    }
    setEmailAuthLoading(false);
  };

  // Initialize auth once. Re-running this effect when the profile changes can
  // try to redeem the same one-use PKCE code twice and make Google sign-in
  // appear to require a second attempt.
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).get('signin')==='1') setShowJoin(true);

    let alive = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const applySession = (user:any) => {
      if(!user || !alive) return;
      setGoogleLoading(false);
      resetMobileViewAfterSignIn();

      const quickProfile = {
        user_id:user.id,
        auth_user_id:user.id,
        full_name:user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Neighbor',
        email:user.email || ''
      };
      setProfile(quickProfile);

      // Supabase advises keeping onAuthStateChange callbacks lightweight.
      // Complete the database profile sync outside the callback tick.
      window.setTimeout(()=>{
        if(!alive) return;
        syncCommunityProfile(user).then(pr=>{
          if(alive && pr){
            localStorage.setItem('nkc_profile', JSON.stringify(pr));
            setProfile(pr);
          }
        }).catch(err=>console.warn('Profile sync warning:', err));
      },0);
    };

    const finishAuthReady = () => {
      if(!alive) return;
      setAuthReady(true);
      setIsLoading(false);
    };

    const { data } = supabase.auth.onAuthStateChange((event, sess)=>{
      if(!alive) return;
      if(sess?.user){
        applySession(sess.user);
        finishAuthReady();
      } else if(event === 'SIGNED_OUT'){
        localStorage.removeItem('nkc_profile');
        setProfile(null);
        setShowJoin(false);
        finishAuthReady();
      }
    });
    subscription = data.subscription;

    (async()=>{
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        const hash = new URLSearchParams(window.location.hash.replace(/^#/,''));
        const access_token = hash.get('access_token');
        const refresh_token = hash.get('refresh_token');
        if(access_token && refresh_token){
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if(error) console.warn('Hash session adopt warning:', error.message);
          window.history.replaceState({}, '', window.location.pathname);
        }

        if(code && !oauthCodeExchangeStarted){
          oauthCodeExchangeStarted = true;
          const { data: { session: preexisting } } = await supabase.auth.getSession();
          if(!preexisting?.user){
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if(error) {
              console.warn('OAuth code exchange warning:', error.message);
              const { data: { session: after } } = await supabase.auth.getSession();
              if(!after?.user && alive){
                setShowJoin(true);
                setEmailAuthMessage('The sign-in link did not complete. Please request a new link and try again.');
              }
            }
          }
          window.history.replaceState({}, '', window.location.pathname);
        } else if(code){
          window.history.replaceState({}, '', window.location.pathname);
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if(!alive) return;
        if(error) console.warn('Auth session restore warning:', error.message);
        if(session?.user) applySession(session.user);
      } catch(e) {
        console.warn('Auth initialization warning:', e);
      } finally {
        finishAuthReady();
      }
    })();

    const authHash = new URLSearchParams(window.location.hash.replace(/^#/,''));
    const authError = authHash.get('error_description') || authHash.get('error');
    if(authError){
      setShowJoin(true);
      setEmailAuthMessage(authError.replace(/\+/g,' '));
      window.history.replaceState({}, '', window.location.pathname);
    }

    return ()=>{ alive=false; subscription?.unsubscribe(); };
  }, [resetMobileViewAfterSignIn]);

  const postCountRef = useRef(0);

  const loadPublicFeed = useCallback(async (attempt=0): Promise<void> => {
    const [hoodsResult, postsResult] = await Promise.all([
      supabase.from('neighborhoods').select('*').order('member_count',{ascending:false}),
      supabase.from('posts').select('*').order('created_at',{ascending:false}).limit(50),
    ]);
    if(hoodsResult.data) setHoods(hoodsResult.data);
    if(postsResult.error){
      console.warn('Feed load retry', postsResult.error.message);
      if(attempt < 5) window.setTimeout(()=>void loadPublicFeed(attempt+1), 500 + attempt*500);
      return;
    }
    const rawPosts=postsResult.data || [];
    const ids=[...new Set(rawPosts.map((x:any)=>x.user_id || x.author_id).filter(Boolean))];
    let profileMap=new Map<string,any>();
    if(ids.length){
      const {data:postProfiles}=await supabase.from('profiles').select('auth_user_id,full_name,email,avatar_url,is_admin,is_founder,is_verified,founder_number').in('auth_user_id',ids);
      profileMap=new Map((postProfiles||[]).map((x:any)=>[x.auth_user_id,x]));
    }
    const enrichedPosts=rawPosts.map((x:any)=>({...x,profiles:profileMap.get(x.user_id || x.author_id)||x.profiles||null}));
    postCountRef.current=enrichedPosts.length;
    setPosts(enrichedPosts);
    await loadAll(enrichedPosts.map((x:any)=>x.id));
    if(!enrichedPosts.length && attempt < 1) window.setTimeout(()=>void loadPublicFeed(attempt+1), 700);
  }, [loadAll]);

  useEffect(()=>{
    let cancelled=false;
    void loadPublicFeed();
    const onFocus=()=>{ if(!cancelled && postCountRef.current===0) void loadPublicFeed(); };
    window.addEventListener('focus',onFocus);
    return()=>{ cancelled=true; window.removeEventListener('focus',onFocus); };
  },[loadPublicFeed]);

  useEffect(()=>{
    let cancelled=false;
    const loadBlocks=async()=>{
      if(!profile?.user_id) { setBlockedUsers(new Set()); return; }
      const {data}=await supabase.from('user_blocks').select('blocked_id').eq('blocker_id',profile.user_id);
      if(!cancelled) setBlockedUsers(new Set((data||[]).map((x:any)=>x.blocked_id)));
    };
    void loadBlocks();
    return()=>{cancelled=true};
  },[profile?.user_id]);

  useEffect(()=>{
    let cancelled=false;
    const loadNeighborCount=async()=>{
      const neighborhoodId=cur?.id;
      if(!neighborhoodId){ setNeighborCount(null); return; }
      const {count,error}=await supabase.from('profiles').select('id',{count:'exact',head:true}).eq('neighborhood_id',neighborhoodId);
      if(cancelled) return;
      if(!error && typeof count==='number' && count>0){ setNeighborCount(count); return; }
      const {count:allCount}=await supabase.from('profiles').select('id',{count:'exact',head:true}).not('auth_user_id','is',null);
      if(cancelled) return;
      const fallbackCount=Number(cur?.member_count);
      setNeighborCount(typeof allCount==='number' && allCount>0 ? allCount : (Number.isFinite(fallbackCount)?fallbackCount:(typeof count==='number'?count:0)));
    };
    void loadNeighborCount();
    return()=>{cancelled=true};
  },[cur?.id,cur?.member_count]);

  const setTheme = useCallback((id:string)=>{
    const next=THEMES[id] ? id : DEFAULT_THEME_ID;
    setThemeId(next);
    localStorage.setItem('nkc_theme', next);
    window.dispatchEvent(new Event('nkc-theme-change'));
    // Close the theme picker and Settings after a theme is chosen.
    setShowThemePicker(false);
    setShowSettings(false);
  }, []);

  useEffect(()=>{
    let alive=true;
    const loadWeather=async()=>{
      try{
        const res=await fetch('/api/weather',{cache:'no-store'});
        if(!res.ok) throw new Error('weather request failed');
        const data=await res.json();
        if(alive && data?.current) setWeather(data.current);
        if(alive && Array.isArray(data?.forecast)) setForecast(data.forecast);
        if(alive && data?.radarUrl) setRadarUrl(data.radarUrl);
      }catch{}
    };
    loadWeather();
    const timer=window.setInterval(loadWeather,10*60*1000);
    return()=>{alive=false;window.clearInterval(timer)};
  },[]);
  
  const signOut = async () => { 
    localStorage.removeItem('nkc_profile'); 
    await supabase.auth.signOut(); 
    setProfile(null); 
    setShowSettings(false);
    // Clear any cached auth state
    sessionStorage.clear();
  };
  
  const submitFeedback = async () => {
    const text = feedbackText.trim();
    if (!text || !profile) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return setShowJoin(true);
    setFeedbackSending(true);
    try {
      const res = await fetch('/api/feedback', { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}`}, body:JSON.stringify({message:text}) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error || 'Could not send feedback.');
      setFeedbackText(''); setFeedbackSent(true); setShowFeedback(false); setShowSettings(false);
      window.setTimeout(()=>setFeedbackSent(false), 3500);
    } catch(e:any) { alert(e.message || 'Could not send feedback.'); }
    finally { setFeedbackSending(false); }
  };

  const submitPostReport = async () => {
    if(!profile){setReportingPost(null);setShowJoin(true);return;}
    if(!reportingPost?.id || !reportReason) return;
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) return setShowJoin(true);
    setReportSending(true);
    try{
      const {error}=await supabase.from('post_reports').insert({post_id:reportingPost.id,reporter_id:user.id,reason:reportReason,details:reportDetails.trim()||null});
      if(error){
        if(error.code==='23505') throw new Error('You already reported this post.');
        throw error;
      }
      const {data:{session}}=await supabase.auth.getSession();
      if(session?.access_token) void fetch('/api/notify-report',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({postId:reportingPost.id})}).catch(()=>{});
      setReportingPost(null);setReportDetails('');setReportReason('Harassment or bullying');
      setToast('✓ Report sent to moderators');window.setTimeout(()=>setToast(''),3000);
    }catch(e:any){alert(e.message||'Could not submit report.');}
    finally{setReportSending(false);}
  };

  const viewPostReports = async (post:any) => {
    if(!isAdmin) return;
    const {data,error}=await supabase.from('post_reports').select('reason,details,status,created_at').eq('post_id',post.id).order('created_at',{ascending:false}).limit(20);
    if(error) return alert('Could not load reports: '+error.message);
    if(!data?.length) return alert('This post has no reports.');
    alert(data.map((r:any,i:number)=>`${i+1}. ${r.reason}${r.details?` — ${r.details}`:''} (${r.status})`).join('\n\n'));
  };

  const scopedPosts = useMemo(() => {
    const filtered = scope==='local'
      ? (hoods.length===0 ? posts : posts.filter((p:any)=>!p.neighborhood_id || String(p.neighborhood_id)===String(cur?.id||'')))
      : posts;
    return filtered.filter((p:any)=>{ const id=p.user_id||p.author_id; return !id || !blockedUsers.has(id); });
  }, [scope, posts, hoods, cur?.id, blockedUsers]);

  const filtered = useMemo(() => {
    const matches = cat==='All'? scopedPosts : scopedPosts.filter((p:any)=>p.category===cat);
    return [...matches].sort((a:any,b:any)=>Number(Boolean(b.is_pinned))-Number(Boolean(a.is_pinned)) || new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
  }, [cat, scopedPosts]);

  const neighborhoodName = useCallback((id:any) => hoods.find((h:any)=>String(h.id)===String(id))?.name || cur?.name || 'Kansas City', [hoods, cur?.name]);
  const composerPrompt = !profile
    ? 'Join Neighborly KC to post…'
    : cat==='Safety Alert'
      ? 'Share a safety alert with Kansas City…'
      : cat==='For Sale & Free'
        ? 'Describe what you are selling or giving away…'
        : scope==='kc'
          ? 'What should Kansas City know?'
          : `What’s happening in ${cur?.name || 'your neighborhood'}?`;

  const chooseCategory = (category:string, postingCategory=category) => {
    setCat(category);
    if(postingCategory !== 'All') setPostCategory(postingCategory);
    setShowExplore(false);
    setShowSettings(false);
    window.requestAnimationFrame(()=>postComposerRef.current?.scrollIntoView({behavior:'smooth',block:'center'}));
  };
  
  const contributorCounts = useMemo(() => {
    return posts.reduce((acc:any,p:any)=>{
      const id=p.user_id||p.author_id;
      if(id) acc[id]=(acc[id]||0)+1;
      return acc;
    },{});
  }, [posts]);
  
  const topContributorIds = useMemo(() => {
    return new Set(Object.entries(contributorCounts)
      .sort((a:any,b:any)=>Number(b[1])-Number(a[1]))
      .slice(0,3)
      .filter(([,count]:any)=>Number(count)>=3)
      .map(([id])=>id));
  }, [contributorCounts]);

  const weatherEmoji = (summary:string) => { const x=(summary||'').toLowerCase(); return x.includes('thunder')?'⛈️':x.includes('snow')||x.includes('sleet')?'❄️':x.includes('rain')||x.includes('shower')?'🌧️':x.includes('fog')?'🌫️':x.includes('cloud')||x.includes('overcast')?'☁️':x.includes('partly')||x.includes('mostly sunny')?'🌤️':'☀️'; };
  const weatherHour = (iso:string) => new Date(iso).toLocaleTimeString('en-US',{hour:'numeric'});
  const forecastDay = (date:string,i:number) => i===0?'Today':new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{weekday:'short'});
  const isAdmin = Boolean(profile?.is_admin || profile?.is_founder);
  const POST_LIMIT_24H = 5;

  const getRecentPostCount = async (userId:string) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase.from('posts').select('id', { count:'exact', head:true }).eq('user_id', userId).gte('created_at', since);
    if(error) return 0;
    return count || 0;
  };

  const handleBePost = async () => {
    if (!profile) return setShowJoin(true);
    if (!body.trim() && !file) return;
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { alert('You must be signed in to post'); return; }
    if (!isAdmin) {
      const recentCount = await getRecentPostCount(currentUser.id);
      if (recentCount >= POST_LIMIT_24H) {
        alert(`You can make up to ${POST_LIMIT_24H} posts in 24 hours. Please try again later.`);
        return;
      }
    }
    setUploading(true);
    try {
      let image_url: string | null = null;
      if (file) {
        const compressed = await compressImage(file);
        const path = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error: upErr } = await withTimeout(supabase.storage.from('post-images').upload(path, compressed, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        }), 30000);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path);
        image_url = publicUrl;
      }
      const realId = hoods?.find((x: any) => x.slug == hood)?.id || cur?.id || '5fb249cb-1667-475b-ab8c-43e1df245ace';
      const user = currentUser;
      const { data, error } = await supabase.from('posts').insert({
        body,
        category: postCategory,
        user_id: user.id,
        author_id: user.id,
        neighborhood_id: realId,
        image_url,
        author_name: profile?.full_name || 'Neighbor'
      }).select().single();

      if (error) throw error;
      setPosts([{ ...data, profiles: { full_name: profile.full_name, avatar_url: profile.avatar_url || null } }, ...posts]);
      setBody('');
      setPostCategory('General');
      setCat('All');
      setShowExplore(false);
      setShowCreatePost(false);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      document.documentElement.classList.remove('nkc-keyboard-open');
      postComposerRef.current?.blur();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setPostSuccess(true);
      window.setTimeout(() => setPostSuccess(false), 2600);
    } catch (e: any) {
      alert('Could not save: ' + (e.message || e));
    } finally {
      setUploading(false);
    }
  };

  // FIXED: Comments now work properly
  const addComment = async (postId:string) => { 
    if(!profile) {
      setShowJoin(true);
      return;
    }
    const text=commentText[postId]?.trim(); 
    if(!text) return;
    if(posts.find((p:any)=>p.id===postId)?.comments_locked) return alert('Comments are locked on this post.');
    
    // Prevent duplicate submissions
    if(commenting[postId]) return;
    setCommenting(prev => ({...prev, [postId]: true}));
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if(!user) {
        setShowJoin(true);
        return;
      }
      
      const { data, error } = await supabase.from('comments').insert({ 
        post_id: postId, 
        content: text,
        body: text, // Add both for compatibility
        author_name: profile.full_name, 
        author_id: user.id
      }).select().single(); 
      
      if(error) {
        console.error('Comment error:', error);
        alert('Could not post comment: ' + error.message);
        return;
      }
      
      if(data) {
        setComments(prev => ({ 
          ...prev, 
          [postId]: [data, ...(prev[postId] || [])]
        }));
        setCommentText(prev => ({...prev, [postId]: ''}));
        const {data:{session}}=await supabase.auth.getSession();
        if(session?.access_token)void fetch('/api/notify-comment',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({postId,commentId:data.id})}).catch(()=>{});
      }
    } catch(e: any) {
      alert('Could not post comment: ' + (e.message || 'Unknown error'));
    } finally {
      setCommenting(prev => ({...prev, [postId]: false}));
    }
  };

  const togglePostLike = async (postId:string) => {
    if(!profile) return setShowJoin(true);
    const { data: { user } } = await supabase.auth.getUser();
    const authorId = user?.id || profile?.user_id;
    if(!authorId) return setShowJoin(true);

    // The local likes list can be stale after refresh/realtime timing. Check the
    // database before inserting so an existing like becomes an unlike instead
    // of tripping the one-like-per-user constraint.
    const localLike=(likes[postId]||[]).find((l:any)=>l.author_id===authorId);
    const {data:storedLike,error:lookupError}=localLike
      ? {data:localLike,error:null}
      : await supabase.from('likes').select('*').eq('post_id',postId).eq('author_id',authorId).is('comment_id',null).maybeSingle();

    if(lookupError) {
      console.error('Like lookup error:', lookupError);
      return;
    }

    if(storedLike){
      const {error}=await supabase.from('likes').delete().eq('id',storedLike.id);
      if(error){console.error('Unlike error:',error);return;}
      setLikes(prev=>({...prev,[postId]:(prev[postId]||[]).filter((x:any)=>x.id!==storedLike.id&&x.author_id!==authorId)}));
      return;
    }

    const {data,error}=await supabase.from('likes').insert({
      post_id:postId,
      author_name:profile.full_name,
      author_id:authorId
    }).select().single();

    // If another click/device beat us to the insert, sync that existing row
    // instead of showing the database constraint message to the user.
    if(error){
      if((error as any).code==='23505'){
        const {data:existing}=await supabase.from('likes').select('*').eq('post_id',postId).eq('author_id',authorId).is('comment_id',null).maybeSingle();
        if(existing)setLikes(prev=>({...prev,[postId]:[...(prev[postId]||[]).filter((x:any)=>x.author_id!==authorId),existing]}));
        return;
      }
      console.error('Like error:',error);
      return;
    }

    if(data){
      setLikes(prev=>({...prev,[postId]:[...(prev[postId]||[]).filter((x:any)=>x.author_id!==authorId),data]}));
      const {data:{session}}=await supabase.auth.getSession();
      if(session?.access_token)void fetch('/api/notify-reaction',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({postId})
      }).catch(()=>{});
    }
  };

  const toggleCommentLike = async (commentId:string) => {
    if(!profile) return setShowJoin(true);
    const { data: { user } } = await supabase.auth.getUser();
    const authorId = user?.id || profile?.user_id;
    if(!authorId) return setShowJoin(true);

    const localLike=(cLikes[commentId]||[]).find((l:any)=>l.author_id===authorId);
    const {data:storedLike,error:lookupError}=localLike
      ? {data:localLike,error:null}
      : await supabase.from('likes').select('*').eq('comment_id',commentId).eq('author_id',authorId).maybeSingle();

    if(lookupError){console.error('Comment like lookup error:',lookupError);return;}

    if(storedLike){
      const {error}=await supabase.from('likes').delete().eq('id',storedLike.id);
      if(error){console.error('Comment unlike error:',error);return;}
      setCLikes(prev=>({...prev,[commentId]:(prev[commentId]||[]).filter((x:any)=>x.id!==storedLike.id&&x.author_id!==authorId)}));
      return;
    }

    const {data,error}=await supabase.from('likes').insert({
      comment_id:commentId,
      author_name:profile.full_name,
      author_id:authorId
    }).select().single();

    if(error){
      if((error as any).code==='23505'){
        const {data:existing}=await supabase.from('likes').select('*').eq('comment_id',commentId).eq('author_id',authorId).maybeSingle();
        if(existing)setCLikes(prev=>({...prev,[commentId]:[...(prev[commentId]||[]).filter((x:any)=>x.author_id!==authorId),existing]}));
        return;
      }
      console.error('Comment like error:',error);
      return;
    }

    if(data){
      setCLikes(prev=>({...prev,[commentId]:[...(prev[commentId]||[]).filter((x:any)=>x.author_id!==authorId),data]}));
      const {data:{session}}=await supabase.auth.getSession();
      if(session?.access_token)void fetch('/api/notify-reaction',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({commentId})
      }).catch(()=>{});
    }
  };

  const beginEdit = (p:any) => { 
    setEditingPostId(p.id); 
    setEditBody(p.body || p.content || ''); 
    setEditCategory(p.category || 'General'); 
    setEditFile(null); 
    if(editFileInputRef.current) editFileInputRef.current.value=''; 
  };

  const cancelEdit = () => { 
    setEditingPostId(null); 
    setEditBody(''); 
    setEditCategory('General'); 
    setEditFile(null); 
    if(editFileInputRef.current) editFileInputRef.current.value=''; 
  };

  const savePostEdit = async (post:any) => {
    if(!profile || !editBody.trim()) return;
    const {data:{user}}=await supabase.auth.getUser();
    if(!user) return setShowJoin(true);
    const isOwner = post.user_id===user.id || (!post.user_id && post.author_name===profile.full_name);
    if(!isOwner && !isAdmin) return alert('You can only edit your own posts.');
    const moderationReason=!isOwner&&isAdmin ? prompt('Reason for moderator edit:','Corrected for community standards')?.trim() : '';
    if(!isOwner&&isAdmin&&!moderationReason) return;
    setEditSaving(true);
    try {
      let image_url=post.image_url || null;
      if(editFile){ 
        const compressed=await compressImage(editFile); 
        const { data: { user: editUser } } = await supabase.auth.getUser();
        if(!editUser) throw new Error('You must be signed in to replace an image.');
        const path=`${editUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`; 
        const {error:upErr}=await withTimeout(supabase.storage.from('post-images').upload(path,compressed,{contentType:'image/jpeg',cacheControl:'3600',upsert:false}),30000); 
        if(upErr) throw upErr; 
        image_url=supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl; 
        if(post.image_url){ 
          const oldPath=post.image_url.split('/post-images/')[1]; 
          if(oldPath) await supabase.storage.from('post-images').remove([oldPath]); 
        } 
      }
      const updatePayload:any={body:editBody.trim(),category:editCategory,image_url};
      if(!isOwner&&isAdmin){ updatePayload.moderator_edited_at=new Date().toISOString(); updatePayload.moderator_edited_by=user.id; }
      const {error}=await supabase.from('posts').update(updatePayload).eq('id',post.id);
      if(error) throw error;
      if(!isOwner&&isAdmin) await recordModerationAction('moderator_edit',post,moderationReason||'Moderator edit');
      const {data:saved,error:readError}=await supabase.from('posts').select('*').eq('id',post.id).maybeSingle();
      if(readError) throw readError;
      setPosts(prev=>prev.map((x:any)=>x.id===post.id?{...x,...(saved||updatePayload)}:x));
      cancelEdit();
      setToast('✓ Post updated');
      window.setTimeout(()=>setToast(''),2600);
    } catch(e:any) { alert('Could not update post: '+(e.message||e)); } finally { setEditSaving(false); }
  };

  const recordModerationAction = async (action:string, post:any, reason:string, expiresAt:string|null=null) => {
    if(!isAdmin || !profile?.user_id) throw new Error('Administrator access is required.');
    const targetUserId=post?.user_id||post?.author_id||null;
    const {error}=await supabase.from('moderation_actions').insert({
      moderator_id:profile.user_id,
      target_user_id:targetUserId,
      post_id:post?.id||null,
      action,
      reason,
      expires_at:expiresAt
    });
    if(error) throw error;
  };

  const deletePost = async (id:string, image_url:string|null, post?:any) => { 
    if(!confirm('Delete this post?')) return; 
    const reason=isAdmin ? prompt('Reason for removing this post:','Community standards')?.trim() : '';
    if(isAdmin && !reason) return;
    if(isAdmin && post){
      try { await recordModerationAction('post_removed',post,reason||'Community standards'); }
      catch(e:any){ return alert('Could not record moderation action: '+(e.message||e)); }
    }
    if(image_url){ 
      const path = image_url.split('/post-images/')[1]; 
      if(path) await supabase.storage.from('post-images').remove([path]); 
    } 
    const {error}=await supabase.from('posts').delete().eq('id', id); 
    if(error) return alert('Could not delete post: '+error.message); 
    setPosts(prev=>prev.filter((p:any)=>p.id!==id)); 
  };

  const togglePostModeration = async (post:any,field:'comments_locked'|'is_pinned',label:string) => {
    if(!isAdmin) return;
    const next=!Boolean(post[field]);
    const reason=prompt(`Reason to ${label.toLowerCase()}:`,'Community moderation')?.trim();
    if(!reason) return;
    try{
      const {error}=await supabase.from('posts').update({[field]:next}).eq('id',post.id);
      if(error) throw error;
      const auditAction=field==='comments_locked'?(next?'comments_locked':'comments_unlocked'):(next?'post_pinned':'post_unpinned');
      await recordModerationAction(auditAction,post,reason);
      setPosts(prev=>prev.map((p:any)=>p.id===post.id?{...p,[field]:next}:p));
      setToast(`✓ ${label}`);
      window.setTimeout(()=>setToast(''),2600);
    }catch(e:any){alert('Moderation action failed: '+(e.message||e));}
  };

  const moderateMember = async (action:'warn'|'mute'|'ban',post:any) => {
    if(!isAdmin) return;
    const userName=post.profiles?.full_name||post.author_name||'this member';
    const target=post.user_id||post.author_id;
    if(!target || target===profile?.user_id) return alert('You cannot moderate your own account.');
    const reason=prompt(`Reason to ${action} ${userName}:`,'Community standards')?.trim();
    if(!reason) return;
    let expiresAt:string|null=null;
    if(action==='mute'){
      const hours=Math.max(1,Math.min(720,Number(prompt('Mute for how many hours?','24'))||24));
      expiresAt=new Date(Date.now()+hours*60*60*1000).toISOString();
    }
    if(action==='ban' && !confirm(`Ban ${userName}? They will no longer be able to post or comment.`)) return;
    try{
      await recordModerationAction(action,post,reason,expiresAt);
      if(action==='ban') setBlockedUsers(prev=>new Set([...prev,target]));
      setToast(`✓ ${userName} ${action==='warn'?'warned':action==='mute'?'muted':'banned'}`);
      window.setTimeout(()=>setToast(''),3000);
    }catch(e:any){alert('Moderation action failed: '+(e.message||e));}
  };

  const deleteComment = async (id:string, postId:string) => { 
    if(!confirm('Delete comment?')) return; 
    const {error}=await supabase.from('comments').delete().eq('id', id); 
    if(error)return alert(error.message); 
    setComments((prev)=>({...prev, [postId]: prev[postId].filter((c:any)=>c.id!==id)})); 
  };

  // Loading state
  if(isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: theme.bg}}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{borderColor: theme.accent, borderTopColor: 'transparent'}}></div>
          <p style={{color: theme.text}}>Loading Neighborly KC...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden nkc-app-shell" data-theme={theme.id} style={{backgroundColor: theme.bg, color: theme.text, colorScheme: theme.id==='aim' ? 'light' : 'dark'}}>
      <header className="nkc-mobile-top-header sm:hidden z-40 border-b" data-theme={theme.id} style={{backgroundColor:theme.header,color:heartHeader.primary,borderColor:theme.accent,'--nkc-nav-accent':heartHeader.primary,'--nkc-nav-border':theme.accent,'--nkc-bottom-glow':theme.accent,'--nkc-bottom-surface':theme.card} as any}>
        <div className="nkc-mobile-top-row">
          <button type="button" className="nkc-mobile-brand" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})} aria-label="NeighborlyKC home">
            <span className="nkc-mobile-theme-mark"><img src={theme.heartLogoImage || theme.themeButtonImage || '/icon-192.png'} alt="" /></span>
            <span className="nkc-mobile-wordmark"><span style={{color:heartHeader.secondary}}>Neighborly</span><b style={{color:heartHeader.primary}}>KC</b></span>
          </button>
          <div className="nkc-mobile-top-icons">
            <Link href="/people" className="nkc-mobile-icon" aria-label="Search people"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></Link>
            <Link href="/notifications" className="nkc-mobile-icon" aria-label="Notifications"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 9.5a5.5 5.5 0 0 1 11 0v4l2 3H4.5l2-3zM9.5 19h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></Link>
          </div>
        </div>
        <button type="button" className="nkc-mobile-whats" onClick={()=>profile?setShowCreatePost(true):setShowJoin(true)} style={{backgroundColor:theme.card,borderColor:theme.border,color:theme.text}}>
          <span className="nkc-mobile-avatar" style={{backgroundColor:theme.input,borderColor:theme.border}}>{profile?.avatar_url?<img src={profile.avatar_url} alt=""/>:(profile?.full_name||'N').slice(0,1).toUpperCase()}</span>
          <span>What’s happening in KC?</span>
          <span className="nkc-mobile-whats-plus" style={{color:theme.accent}}>＋</span>
        </button>
      </header>

      <header className="hidden sm:block relative z-40 overflow-hidden border-b nkc-main-header" style={{backgroundColor: theme.header, borderColor: 'rgba(255,255,255,.12)'}}>
        <div className="nkc-header-banner-wrap">
          <button type="button" className="block nkc-header-banner-link" aria-label="Neighborly KC home" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>
            <img src={headerImage} alt="Neighborly KC" className="nkc-header-banner" draggable="false" />
          </button>
          <div className="nkc-header-controls" aria-label="Account control">
            <button type="button" onClick={()=>{setShowExplore(false);setShowSettings(true)}} className="nkc-header-control" style={{backgroundColor:theme.pillActive,color:theme.pillTextActive,borderColor:theme.border}}>⚙ Settings</button>
            {profile
              ? <button type="button" onClick={signOut} className="nkc-header-control" style={{backgroundColor:theme.pillActive,color:theme.pillTextActive,borderColor:theme.border}}>↪ Sign out</button>
              : <button type="button" onClick={()=>setShowJoin(true)} className="nkc-header-control" style={{backgroundColor:theme.pillActive,color:theme.pillTextActive,borderColor:theme.border}}>👤 Sign in</button>}
          </div>
        </div>
      </header>

      <section className="nkc-forecast-banner" aria-label="7 day Kansas City forecast" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>
        <div className="nkc-forecast-inner">
          <div className="nkc-forecast-title">
            <span>🌤️ <b>KC 7-DAY FORECAST</b> <small className="nkc-nws-source">NWS</small></span>
            {weather && <span className="nkc-forecast-now">Now {Math.round(weather.temp)}° · 💧 {Math.round(weather.precip)}%</span>}
          </div>
          <div className="nkc-forecast-days">
            {forecast.length ? forecast.map((f,i)=><button type="button" key={f.date} onClick={()=>setExpandedWeatherDay(expandedWeatherDay===f.date?null:f.date)} aria-expanded={expandedWeatherDay===f.date} className={`nkc-forecast-day ${expandedWeatherDay===f.date?'nkc-forecast-day-active':''}`} style={{backgroundColor:theme.card,borderColor:theme.border,color:theme.text}}>
              <b>{forecastDay(f.date,i)}</b><span className="nkc-forecast-icon">{weatherEmoji(f.summary)}</span><strong>{Math.round(f.high)}°</strong><span className="nkc-forecast-low">{Math.round(f.low)}°</span><span className="nkc-forecast-rain">💧 {Math.round(f.precip)}%</span>
            </button>) : <div className="nkc-forecast-loading">Loading National Weather Service forecast…</div>}
          </div>
          {expandedWeatherDay && (()=>{ const day=forecast.find(f=>f.date===expandedWeatherDay); if(!day) return null; return <div className="nkc-precip-panel" style={{backgroundColor:theme.card,borderColor:theme.border}}>
            <div className="nkc-precip-panel-head"><div><b>💧 {forecastDay(day.date,forecast.findIndex(f=>f.date===day.date))} precipitation</b><span>{day.summary}</span></div><button type="button" onClick={()=>setExpandedWeatherDay(null)} aria-label="Close precipitation details">×</button></div>
            <div className="nkc-hourly-precip">{day.hours.map(h=><div key={h.time} className="nkc-hourly-precip-item"><b>{weatherHour(h.time)}</b><span>{weatherEmoji(h.summary)}</span><strong>{Math.round(h.temp)}°</strong><em>💧 {Math.round(h.precip)}%</em></div>)}</div>
            <div className="nkc-radar-title"><b>Live Kansas City radar</b><span>Animated NWS KEAX radar · current conditions</span></div>
            <a href="https://radar.weather.gov/station/KEAX/standard" target="_blank" rel="noreferrer" className="nkc-radar-link" aria-label="Open full National Weather Service Kansas City radar"><img src={`${radarUrl}?t=${Math.floor(Date.now()/600000)}`} alt="Animated National Weather Service Kansas City radar" className="nkc-radar-image" /></a>
            <div className="nkc-weather-credit">Forecast & radar: NOAA / National Weather Service</div>
          </div> })()}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8 grid grid-cols-1 lg:grid-cols-[220px_1fr_300px] gap-4 sm:gap-6 nkc-page-content">
        <aside className="rounded-2xl p-3 h-fit border hidden lg:block" style={{backgroundColor: theme.card, borderColor: theme.border}}>
          <p className="text-xs font-bold px-3 py-2 opacity-40">FILTER</p>
          {CATS.map(c=>c==='For Sale & Free'
            ? <Link key={c} href="/forsale" className="block w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors" style={{color:theme.text}}>{c}</Link>
            : <button key={c} onClick={()=>c==='All'?setCat('All'):chooseCategory(c)} className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors" style={{backgroundColor: cat===c? theme.accent : 'transparent', color: cat===c? theme.pillTextActive : theme.text}}>{c}</button>)}
        </aside>

        <main className="space-y-3">
          {!profile && <section className="nkc-welcome-card rounded-2xl p-5 sm:p-6 border nkc-surface nkc-fade-in" style={{backgroundColor:theme.card,borderColor:theme.border}}>
            <p className="text-xs font-black uppercase tracking-[0.16em] opacity-60">Made for Kansas City</p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black leading-tight">Your Kansas City neighborhood, all in one place.</h1>
            <p className="mt-2 text-sm sm:text-base leading-relaxed opacity-75">Share local updates, recommendations, events, safety alerts and free items with people across the KC area.</p>
            <div className="nkc-welcome-benefits mt-4" aria-label="NeighborlyKC benefits">
              <span>🏘️ Local conversations</span><span>🤝 Meet neighbors</span><span>📣 KC-wide updates</span>
            </div>
            <button type="button" onClick={()=>setShowJoin(true)} className="nkc-welcome-cta mt-5 w-full sm:w-auto rounded-full px-6 py-3 font-black text-sm" style={{backgroundColor:theme.accent,color:theme.pillTextActive}}>Join NeighborlyKC — Free</button>
            <p className="mt-3 text-[11px] font-semibold opacity-60">Your exact address is never displayed publicly.</p>
          </section>}
          <div id="composer" className="rounded-2xl p-4 border nkc-surface nkc-fade-in" style={{backgroundColor: theme.card, borderColor: theme.border}}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div><p className="text-xs font-black uppercase tracking-wider opacity-50">Neighborly KC Network</p><h2 className="text-xl font-black">{scope==='local'?cur?.name:'All Kansas City'}</h2><p className="text-xs opacity-55">{scope==='local'?'Your neighborhood and nearby local conversation':'Everyone inside the 40-mile Neighborly KC network'}</p></div>
              <div className="nkc-scope-switch flex rounded-full p-0.5 gap-0.5" style={{backgroundColor:theme.input,border:`1px solid ${theme.border}`}}>
                <button onClick={()=>setScope('local')} className="px-3 py-1.5 rounded-full text-xs font-black transition-colors" style={{backgroundColor:scope==='local'?theme.pillActive:'transparent',color:scope==='local'?theme.pillTextActive:theme.text}}>📍 My Area</button>
                <button onClick={()=>setScope('kc')} className="px-3 py-1.5 rounded-full text-xs font-black transition-colors" style={{backgroundColor:scope==='kc'?theme.pillActive:'transparent',color:scope==='kc'?theme.pillTextActive:theme.text}}>🏙️ All KC</button>
              </div>
            </div>
            <div className="mb-2 rounded-xl px-3 py-2 text-xs font-bold border" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>📍 Posting to: <span style={{color:theme.accent}}>{scope==='kc'?'All Kansas City':cur?.name || 'your neighborhood'}</span></div>
            <textarea ref={postComposerRef} value={body} onChange={e=>setBody(e.target.value)} onFocus={()=>window.setTimeout(()=>postComposerRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),120)} autoComplete="off" autoCorrect="on" autoCapitalize="sentences" spellCheck={true} inputMode="text" name="neighborly-community-post" data-lpignore="true" data-form-type="other" placeholder={composerPrompt} className="nkc-post-composer w-full rounded-xl p-3 min-h-[96px] text-base outline-none" data-theme={theme.id} style={{backgroundColor: theme.input, color: theme.text, border: `1px solid ${theme.border}`, '--nkc-composer-bg':theme.input, '--nkc-placeholder-color':theme.text, scrollMarginBottom:'180px', caretColor: theme.accent, boxShadow: theme.id==='pip-boy' ? `inset 0 0 14px ${theme.accent}22, 0 0 8px ${theme.accent}22` : theme.id==='space' ? `inset 0 0 14px ${theme.accent}16` : undefined } as any} />
            <div className="flex items-center gap-2 mt-3 min-w-0">
              <label htmlFor="file-input" className="shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition-colors hover:opacity-80" style={{borderColor:theme.border}}>Choose image</label>
              <input key={fileInputKey} ref={fileInputRef} id="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)} className="sr-only" />
              {file && <div className="min-w-0 flex items-center gap-2 text-xs opacity-70"><span className="truncate max-w-[180px]" title={file.name}>{file.name}</span><button type="button" onClick={()=>{setFile(null); if(fileInputRef.current) fileInputRef.current.value=''; setFileInputKey(k=>k+1);}} className="shrink-0 font-black" aria-label="Remove selected image">✕</button></div>}
            </div>
            <div className="flex justify-end mt-2">
              <button disabled={uploading} onClick={handleBePost} className="px-5 py-2 rounded-full text-sm font-bold disabled:opacity-50 transition-opacity" style={{backgroundColor: theme.accent, color: theme.pillTextActive}}>{uploading?'Uploading...':scope==='kc'?'Post to KC':'Post to neighbors'}</button>
            </div>
          </div>

          {filtered.map((p:any)=>{
            const cList=comments[p.id]||[]; const isOpen=openComments[p.id]; const pLikes=likes[p.id]||[]; const liked=pLikes.some((l:any)=>l.author_id===profile?.user_id || l.author_name===profile?.full_name);
            const isOwner=Boolean(profile && ((p.user_id && p.user_id===profile.user_id) || (!p.user_id && p.author_name===profile.full_name))); const canManage=isOwner||isAdmin; const isEditing=editingPostId===p.id;
            const isCommenting = commenting[p.id] || false;
            return (
            <div key={p.id} className="rounded-2xl p-4 border nkc-surface nkc-fade-in nkc-post-card" style={{backgroundColor:theme.card,borderColor:theme.border}}>
              <div className="flex justify-between gap-3"><div className="flex items-center gap-2 min-w-0"><div className="w-9 h-9 shrink-0 rounded-full overflow-hidden grid place-items-center font-black text-xs border" style={{backgroundColor:theme.input,borderColor:theme.border}}>{p.profiles?.avatar_url?<img src={p.profiles.avatar_url} alt="" className="w-full h-full object-cover"/>:(p.profiles?.full_name||p.author_name||'N').slice(0,1).toUpperCase()}</div><div><div className="flex items-center gap-1.5 flex-wrap"><p className="text-xs font-bold opacity-60">{(p.user_id||p.author_id)?<a href={`/profile/${p.user_id||p.author_id}`} className="hover:underline" title="View profile">{p.profiles?.full_name||p.author_name||'Neighbor'}</a>:(p.profiles?.full_name||p.author_name||'Neighbor')} · {p.category}</p>
                  </div>{scope==='kc'&&<p className="text-[11px] font-bold mt-1 opacity-45">📍 {neighborhoodName(p.neighborhood_id)}</p>}</div></div>
                {canManage&&<details className="nkc-admin-menu relative shrink-0">
                  <summary className="nkc-admin-menu-trigger" aria-label="Post moderation menu">•••</summary>
                  <div className="nkc-admin-menu-panel" style={{backgroundColor:theme.card,borderColor:theme.border,color:theme.text}}>
                    <button type="button" onClick={(event)=>{event.currentTarget.closest('details')?.removeAttribute('open');beginEdit(p)}}>✏️ Edit post</button>
                    <button type="button" onClick={()=>deletePost(p.id,p.image_url,p)}>🗑️ Remove post</button>
                    {isAdmin&&<>
                      <button type="button" onClick={()=>viewPostReports(p)}>🚩 View reports</button>
                      <button type="button" onClick={()=>togglePostModeration(p,'comments_locked',p.comments_locked?'Unlock comments':'Lock comments')}>{p.comments_locked?'🔓 Unlock comments':'🔒 Lock comments'}</button>
                      <button type="button" onClick={()=>togglePostModeration(p,'is_pinned',p.is_pinned?'Unpin post':'Pin post')}>{p.is_pinned?'📌 Unpin post':'📌 Pin post'}</button>
                      {!isOwner&&<>
                        <button type="button" onClick={()=>moderateMember('warn',p)}>⚠️ Warn member</button>
                        <button type="button" onClick={()=>moderateMember('mute',p)}>🔇 Mute member</button>
                        <button type="button" className="danger" onClick={()=>moderateMember('ban',p)}>⛔ Ban member</button>
                        <a href={`/profile/${p.user_id||p.author_id}`}>📋 View activity</a>
                      </>}
                    </>}
                  </div>
                </details>}
              </div>
              {isEditing?<div className="mt-3 rounded-2xl p-3 nkc-pop-in" style={{backgroundColor:theme.input}}><textarea value={editBody} onChange={e=>setEditBody(e.target.value)} className="w-full rounded-xl p-3 min-h-[120px] text-sm outline-none border" style={{backgroundColor:theme.card,color:theme.text,borderColor:theme.border}}/><div className="grid sm:grid-cols-2 gap-2 mt-2"><select value={editCategory} onChange={e=>setEditCategory(e.target.value)} className="rounded-xl px-3 py-2 text-sm border outline-none" style={{backgroundColor:theme.card,color:theme.text,borderColor:theme.border}}>{CATS.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}</select><label className="rounded-xl px-3 py-2 text-sm border cursor-pointer" style={{backgroundColor:theme.card,borderColor:theme.border}}><span className="font-bold">📷 Replace image</span><input ref={editFileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setEditFile(e.target.files?.[0]||null)} className="sr-only"/>{editFile&&<span className="block text-xs opacity-60 truncate mt-1">{editFile.name}</span>}</label></div><div className="flex justify-end gap-2 mt-3"><button onClick={cancelEdit} className="px-4 py-2 rounded-full text-xs font-bold transition-colors" style={{backgroundColor:theme.card,border:`1px solid ${theme.border}`}}>Cancel</button><button disabled={editSaving||!editBody.trim()} onClick={()=>savePostEdit(p)} className="px-4 py-2 rounded-full text-xs font-bold disabled:opacity-50 transition-opacity" style={{backgroundColor:theme.accent,color:theme.pillTextActive}}>{editSaving?'Saving...':'Save changes'}</button></div></div>:<>
                <div className="flex items-center gap-2 mt-1">{p.is_pinned&&<span className="nkc-moderation-label">📌 Pinned</span>}{p.comments_locked&&<span className="nkc-moderation-label">🔒 Comments locked</span>}{p.moderator_edited_at&&<span className="nkc-moderation-label">Edited by moderator</span>}</div>
                <p className="mt-1 whitespace-pre-wrap break-words">{p.body||p.content}</p>{p.image_url&&<div className="mt-3 nkc-post-image-frame rounded-xl overflow-hidden border" style={{borderColor:theme.border,backgroundColor:theme.input}} onContextMenu={event=>event.preventDefault()}><img src={p.image_url} alt="post" className="nkc-post-image w-full" loading="lazy" draggable={false} onDragStart={event=>event.preventDefault()} /></div>}<p className="text-xs opacity-40 mt-2">{new Date(p.created_at).toLocaleString()}</p><div className={`mt-3 pt-3 border-t flex gap-3 min-w-0 ${hasCustomThemeIcons(theme.id)?'nkc-custom-theme-post-actions':''}`} style={{borderColor:theme.border}}><button onClick={()=>togglePostLike(p.id)} className="shrink-0 text-xs font-bold transition-colors hover:opacity-70">{hasCustomThemeIcons(theme.id)?<><ThemeIcon themeId={theme.id} name="like" alt="Like" className={`nkc-custom-theme-action-icon ${liked?'is-active':''}`}/><span>{pLikes.length}</span></>:<>{liked?'❤️':'🤍'} {pLikes.length}</>}</button><button onClick={()=>setOpenComments(prev=>({...prev,[p.id]:!prev[p.id]}))} className="shrink-0 text-xs font-bold opacity-60 transition-opacity hover:opacity-100">{hasCustomThemeIcons(theme.id)?<><ThemeIcon themeId={theme.id} name="comment" alt="Comments" className="nkc-custom-theme-action-icon"/><span>{cList.length}</span></>:<>💬 {cList.length} {isOpen?'▲':'▼'}</>}</button>{!isOwner&&<button onClick={()=>profile?setReportingPost(p):setShowJoin(true)} className="ml-auto shrink-0 text-xs font-bold opacity-55 hover:opacity-100">{hasCustomThemeIcons(theme.id)?<ThemeIcon themeId={theme.id} name="report" alt="Report" className="nkc-custom-theme-action-icon"/>:<>🚩 Report</>}</button>}</div>{isOpen&&<div className="mt-3 rounded-xl p-2 sm:p-3 space-y-2 min-w-0 overflow-hidden" style={{backgroundColor:theme.input}}>{cList.map((c:any)=>{const cl=cLikes[c.id]||[];const cliked=cl.some((l:any)=>l.author_id===profile?.user_id||l.author_name===profile?.full_name);const canDelC=(profile&&c.author_name===profile.full_name)||isAdmin;return <div key={c.id} className="text-sm rounded-lg p-2 flex justify-between gap-2 min-w-0" style={{backgroundColor:theme.card}}><div className="min-w-0 break-words"><b className="text-xs">{c.author_name}:</b> <span className="break-words">{c.content||c.body}</span><button onClick={()=>toggleCommentLike(c.id)} className="ml-3 text-xs transition-colors hover:opacity-70">{cliked?'❤️':'🤍'} {cl.length}</button></div>{canDelC&&<button onClick={()=>deleteComment(c.id,p.id)} className="shrink-0 text-[10px] opacity-30 hover:opacity-100 transition-opacity">🗑️</button>}</div>})}{p.comments_locked?<p className="text-xs font-bold opacity-60 text-center py-2">🔒 Comments are locked by a moderator.</p>:<div className="flex gap-2 pt-2 min-w-0"><input value={commentText[p.id]||''} onChange={e=>setCommentText(prev=>({...prev,[p.id]:e.target.value}))} placeholder="Add a comment..." className="min-w-0 flex-1 border rounded-full px-3 py-2 text-sm outline-none transition-colors" style={{backgroundColor:theme.card,borderColor:theme.border,color:theme.text}} onKeyDown={(e)=>{if(e.key==='Enter' && !e.shiftKey){e.preventDefault();addComment(p.id);}}}/><button onClick={()=>addComment(p.id)} disabled={isCommenting || !commentText[p.id]?.trim()} className="shrink-0 px-3 sm:px-4 py-2 rounded-full text-xs font-bold disabled:opacity-50 transition-opacity" style={{backgroundColor:theme.accent,color:theme.pillTextActive}}>{isCommenting?'...':'Reply'}</button></div>}</div>}
              </>}
            </div>
            );
          })}
        </main>

        <aside className="rounded-2xl p-5 border h-fit nkc-surface" style={{backgroundColor: theme.card, borderColor: theme.border}}>
          <h3 className="font-black">{cur?.name}</h3>
          <p className="text-xs opacity-60">{cur?.zip} · Kansas City, MO</p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="rounded-xl p-3 text-center" style={{backgroundColor: theme.input}}>
              <b className="text-lg">{neighborCount ?? cur?.member_count ?? 0}</b>
              <p className="text-xs">NEIGHBORS</p>
            </div>
            <div className="rounded-xl p-3 text-center" style={{backgroundColor: theme.input}}>
              <b className="text-lg">{scopedPosts.length}</b>
              <p className="text-xs">{scope==='kc'?'KC POSTS':'LOCAL POSTS'}</p>
            </div>
          </div>
        </aside>
      </div>

      <footer className="max-w-6xl mx-auto px-6 pb-24 pt-2 text-center text-xs opacity-50">
        <span>© 2026 Neighborly KC</span>
        <span className="mx-2">·</span>
        <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>
        <span className="mx-2">·</span>
        <a href="/terms" className="underline underline-offset-2">Terms of Service</a>
      </footer>

      <nav
        className="nkc-mobile-actions nkc-mobile-bottom-nav"
        data-theme={theme.id}
        aria-label="Mobile navigation"
        style={{backgroundColor:theme.header,color:navThemeColor,borderColor:theme.border,'--nkc-bottom-inactive':navThemeColor,'--nkc-bottom-glow':theme.accent,'--nkc-bottom-surface':theme.card} as any}
      >
        <Link
          href="/dms"
          aria-label="Messages"
          className="nkc-bottom-nav-orb-item"
          style={{color:navThemeColor}}
        >
          {hasCustomThemeIcons(theme.id)?<ThemeIcon themeId={theme.id} name="dms" alt="" className="nkc-custom-theme-nav-icon"/>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 3v-14Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 9h8M8 12.5h5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}
          <span className="sr-only">Messages</span>
        </Link>

        <button
          type="button"
          aria-label="Create post"
          title="Create post"
          className="nkc-bottom-nav-plus"
          onClick={()=>{ if(!profile){ setShowJoin(true); return; } setShowSettings(false); setShowExplore(false); setShowCreatePost(true); }}
          style={{color:navThemeColor}}
        >
          {hasCustomThemeIcons(theme.id)?<ThemeIcon themeId={theme.id} name="create_post" alt="" className="nkc-custom-theme-plus-icon"/>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg>}
        </button>

        <button
          type="button"
          aria-label="Settings"
          className={`nkc-bottom-nav-orb-item ${showSettings?'is-active':''}`}
          onClick={()=>{setShowJoin(false);setReportingPost(null);setShowExplore(false);setShowSettings(true);}}
          style={showSettings?{backgroundColor:theme.pillActive,color:theme.pillTextActive}:{color:navThemeColor}}
        >
          {hasCustomThemeIcons(theme.id)?<ThemeIcon themeId={theme.id} name="settings" alt="" className="nkc-custom-theme-nav-icon"/>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.7 3.6h4.6l.6 2.1 1.8 1 2.1-.5 2.3 4-1.5 1.6v2.1l1.5 1.6-2.3 4-2.1-.5-1.8 1-.6 2.1H9.7L9.1 20l-1.8-1-2.1.5-2.3-4 1.5-1.6v-2.1L2.9 10l2.3-4 2.1.5 1.8-1z" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinejoin="round"/><circle cx="12" cy="12.8" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>}
          <span className="sr-only">Settings</span>
        </button>
      </nav>

      {showCreatePost && (
        <div className="nkc-create-post-screen nkc-pop-in" style={{backgroundColor:theme.bg,color:theme.text}} role="dialog" aria-modal="true" aria-labelledby="create-post-title">
          <header className="nkc-create-post-header" style={{backgroundColor:theme.header,borderColor:theme.border}}>
            <button type="button" onClick={()=>setShowCreatePost(false)} className="nkc-create-post-close" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}} aria-label="Close create post">✕</button>
            <div className="min-w-0 text-center">
              {hasCustomThemeIcons(theme.id)&&<ThemeIcon themeId={theme.id} name="create_post" alt="" className="nkc-custom-theme-create-header"/>}
              <p className="text-[10px] font-black uppercase tracking-[.16em] opacity-60">NeighborlyKC</p>
              <h2 id="create-post-title" className="text-lg font-black">Create a post</h2>
            </div>
            <div className="nkc-create-post-close-spacer" aria-hidden="true" />
          </header>

          <main className="nkc-create-post-content">
            <section className="nkc-create-post-card" style={{backgroundColor:theme.card,borderColor:theme.border}}>
              <label htmlFor="full-post-category" className="nkc-create-post-label">Post category</label>
              <select id="full-post-category" value={postCategory} onChange={e=>{const next=e.target.value;if(next==='For Sale & Free'){setShowCreatePost(false);window.location.href='/forsale?create=1';return;}setPostCategory(next)}} className="nkc-create-post-select" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>
                {CATS.filter(c=>c!=='All').map(c=><option key={c} value={c}>{c}</option>)}
              </select>

              <label className="nkc-create-post-label mt-5">Who should see this?</label>
              <div className="nkc-create-post-scope" style={{backgroundColor:theme.input,borderColor:theme.border}}>
                <button type="button" onClick={()=>setScope('local')} style={{backgroundColor:scope==='local'?theme.pillActive:'transparent',color:scope==='local'?theme.pillTextActive:theme.text}}>📍 My Area</button>
                <button type="button" onClick={()=>setScope('kc')} style={{backgroundColor:scope==='kc'?theme.pillActive:'transparent',color:scope==='kc'?theme.pillTextActive:theme.text}}>🏙️ All KC</button>
              </div>

              <div className="nkc-create-post-destination" style={{backgroundColor:theme.input,borderColor:theme.border}}>
                Posting to: <strong style={{color:theme.accent}}>{scope==='kc'?'All Kansas City':cur?.name || 'your neighborhood'}</strong>
              </div>

              <label htmlFor="full-post-body" className="nkc-create-post-label mt-5">Your post</label>
              <textarea id="full-post-body" ref={fullPostComposerRef} value={body} onChange={e=>setBody(e.target.value)} autoComplete="off" autoCorrect="on" autoCapitalize="sentences" spellCheck={true} inputMode="text" placeholder={postCategory==='Safety Alert'?'Share a safety alert with Kansas City…':postCategory==='For Sale & Free'?'Describe what you are selling or giving away…':postCategory==='Event'?'Tell Kansas City about the event…':postCategory==='Lost & Found'?'Describe the lost or found item…':'What should Kansas City know?'} className="nkc-create-post-textarea" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border,caretColor:theme.accent,'--nkc-placeholder-color':theme.text} as any} />

              <div className="nkc-create-post-file-row">
                <label htmlFor="full-post-file" className="nkc-create-post-file" style={{backgroundColor:theme.input,borderColor:theme.border}}>📷 Choose image</label>
                <input key={`full-${fileInputKey}`} id="full-post-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)} className="sr-only" />
                {file&&<div className="nkc-create-post-filename"><span>{file.name}</span><button type="button" onClick={()=>{setFile(null);setFileInputKey(k=>k+1)}} aria-label="Remove selected image">✕</button></div>}
              </div>

              <button type="button" disabled={uploading||(!body.trim()&&!file)} onClick={handleBePost} className="nkc-create-post-submit" style={{backgroundColor:theme.accent,color:theme.pillTextActive,boxShadow:`0 10px 28px ${theme.accent}44`}}>{uploading?'Posting…':scope==='kc'?'Post to Kansas City':'Post to My Area'}</button>
            </section>
          </main>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1050] flex items-center justify-center p-2 sm:p-4 nkc-pop-in">
          <div className="rounded-[24px] w-full max-w-sm p-3 sm:p-5 border max-h-[90vh] overflow-y-auto nkc-settings-modal" style={{backgroundColor:theme.card,borderColor:theme.border,color:theme.text}}>
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h2 className="font-black text-lg sm:text-xl" style={{color:theme.text}}>Settings</h2>
              <button 
                onClick={()=>{setShowSettings(false);setShowThemePicker(false);setShowExplore(false)}} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-opacity hover:opacity-80" style={{backgroundColor:theme.input,color:theme.text,border:`1px solid ${theme.border}`}}
              >
                ✕
              </button>
            </div>
            
            <button 
              type="button" 
              onClick={()=>setShowThemePicker(true)} 
              className="w-full flex items-center justify-between py-3 px-4 rounded-2xl border font-bold text-sm sm:text-base" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}
            >
              <span>🎨 Themes</span>
              <span className="opacity-60">›</span>
            </button>

            {showExplore&&<div className="nkc-explore-links mt-3 grid grid-cols-2 gap-2">
              <Link href="/dms" className="rounded-2xl border px-3 py-3 text-center text-sm font-bold" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>💬 Messages</Link>
              <Link href="/people" className="rounded-2xl border px-3 py-3 text-center text-sm font-bold" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>👥 People</Link>
              <Link href="/connections" className="rounded-2xl border px-3 py-3 text-center text-sm font-bold" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>🤝 Connections</Link>
              <button type="button" onClick={()=>setShowThemePicker(true)} className="rounded-2xl border px-3 py-3 text-center text-sm font-bold" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>🎨 Themes</button>
            </div>}
            
            {profile
              ? <Link href="/profile" onClick={()=>setShowSettings(false)} className="mt-3 sm:mt-4 block w-full py-3 rounded-full border font-bold text-center text-sm sm:text-base" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>👤 My Profile</Link>
              : <button type="button" onClick={()=>{setShowSettings(false);setShowJoin(true)}} className="mt-3 sm:mt-4 block w-full py-3 rounded-full border font-bold text-center text-sm sm:text-base" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>👤 Profile · Sign in</button>}

            {profile&&<Link href="/dms" onClick={()=>setShowSettings(false)} className="mt-2 block w-full py-3 rounded-full border font-bold text-center text-sm sm:text-base" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>💬 Messages</Link>}
            
            <button onClick={()=>{if(!profile){setShowSettings(false);setShowJoin(true);return;}setShowSettings(false);setShowThemePicker(false);setShowExplore(false);setShowFeedback(true)}} className="mt-2 w-full py-3 rounded-full border font-bold text-sm sm:text-base" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>💬 Leave Feedback</button>
            
            {profile&&<button type="button" onClick={signOut} className="mt-2 w-full py-3 rounded-full border font-bold text-sm sm:text-base" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>🚪 Sign out</button>}
            
            <button type="button" onClick={()=>{setShowSettings(false);setShowThemePicker(false);setShowExplore(false)}} className="mt-2 w-full py-3 rounded-full font-bold text-sm sm:text-base" style={{backgroundColor:theme.pillActive,color:theme.pillTextActive}}>Done</button>
          </div>
        </div>
      )}

      {showThemePicker && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[1100] flex items-center justify-center p-3 sm:p-5 nkc-pop-in" role="dialog" aria-modal="true" aria-labelledby="theme-picker-title">
          <div className="rounded-[28px] w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6 border nkc-settings-modal" style={{backgroundColor:theme.card,borderColor:theme.border,color:theme.text}}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] opacity-45">NeighborlyKC</p>
                <h2 id="theme-picker-title" className="mt-1 font-black text-xl sm:text-2xl">Choose your theme</h2>
              </div>
              <button type="button" onClick={()=>setShowThemePicker(false)} className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80" style={{backgroundColor:theme.input,color:theme.text,border:`1px solid ${theme.border}`}} aria-label="Close theme picker">✕</button>
            </div>
            <p className="mt-2 text-xs leading-5 opacity-65">Pick a NeighborlyKC look. Your choice saves automatically.</p>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              {['aim','sporting','royals','chiefs','pip-boy','space','kc-current','kcpd','kcfd','army','navy','marines','air-force','cowtown','kc-bbq','18th-vine','river-market','city-fountains'].map(id=>{
                const t=THEMES[id];
                const active=themeId===id;
                return <button
                  key={id}
                  type="button"
                  aria-label={`Use ${t.name} theme`}
                  data-theme-choice={id}
                  onClick={(event)=>{event.preventDefault();event.stopPropagation();setTheme(id)}}
                  className={`nkc-theme-choice relative aspect-square w-full overflow-hidden rounded-xl border-2 transition-all hover:scale-105 active:scale-95 ${active?'is-active':''}`}
                  style={{borderColor:active?t.accent:'rgba(255,255,255,0.15)',boxShadow:active?`0 0 0 2px ${t.accent}55`:'none'}}
                >
                  {t.themeButtonImage
                    ? <img src={t.themeButtonImage} alt={t.name} className="w-full h-full object-cover" loading="lazy" />
                    : <div className="nkc-theme-choice-fallback w-full h-full flex items-center justify-center p-1 text-center" style={{background:`linear-gradient(135deg,${t.header},${t.accent})`}}><span className="text-white text-[8px] sm:text-[10px] font-bold leading-tight">{t.name}</span></div>}
                  {active && <span className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-lg" style={{backgroundColor:t.accent,color:t.pillTextActive}}>✓</span>}
                </button>
              })}
            </div>
          </div>
        </div>
      )}

      {showFeedback && <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4 nkc-pop-in">
        <div className="rounded-[24px] w-full max-w-sm p-5 border" style={{backgroundColor:theme.card,borderColor:theme.border}}>
          <div className="flex justify-between items-center"><div><h2 className="font-black text-xl">Leave Feedback</h2><p className="text-xs opacity-60 mt-1">Tell Jason what you think about Neighborly KC.</p></div><button onClick={()=>setShowFeedback(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{backgroundColor:theme.input}}>✕</button></div>
          <textarea autoFocus maxLength={2000} value={feedbackText} onChange={e=>setFeedbackText(e.target.value)} placeholder="What should we improve?" className="mt-4 w-full min-h-[150px] rounded-2xl p-3 text-sm outline-none border" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}} />
          <div className="flex items-center justify-between mt-2 text-[10px] opacity-50"><span>Your account email will be included so we can reply.</span><span>{feedbackText.length}/2000</span></div>
          <div className="flex gap-2 mt-4"><button onClick={()=>setShowFeedback(false)} className="flex-1 py-3 rounded-full font-bold" style={{backgroundColor:theme.input}}>Cancel</button><button disabled={!feedbackText.trim()||feedbackSending} onClick={submitFeedback} className="flex-1 py-3 rounded-full font-bold disabled:opacity-50" style={{backgroundColor:theme.accent,color:theme.pillTextActive}}>{feedbackSending?'Sending…':'Send Feedback'}</button></div>
        </div>
      </div>}

      {reportingPost && <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4 nkc-pop-in">
        <div className="rounded-[24px] w-full max-w-sm p-5 border" style={{backgroundColor:theme.card,borderColor:theme.border}}>
          <div className="flex justify-between gap-3"><div><h2 className="font-black text-xl">Report post</h2><p className="text-xs opacity-60 mt-1">A moderator will review your report.</p></div><button onClick={()=>setReportingPost(null)} className="w-8 h-8 rounded-full" style={{backgroundColor:theme.input}}>✕</button></div>
          <label className="block mt-4 text-xs font-black">Reason</label>
          <select value={reportReason} onChange={e=>setReportReason(e.target.value)} className="mt-2 w-full rounded-xl p-3 border" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}><option>Harassment or bullying</option><option>Hate or abusive language</option><option>Threats or violence</option><option>Sexual or inappropriate content</option><option>Spam or scam</option><option>Private information</option><option>Other</option></select>
          <textarea value={reportDetails} maxLength={500} onChange={e=>setReportDetails(e.target.value)} placeholder="Add details (optional)" className="mt-3 w-full min-h-[100px] rounded-xl p-3 border" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}/>
          <div className="flex gap-2 mt-4"><button onClick={()=>setReportingPost(null)} className="flex-1 py-3 rounded-full font-bold" style={{backgroundColor:theme.input}}>Cancel</button><button disabled={reportSending} onClick={submitPostReport} className="flex-1 py-3 rounded-full font-bold disabled:opacity-50" style={{backgroundColor:theme.accent,color:theme.pillTextActive}}>{reportSending?'Sending…':'Send report'}</button></div>
        </div>
      </div>}

      {feedbackSent && <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[80] rounded-full px-5 py-3 shadow-xl font-bold text-sm nkc-pop-in" style={{backgroundColor:theme.card,color:theme.text,border:`1px solid ${theme.border}`}}>✓ Feedback sent — thank you!</div>}

      {(postSuccess || toast) && <div role="status" aria-live="polite" className="fixed left-1/2 -translate-x-1/2 bottom-[86px] sm:bottom-6 z-[120] rounded-2xl px-5 py-3 shadow-xl font-bold text-sm nkc-pop-in max-w-[calc(100vw-32px)] text-center" style={{backgroundColor:theme.card,color:theme.text,border:`1px solid ${theme.border}`}}>{postSuccess?'✓ Post published':toast}</div>}

      {showJoin && (
        <div className="nkc-auth-overlay fixed inset-0 bg-black/70 backdrop-blur-md z-[1200] flex items-center justify-center p-4">
          <div className="nkc-auth-card rounded-[28px] w-full max-w-sm p-6 shadow-2xl border" style={{backgroundColor: theme.card, borderColor: theme.border, '--nkc-auth-muted':theme.subtext} as any}>
            <h2 className="font-black text-xl">Join NeighborlyKC</h2><p className="text-xs opacity-70 mt-1">Connect with neighbors across the Kansas City area.</p>
            <div className="nkc-auth-google mt-5 min-h-[44px] flex items-center justify-center">
              {embeddedBrowser
                ? <div role="alert" className="w-full rounded-2xl border p-4 text-left" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}>
                    <h3 className="font-black text-base">Open NeighborlyKC in your regular browser</h3>
                    <p className="mt-2 text-xs leading-5 opacity-80">Google sign-in cannot reliably finish inside Facebook, Messenger, Instagram, or another app&apos;s built-in browser.</p>
                    <p className="mt-2 text-xs leading-5 font-semibold">Tap this app&apos;s menu (usually <b>•••</b>), then choose <b>Open in browser</b>, <b>Open in Safari</b>, or <b>Open in Chrome</b>. You can use Safari, Chrome, Firefox, Edge, Samsung Internet, or whichever regular browser you prefer.</p>
                    <button type="button" onClick={copyRegularBrowserLink} className="mt-3 w-full py-2.5 rounded-full font-black text-sm" style={{backgroundColor:theme.accent,color:theme.pillTextActive}}>{browserLinkCopied?'✓ Link copied':'Copy NeighborlyKC link'}</button>
                  </div>
                : googleLoading
                ? <div className="w-full bg-white border-2 border-black text-black py-3.5 rounded-full font-bold text-sm text-center">Signing in…</div>
                : <div ref={googleButtonRef} className="nkc-google-button-slot flex justify-center w-full" aria-label="Continue with Google" />}
            </div>
            <div className="nkc-auth-divider-row flex items-center gap-3 my-5"><div className="h-px flex-1" style={{backgroundColor:theme.border}}></div><span className="nkc-auth-divider text-xs font-bold">{embeddedBrowser?'OR USE EMAIL INSTEAD':'OR EMAIL LINK'}</span><div className="h-px flex-1" style={{backgroundColor:theme.border}}></div></div>
            <div className="space-y-3">
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name (optional)" className="nkc-themed-field w-full border rounded-xl px-4 py-3 text-sm outline-none" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}/>
              <input value={email} onChange={e=>setEmail(e.target.value)} inputMode="email" autoComplete="email" placeholder="Email address" className="nkc-themed-field w-full border rounded-xl px-4 py-3 text-sm outline-none" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}/>
              {!emailCodeSent && <input value={joinZip} onChange={e=>setJoinZip(e.target.value.replace(/\D/g,'').slice(0,5))} inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="KC-area ZIP code (optional)" className="nkc-themed-field w-full border rounded-xl px-4 py-3 text-sm outline-none" style={{backgroundColor:theme.input,color:theme.text,borderColor:theme.border}}/>}
              {!emailCodeSent && <p className="px-1 text-[11px] leading-4 font-semibold opacity-65">Your ZIP helps us find nearby conversations. Your exact address is never shown publicly.</p>}
              {emailCodeSent && <div className="rounded-xl p-3 text-xs leading-5" style={{backgroundColor:theme.input,color:theme.text}}><b>Check your email</b><br/>Tap the secure sign-in link we sent you. You can close this window after opening the link.</div>}
              {emailAuthMessage && <p className="text-xs font-semibold text-center opacity-70">{emailAuthMessage}</p>}
              <div className="nkc-auth-buttons flex gap-2 pt-2"><button type="button" onClick={()=>setShowJoin(false)} className="flex-1 py-3 rounded-full font-bold text-sm" style={{backgroundColor:'#f8f5ee',color:'#1f2937'}}>Cancel</button><button type="button" disabled={emailAuthLoading||!email.trim()} onClick={sendEmailLoginCode} className="nkc-auth-action flex-1 py-3 rounded-full font-bold text-sm" style={{backgroundColor:theme.accent,color:theme.pillTextActive}}>{emailAuthLoading?'Sending…':emailCodeSent?'Email Link Again':'Email Me a Link'}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
