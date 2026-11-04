// v0.2.187: one work mode determines the relevant operator controls.
const FIELDS=Object.freeze({
 agent:['goal','allow','vision','interval'],deliver:['source','destination'],build:['variant','allow'],
 house:['goal','allow'],preset:['preset','allow'],assist:['destination','goal'],rest:['destination','allow']
});
export function visibleWorkFields(mode,loop=false){
 const fields=new Set(FIELDS[mode]||FIELDS.agent);
 if(mode==='agent'&&loop)fields.add('interval');
 return fields;
}
export function workModeHelp(mode){
 return ({agent:'AI plans ONE checked action at a time. Describe the goal; construction needs permission. Meta calls are billable.',
 deliver:'Select the Pickable object and destination. The robot walks, picks it up, walks again and drops it.',
 build:'Choose one furniture type. The robot finds an open, reachable site, walks there, and builds one item.',
 house:'Describe the building (3–8 m width/depth). The robot chooses a reachable clear site and walks there before building.',
 preset:'Choose a saved preset. The robot will find a clear site and place it with normal editor permissions.',
 assist:'Choose another robot and optionally describe what help to offer.',
 rest:'The robot visits a selected seat or finds/builds one if permitted.'})[mode]||'';
}
