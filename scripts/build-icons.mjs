// Renders every icon from scripts/icon-art.mjs:
// web/PWA icons into icons/, and Android launcher icons + splash screens into android/.
// Run after changing the art: npm run build:icons
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {art, COLORS} from './icon-art.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const png=(svg,file)=>sharp(Buffer.from(svg)).png({compressionLevel:9}).toFile(file);

// Web / PWA
const web=join(root,'icons');
mkdirSync(web,{recursive:true});
writeFileSync(join(web,'icon.svg'),art({size:512,shape:'rounded'})+'\n');
await png(art({size:32,shape:'rounded'}),join(web,'favicon-32.png'));
await png(art({size:192,shape:'rounded'}),join(web,'icon-192.png'));
await png(art({size:512,shape:'rounded'}),join(web,'icon-512.png'));
await png(art({size:512,scale:.84}),join(web,'maskable-512.png'));
await png(art({size:180}),join(web,'apple-touch-icon.png'));

// Android
const res=join(root,'android/app/src/main/res');
if(existsSync(res)){
  const densities={mdpi:1,hdpi:1.5,xhdpi:2,xxhdpi:3,xxxhdpi:4};
  for(const [name,d] of Object.entries(densities)){
    const dir=join(res,`mipmap-${name}`);
    mkdirSync(dir,{recursive:true});
    await png(art({size:48*d,shape:'rounded'}),join(dir,'ic_launcher.png'));
    await png(art({size:48*d,shape:'circle'}),join(dir,'ic_launcher_round.png'));
    // Adaptive layers are 108dp; the launcher shows the central 72dp.
    await png(art({size:108*d,layers:'foreground',scale:.88}),join(dir,'ic_launcher_foreground.png'));
    await png(art({size:108*d,layers:'background'}),join(dir,'ic_launcher_background.png'));
    await png(art({size:108*d,layers:'monochrome',scale:.88}),join(dir,'ic_launcher_monochrome.png'));
  }
  const adaptive=`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
  mkdirSync(join(res,'mipmap-anydpi-v26'),{recursive:true});
  writeFileSync(join(res,'mipmap-anydpi-v26/ic_launcher.xml'),adaptive);
  writeFileSync(join(res,'mipmap-anydpi-v26/ic_launcher_round.xml'),adaptive);

  // Pre-Android 12 splash: the icon centred on the app background, at each existing splash size.
  for(const dir of readdirSync(res).filter(name=>/^drawable(-(port|land)-\w+)?$/.test(name))){
    const file=join(res,dir,'splash.png');
    if(!existsSync(file))continue;
    const {width,height}=await sharp(readFileSync(file)).metadata();
    const size=Math.round(Math.min(width,height)*.32);
    const icon=await sharp(Buffer.from(art({size,shape:'rounded'}))).png().toBuffer();
    await sharp({create:{width,height,channels:4,background:COLORS.splash}})
      .composite([{input:icon,left:Math.round((width-size)/2),top:Math.round((height-size)/2)}])
      .png({compressionLevel:9}).toBuffer()
      .then(buffer=>writeFileSync(file,buffer));
  }
}

console.log('icons ready');
