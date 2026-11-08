// Camera state belongs to this device. It never changes task positions or priority.
export const MIN_MAP_ZOOM=.18,MAX_MAP_ZOOM=2;
export const clampMapZoom=z=>Math.max(MIN_MAP_ZOOM,Math.min(MAX_MAP_ZOOM,Number.isFinite(z)?z:1));
export function zoomMapAt(camera,nextZoom,point){
 const z=clampMapZoom(nextZoom),prior=clampMapZoom(camera.z);
 return {x:point.x-(point.x-camera.x)*z/prior,y:point.y-(point.y-camera.y)*z/prior,z};
}
export function fitMap(world,width,height,padding=24){
 const z=clampMapZoom(Math.min((Math.max(1,width)-padding*2)/world.w,(Math.max(1,height)-padding*2)/world.h,1));
 return {x:(width-world.w*z)/2,y:(height-world.h*z)/2,z};
}
export function overviewLayout(groups,counts={},compact=false){
 const w=640,gap=24,h=440,sideH=(h*2-gap)/3;
 const order=[1,2,3,4,0,5,6];
 const zones=groups.map((g,i)=>compact?{...g,x:(order.indexOf(i)%2)*(w+gap),y:Math.floor(order.indexOf(i)/2)*(h+gap),w,h,columns:3}:i>=1&&i<=4?{...g,x:((i-1)%2)*(w+gap),y:Math.floor((i-1)/2)*(h+gap),w,h,columns:3}:{...g,x:2*(w+gap),y:([0,5,6].indexOf(i))*(sideH+gap),w,h:sideH,columns:5});
 return {zones,w:(compact?2:3)*w+(compact?1:2)*gap,h:compact?4*h+3*gap:2*h+gap};
}
export function groupDigest(items,today){
 const owners=new Map();for(const task of items){const name=task.owner||'Не назначен';owners.set(name,(owners.get(name)||0)+1)}
 return {owners:[...owners].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ru')),overdue:items.filter(t=>t.due&&t.due<today&&!['Готово','Отменено'].includes(t.status)).length,scheduled:items.filter(t=>t.due).length};
}
export function focusMapZone(zone,width,height,padding=24){
 const z=clampMapZoom(Math.min((Math.max(1,width)-padding*2)/zone.w,(Math.max(1,height)-padding*2)/zone.h,1.4));
 return {x:(width-zone.w*z)/2-zone.x*z,y:(height-zone.h*z)/2-zone.y*z,z};
}
