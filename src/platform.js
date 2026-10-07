'use strict';
// Bridge between the web build and the Capacitor Android shell.
// In a browser or installed PWA every function falls back to standard web behaviour.
const Platform=(()=>{
const cap=window.Capacitor,native=Boolean(cap?.isNativePlatform?.());
const plugin=name=>native?cap.Plugins?.[name]:undefined;

// Resolves true when the file was handed off, false when the player cancelled the share sheet.
async function exportFile(name,text){
  const fs=plugin('Filesystem'),share=plugin('Share');
  if(fs&&share){
    const {uri}=await fs.writeFile({path:name,data:text,directory:'CACHE',encoding:'utf8'});
    try{await share.share({title:name,dialogTitle:'ส่งออกไฟล์เซฟ',files:[uri]});}
    catch(error){if(/cancel/i.test(error?.message||''))return false;throw error;}
    return true;
  }
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  return true;
}

// handler returns true when it consumed the back press; otherwise the app goes to the background.
function onBack(handler){
  const app=plugin('App');
  if(app)app.addListener('backButton',()=>{if(!handler())app.minimizeApp();});
}

if(!native&&'serviceWorker' in navigator&&location.protocol==='https:')
  addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

return {native,exportFile,onBack};
})();
