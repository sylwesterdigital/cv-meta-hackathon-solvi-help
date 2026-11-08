// Pure, realm-bound design plan schema. Muse may choose arbitrary combinations
// of these editor primitives but may not supply scripts, plugins, APIs or URLs.
export function validateRobotDesign(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['name','parts','site_distance','description'].includes(k)))return null;
 if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>70||!Array.isArray(raw.parts)||raw.parts.length<1||raw.parts.length>12)return null;
 if(raw.site_distance!=null&&(!Number.isFinite(raw.site_distance)||raw.site_distance<1||raw.site_distance>45))return null;
 const parts=[];
 for(const p of raw.parts){
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join(',')!=='color,kind,label,offset,size'||
    !['cube','sphere','cylinder'].includes(p.kind)||typeof p.label!=='string'||!p.label.trim()||p.label.length>60||
    typeof p.color!=='string'||!/^#[\da-f]{6}$/i.test(p.color))return null;
  const o=p.offset,d=p.size;
  if(!o||!d||Object.keys(o).sort().join(',')!=='x,y,z'||Object.keys(d).sort().join(',')!=='depth,height,width')return null;
  if(![o.x,o.y,o.z,d.width,d.height,d.depth].every(v=>typeof v==='number'&&Number.isFinite(v))||
    Math.min(d.width,d.height,d.depth)<.1||Math.max(d.width,d.height,d.depth)>7||o.y<0||o.y+d.height>12||
    Math.abs(o.x)+d.width/2>4.6||Math.abs(o.z)+d.depth/2>4.6)return null;
  parts.push({kind:p.kind,label:p.label.trim(),color:p.color.toLowerCase(),
    offset:{x:o.x,y:o.y,z:o.z},size:{width:d.width,height:d.height,depth:d.depth}});
 }
 return {name:raw.name.trim(),parts,span:9,direct:raw.site_distance!=null,distance:raw.site_distance??null};
}
// Authorization checks the current room's scene robots and matches the full
// display name. One human command cannot ambiguously select two 'New robots'.
export function addressedCreativeRobot(text,robots=[]){
 const value=String(text||'').trim();
 if(!value.startsWith('@'))return null;
 const available=robots.filter(r=>r&&r.kind==='robot'&&typeof r.name==='string'&&typeof r.id==='string');
 const matching=available.filter(r=>value.toLocaleLowerCase().startsWith('@'+r.name.toLocaleLowerCase()+' '));
 if(matching.length!==1)return null;
 const robot=matching[0];const statement=value.slice(robot.name.length+1).trim();
 if(/^(?:please\s+)?(?:explain|describe|discuss|tell|show|summari[sz]e)\b/i.test(statement)||/^(?:can|could|would|do)\s+you\s+(?:please\s+)?(?:explain|describe|tell|discuss)\b/i.test(statement)||/^(?:how|why|what)\b/i.test(statement))return null;
 if(!statement||/\b(?:don't|do not|never|stop|cancel)\s+(?:\w+\s+){0,4}(?:build|create|make|add|construct|design|modify|change|remodel)\b/i.test(statement))return null;
 // This is an authorization boundary, not an object-name dictionary.
 // User may name any novel object; Muse, not a regex, decides its geometry.
 const coordinatedBuild=/^(?:walk|wander|roam|explore)\b[\s\S]{0,160}\b(?:and|while)\b[\s\S]{0,160}\b(?:build|create|make|design|assemble)\b/i.test(statement);
 // Natural follow-on work is still authorized ONLY by a saved human message;
 // no object-name whitelist (mazes, conker guards, invented cities all work).
 const coordinatedAssist=/^go\s+to\s+@[^\s]+.*?\band\s+help\b.*?\b(?:embellish|create|build|decorate|make|extend|design)\b/i.test(statement);
 const creativeSession=/\bcreative\s+(?:building\s+)?session\b/i.test(statement);
 const action=/\b(?:build|built|building|creat\w*|make|add|construct\w*|design\w*|modify|change|remodel|assembl\w*|embellish|decorate|extend|develop|sculpt\w*)\b/i.test(statement);
 const mandate=/\b(?:please|can you|could you|do|go ahead|go for it|now|start|begin|free to|ok|yes|perform|undertake|execute|continue|keep|resume|you should|i (?:mean|want) you to)\b/i.test(statement);
 if(!coordinatedBuild&&!coordinatedAssist&&!(mandate&&(action||creativeSession)))return null;
 if(/\b(?:do not|don't|never|stop|cancel)\s+(?:\w+\s+){0,4}(?:build|create|make|add|construct|design|continue|extend|embellish|start)\b/i.test(statement))return null;
 return {robotId:robot.id,robotName:robot.name,goal:value};
}
