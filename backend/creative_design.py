"""SOLVI declarative creative designs: no executable code, no model-created tools.

A human task grants permission to design, not to bypass scene ACLs. The browser
editor remains authoritative for physics, collision and persistence.
"""
import json
import math
import re

KINDS = frozenset(('cube','sphere','cylinder'))
HEXCOLOR = re.compile(r'^#[0-9a-fA-F]{6}$')


def validate_design(candidate):
    if not isinstance(candidate, dict) or set(candidate) - {'name','parts','site_distance','description'}:
        return None
    name = candidate.get('name')
    parts = candidate.get('parts')
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 70 or not isinstance(parts, list) or not 1 <= len(parts) <= 12:
        return None
    distance = candidate.get('site_distance')
    if distance is not None and (type(distance) not in (int, float) or not math.isfinite(distance) or not 1 <= distance <= 45):
        return None
    result = []
    for p in parts:
        if not isinstance(p, dict) or set(p) != {'kind','label','color','offset','size'} or p.get('kind') not in KINDS:
            return None
        if not isinstance(p.get('label'),str) or not 1 <= len(p['label'].strip()) <= 60:
            return None
        if not isinstance(p.get('color'),str) or not HEXCOLOR.fullmatch(p['color']):
            return None
        o, d = p['offset'], p['size']
        if not isinstance(o,dict) or not isinstance(d,dict) or set(o) != {'x','y','z'} or set(d) != {'width','height','depth'}:
            return None
        nums = [o['x'],o['y'],o['z'],d['width'],d['height'],d['depth']]
        if not all(type(v) in (int,float) and math.isfinite(v) for v in nums):
            return None
        if not (0.1 <= min(nums[3:]) and max(nums[3:]) <= 7 and 0 <= o['y'] and o['y']+d['height'] <= 12 and
                abs(o['x']) + d['width']/2 <= 4.6 and abs(o['z']) + d['depth']/2 <= 4.6):
            return None
        result.append({'kind':p['kind'],'label':p['label'].strip(),'color':p['color'].lower(),
                       'offset':dict(o),'size':dict(d)})
    return {'name':name.strip(),'parts':result,'site_distance':distance}


def parse_design(text):
    if not isinstance(text,str) or len(text)>12000:return None
    value = text.strip()
    # Some providers surround JSON with markdown fences; reject all other prose.
    if value.startswith('```'):
        match = re.fullmatch(r'```(?:json)?\s*(\{.*\})\s*```',value,re.I|re.S)
        if not match:return None
        value = match.group(1)
    try:return validate_design(json.loads(value))
    except (ValueError,TypeError,OverflowError):return None
