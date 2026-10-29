/** A scene object's edit lock guards only manual transforms, not selection or robot missions. */
export function isTransformLocked(object){return object?.userData?.transformLocked===true;}
export function mayTransform(object,canEdit){return Boolean(object&&canEdit&&!isTransformLocked(object));}
export function validTransformLock(value){return value===undefined||typeof value==='boolean';}
