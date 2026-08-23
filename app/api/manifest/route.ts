import { NextRequest, NextResponse } from 'next/server';

const THEME_ICONS: Record<string, {i180:string;i192:string;i512:string}> = {
  "aim": { i180: "/install-icons/aim-180.png", i192: "/install-icons/aim-192.png", i512: "/install-icons/aim-512.png" },
  "air-force": { i180: "/install-icons/air-force-180.png", i192: "/install-icons/air-force-192.png", i512: "/install-icons/air-force-512.png" },
  "army": { i180: "/install-icons/army-180.png", i192: "/install-icons/army-192.png", i512: "/install-icons/army-512.png" },
  "chiefs": { i180: "/install-icons/chiefs-180.png", i192: "/install-icons/chiefs-192.png", i512: "/install-icons/chiefs-512.png" },
  "city-fountains": { i180: "/install-icons/city-fountains-180.png", i192: "/install-icons/city-fountains-192.png", i512: "/install-icons/city-fountains-512.png" },
  "cowtown": { i180: "/install-icons/cowtown-180.png", i192: "/install-icons/cowtown-192.png", i512: "/install-icons/cowtown-512.png" },
  "kc-bbq": { i180: "/install-icons/kc-bbq-180.png", i192: "/install-icons/kc-bbq-192.png", i512: "/install-icons/kc-bbq-512.png" },
  "kc-current": { i180: "/install-icons/kc-current-180.png", i192: "/install-icons/kc-current-192.png", i512: "/install-icons/kc-current-512.png" },
  "kc-sunset": { i180: "/install-icons/kc-sunset-180.png", i192: "/install-icons/kc-sunset-192.png", i512: "/install-icons/kc-sunset-512.png" },
  "kcfd": { i180: "/install-icons/kcfd-180.png", i192: "/install-icons/kcfd-192.png", i512: "/install-icons/kcfd-512.png" },
  "kcpd": { i180: "/install-icons/kcpd-180.png", i192: "/install-icons/kcpd-192.png", i512: "/install-icons/kcpd-512.png" },
  "marines": { i180: "/install-icons/marines-180.png", i192: "/install-icons/marines-192.png", i512: "/install-icons/marines-512.png" },
  "navy": { i180: "/install-icons/navy-180.png", i192: "/install-icons/navy-192.png", i512: "/install-icons/navy-512.png" },
  "pip-boy": { i180: "/install-icons/pip-boy-180.png", i192: "/install-icons/pip-boy-192.png", i512: "/install-icons/pip-boy-512.png" },
  "royals": { i180: "/install-icons/royals-180.png", i192: "/install-icons/royals-192.png", i512: "/install-icons/royals-512.png" },
  "space": { i180: "/install-icons/space-180.png", i192: "/install-icons/space-192.png", i512: "/install-icons/space-512.png" },
  "sporting": { i180: "/install-icons/sporting-180.png", i192: "/install-icons/sporting-192.png", i512: "/install-icons/sporting-512.png" },
};

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('theme') || 'royals';
  const icons = THEME_ICONS[requested] || THEME_ICONS.royals || {
    i180:'/apple-touch-icon.png',
    i192:'/icon-192.png',
    i512:'/icon-512.png'
  };

  return NextResponse.json({
    name: 'Neighborly KC',
    short_name: 'Neighborly KC',
    background_color: '#f0f6ff',
    theme_color: '#004687',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: icons.i192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icons.i512, sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  }, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/manifest+json'
    }
  });
}
