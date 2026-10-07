// WILDLAND app icon: a campfire under a moonlit ridge.
// Art is drawn on a 1024 canvas. The foreground stays inside the central
// adaptive-icon safe zone (radius ~340) except the ground, which bleeds.

export const COLORS={splash:'#111713'};

export const background=`
<defs>
  <radialGradient id="sky" cx="50%" cy="78%" r="80%">
    <stop offset="0" stop-color="#4d5f2e"/>
    <stop offset=".45" stop-color="#283b22"/>
    <stop offset="1" stop-color="#101a12"/>
  </radialGradient>
</defs>
<rect width="1024" height="1024" fill="url(#sky)"/>
<g fill="#e8ecc8">
  <circle cx="300" cy="300" r="5" opacity=".75"/>
  <circle cx="392" cy="236" r="3.5" opacity=".55"/>
  <circle cx="240" cy="420" r="3" opacity=".5"/>
  <circle cx="770" cy="470" r="3.5" opacity=".5"/>
  <circle cx="520" cy="250" r="3" opacity=".45"/>
</g>
<path d="M-40 1064V748q260-58 552-58t552 58v316Z" fill="#0c140d"/>`;

export const foreground=`
<defs>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#ffb347" stop-opacity=".55"/>
    <stop offset=".55" stop-color="#f28c28" stop-opacity=".16"/>
    <stop offset="1" stop-color="#f28c28" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="#e2572a"/>
    <stop offset=".55" stop-color="#f59a2f"/>
    <stop offset="1" stop-color="#ffd36a"/>
  </linearGradient>
  <linearGradient id="ridge" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#6a8a4c"/>
    <stop offset="1" stop-color="#2f4128"/>
  </linearGradient>
  <mask id="crescent">
    <circle cx="660" cy="330" r="66" fill="#fff"/>
    <circle cx="690" cy="306" r="58" fill="#000"/>
  </mask>
</defs>
<g transform="translate(512 512) scale(1.1) translate(-512 -556)">
<rect x="594" y="264" width="140" height="140" fill="#eef1d2" mask="url(#crescent)"/>
<path d="M120 760 330 500 410 560 540 380 640 470 700 430 904 760Z" fill="url(#ridge)"/>
<path d="M540 380 500 436 532 424 548 452 574 418 600 434Z" fill="#c1d49b" opacity=".9"/>
<path d="M330 500 300 538 326 532 342 548 360 526Z" fill="#c1d49b" opacity=".65"/>
<circle cx="512" cy="760" r="230" fill="url(#glow)"/>
<g fill="#0c140d">
  <path d="M300 470 236 590h34l-56 92h40l-66 108h224l-66-108h40l-56-92h34Z"/>
  <path d="M736 520 686 612h28l-46 76h34l-56 92h180l-56-92h34l-46-76h28Z"/>
</g>
<g transform="translate(512 742) scale(1.15)">
  <path d="M-92 46 84 -6 96 18 -80 70Z" fill="#6b4428"/>
  <path d="M92 46 -84 -6 -96 18 80 70Z" fill="#7d5130"/>
  <path d="M0 -150C40 -96 78 -64 66 -12 58 22 30 40 0 40s-58-18-66-52C-78-64-40-96 0-150Z" fill="url(#flame)"/>
  <path d="M2 -70C22 -40 38 -22 32 4 28 22 16 30 2 30s-28-8-32-26C-34-22-16-40 2-70Z" fill="#ffe7a0"/>
</g>
</g>`;

// Android 13+ themed icon: alpha-only silhouette that the launcher tints.
export const monochrome=`
<defs><mask id="crescent-mono">
  <circle cx="660" cy="330" r="66" fill="#fff"/>
  <circle cx="690" cy="306" r="58" fill="#000"/>
</mask></defs>
<g transform="translate(512 512) scale(1.1) translate(-512 -556)" fill="#fff">
  <rect x="594" y="264" width="140" height="140" mask="url(#crescent-mono)"/>
  <path d="M120 760 330 500 410 560 540 380 640 470 700 430 904 760Z" opacity=".38"/>
  <path d="M300 470 236 590h34l-56 92h40l-66 108h224l-66-108h40l-56-92h34Z"/>
  <path d="M736 520 686 612h28l-46 76h34l-56 92h180l-56-92h34l-46-76h28Z"/>
  <g transform="translate(512 742) scale(1.15)">
    <path d="M-92 46 84 -6 96 18 -80 70Z"/>
    <path d="M92 46 -84 -6 -96 18 80 70Z"/>
    <path d="M0 -150C40 -96 78 -64 66 -12 58 22 30 40 0 40s-58-18-66-52C-78-64-40-96 0-150Z"/>
  </g>
</g>`;

const wrap=(body,size)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${body}</svg>`;

// scale shrinks the art toward the centre (used for maskable/adaptive padding)
const scaled=(body,scale)=>scale===1?body:`<g transform="translate(${512*(1-scale)} ${512*(1-scale)}) scale(${scale})">${body}</g>`;

export function art({size=1024,shape='square',scale=1,layers='both'}={}){
  if(layers==='monochrome')return wrap(scaled(monochrome,scale),size);
  const fg=layers==='background'?'':scaled(foreground,scale);
  const bg=layers==='foreground'?'':background;
  let body=bg+fg;
  if(shape!=='square'){
    const clip=shape==='circle'?'<circle cx="512" cy="512" r="512"/>':'<rect width="1024" height="1024" rx="230"/>';
    body=`<defs><clipPath id="shape">${clip}</clipPath></defs><g clip-path="url(#shape)">${body}</g>`;
  }
  return wrap(body,size);
}
