// Device-only presentation preferences. No task fields are read or written here.
export const TILE_KEY='gengroup.task-canvas.tiles.v2';
export const TILE_VIEWS=['detailed','compact','rows'];
export const TILE_CONTEXTS=['priority','owners','time','list','gantt','calendar:day','calendar:week','calendar:month','calendar:months','calendar:range'];
export function cleanTile(value,fallback='detailed'){return {view:TILE_VIEWS.includes(value?.view)?value.view:fallback,columns:Number.isInteger(value?.columns)&&value.columns>=1&&value.columns<=8?value.columns:'auto'}}
export function readTiles(storage,legacy={cards:'detailed',gantt:'compact'}){let raw={};try{raw=JSON.parse(storage.getItem(TILE_KEY)||'{}')||{}}catch{};return Object.fromEntries(TILE_CONTEXTS.map(key=>[key,cleanTile(raw[key],key==='gantt'?legacy.gantt:legacy.cards)]))}
export const tileGridContext=context=>['priority','owners','time','calendar:day'].includes(context);
export function tileMetrics(view='detailed',touch=false){return view==='compact'?{minWidth:232,minHeight:touch?164:144,gap:12}:view==='rows'?{minWidth:touch?156:210,minHeight:touch?128:108,gap:8}:{minWidth:280,minHeight:touch?188:172,gap:16}}
export function tileGridLayout({width,height,count=0,counts=null,view='detailed',columns='auto',touch=false}){
 const w=Math.max(1,Number(width)||1),h=Math.max(0,Number(height)||0),groups=counts?.filter(n=>n>0),n=groups?groups.reduce((a,b)=>a+b,0):Math.max(0,count),m=tileMetrics(view,touch),maxColumns=Math.max(1,Math.min(8,Math.floor((w+m.gap)/(m.minWidth+m.gap)))),manual=Number.isInteger(columns),choices=[];
 for(let cols=manual?Math.min(columns,maxColumns):1;cols<=(manual?Math.min(columns,maxColumns):maxColumns);cols++){
  for(let lanes=1;lanes<=(groups?Math.min(cols,groups.length):1);lanes++){
   const inner=groups?Math.floor(cols/lanes):cols;let rows=0,extra=0;
   if(groups){for(let i=0;i<groups.length;i+=lanes){const r=Math.max(...groups.slice(i,i+lanes).map(k=>Math.ceil(k/inner)));rows+=r;extra+=28+Math.max(0,r-1)*m.gap+(i?m.gap:0)}}else{rows=Math.ceil(n/cols);extra=Math.max(0,rows-1)*m.gap}
   choices.push({columns:cols,lanes:groups?lanes:cols,innerColumns:groups?inner:1,rows,needed:rows*m.minHeight+extra});
  }
 }
 const fitting=choices.filter(c=>c.needed<=h),best=(fitting.length?fitting.sort((a,b)=>a.columns-b.columns||a.needed-b.needed):choices.sort((a,b)=>a.needed-b.needed||a.columns-b.columns))[0];
 return {...best,view,cardHeight:m.minHeight,gap:m.gap,maxColumns,fits:best.needed<=h,total:n,clamped:manual&&columns>maxColumns};
}
export function fitTiles(config){const candidates=TILE_VIEWS.map(view=>tileGridLayout({...config,view,columns:'auto'}));return candidates.find(x=>x.fits)||candidates.at(-1)}
export function applyTileGrid(root,grid,{settings,context,report,applyFit}){
 const bounds=root.getBoundingClientRect(),box=grid.getBoundingClientRect(),style=getComputedStyle(root),config={width:grid.clientWidth,height:Math.max(0,bounds.bottom-box.top-root.scrollTop-(parseFloat(style.paddingBottom)||0)),count:grid.querySelectorAll('.day-board-card').length,view:settings.view,columns:settings.columns,touch:matchMedia('(pointer:coarse)').matches||innerWidth<768};
 const sections=[...grid.querySelectorAll(':scope>.presentation-section')];if(sections.length)config.counts=sections.map(s=>s.querySelectorAll('.day-board-card').length);
 const layout=settings.fit?fitTiles(config):tileGridLayout(config);if(settings.fit){const html=document.documentElement;if(!layout.fits&&(html.dataset.topFolded!=='true'||innerWidth>=768&&html.dataset.sidebarFolded!=='true')){document.dispatchEvent(new Event('task-canvas:focus-space'));return}if(html.dataset.topFolded==='true'&&document.querySelector('#workspace-controls')?.getBoundingClientRect().height>1)return;applyFit({context,view:layout.view,columns:layout.columns});return}
 grid.style.setProperty('--day-columns',layout.columns);grid.style.setProperty('--group-lanes',layout.lanes);grid.style.setProperty('--group-columns',layout.innerColumns);grid.style.setProperty('--tile-height',layout.cardHeight+'px');grid.style.setProperty('--tile-gap',layout.gap+'px');root.dataset.tilesFit=String(layout.fits);
 requestAnimationFrame(()=>{if(root.hidden)return;const r=root.getBoundingClientRect(),cards=[...grid.querySelectorAll('.day-board-card')],shown=cards.filter(c=>{const b=c.getBoundingClientRect();return b.top>=r.top-1&&b.bottom<=Math.min(r.bottom,innerHeight)+1}).length;report({context,maxColumns:layout.maxColumns,columns:layout.columns,shown,total:cards.length,clamped:layout.clamped})});
}
