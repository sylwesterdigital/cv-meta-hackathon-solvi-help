import {shouldGroupMessages} from './preferences.js';
// Pure grouping utility for deterministic chronological chat rendering.
export function groupMessages(messages,enabled=true){
 const groups=[];
 for(const msg of messages){const group=groups.at(-1);
   if(group&&shouldGroupMessages(group.at(-1),msg,enabled))group.push(msg);
   else groups.push([msg]);
 }
 return groups;
}
