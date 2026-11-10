import {icon} from './icons.mjs?rev=20261111-status-8';
const KEY='gengroup.task-canvas.preferences.v1';
export function savedTheme(storage,systemDark=false){try{const theme=JSON.parse(storage.getItem(KEY)||'{}').theme;return theme==='dark'||theme!=='light'&&systemDark?'dark':'light'}catch{return systemDark?'dark':'light'}}
export function toggleTheme(storage,current){const theme=current==='dark'?'light':'dark';let preferences={};try{preferences=JSON.parse(storage.getItem(KEY)||'{}')||{}}catch{};storage.setItem(KEY,JSON.stringify({...preferences,theme}));return theme}
export function installThemeToggle({button,storage=localStorage,onChange=()=>{},onError=()=>{}}){
 const update=()=>{const theme=savedTheme(storage,matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.dataset.theme=theme;button.setAttribute('aria-label',theme==='dark'?'Включить светлую тему':'Включить тёмную тему');button.title=button.getAttribute('aria-label');button.setAttribute('aria-pressed',String(theme==='dark'));button.innerHTML=icon(theme==='dark'?'sun':'moon');onChange(theme)};
 button.onclick=()=>{try{toggleTheme(storage,document.documentElement.dataset.theme);update()}catch(error){onError(error)}};
 window.addEventListener('storage',e=>{if(e.key===KEY)update()});matchMedia('(prefers-color-scheme:dark)').addEventListener('change',update);update();return {update};
}
