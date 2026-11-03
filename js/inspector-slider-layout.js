// One full-width inspector slider per active row; the row never changes layout.
// The function reads DOM rectangles only: it neither inserts nor moves fields.
export function inspectorSliderRow(number,furnitureRoot){
 const item=number?.closest?.('.furniture-param');
 if(item&&furnitureRoot?.contains?.(item)){
  const active=item.getBoundingClientRect();
  const container=furnitureRoot.getBoundingClientRect();
  const peerBottom=[...furnitureRoot.children].reduce((bottom,cell)=>{
   const rect=cell.getBoundingClientRect?.();
   return rect&&rect.width>0&&Math.abs(rect.top-active.top)<5?Math.max(bottom,rect.bottom):bottom;
  },active.bottom);
  return {left:container.left,width:container.width,top:active.top,bottom:peerBottom};
 }
 const axis=number?.closest?.('.transform-axis-row');
 if(axis){
  const row=axis.getBoundingClientRect();
  const group=number.closest('.transform-group')?.getBoundingClientRect()||row;
  return {left:group.left,width:group.width,top:row.top,bottom:row.bottom};
 }
 const fallback=number?.closest?.('label')?.getBoundingClientRect()||number.getBoundingClientRect();
 return {left:fallback.left,width:fallback.width,top:fallback.top,bottom:fallback.bottom};
}
