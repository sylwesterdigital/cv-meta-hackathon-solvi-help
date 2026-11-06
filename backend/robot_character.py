"""Schema-validated fictional behaviour knobs; never a permissions system."""
import json
from functools import lru_cache
from pathlib import Path

@lru_cache(maxsize=1)
def catalog():
    return json.loads((Path(__file__).resolve().parent/'robot-character-schema.json').read_text(encoding='utf-8'))

@lru_cache(maxsize=1)
def trait_index():
    return {t['id']:t for category in catalog()['categories'] for t in category['traits']}

def valid_character(value):
    if not isinstance(value,dict) or set(value)-{'version','preset','traits'} or value.get('version')!=catalog()['version']:
        return False
    if not isinstance(value.get('preset'),str) or len(value['preset'])>40:return False
    traits=value.get('traits')
    return isinstance(traits,dict) and len(traits)<=len(trait_index()) and all(
        key in trait_index() and type(number) is int and 0<=number<=100
        for key,number in traits.items())

def contextual_character(brain):
    """Compact all-traits identity passed to model; not simulated knowledge."""
    character=brain.get('character') if isinstance(brain,dict) else None
    if not valid_character(character):return {}
    index=trait_index();values=character['traits']
    # All 96 keys (including neutral 50) remain available to the LLM.
    return {'schema_version':character['version'],'preset':character['preset'],
            'traits':{key:values.get(key,50) for key in index}}

@lru_cache(maxsize=1)
def action_rules():
    return json.loads((Path(__file__).resolve().parent/'robot-character-policy.json').read_text(encoding='utf-8'))['actions']

def evaluate_action(character, action, authorised=False, reachable=True):
    weights=action_rules().get(action)
    if not weights:return {'action':action,'approved':False,'preference':0,'reason':'Unknown advisory action'}
    profile=character if valid_character(character) else {'traits':{}}
    values=profile.get('traits',{})
    score=sum((values.get(k,50) if w>=0 else 100-values.get(k,50))*abs(w) for k,w in weights.items())/sum(abs(w) for w in weights.values())
    score=max(0,min(100,round(score)))
    return {'action':action,'approved':bool(authorised and reachable),'preference':score,
            'attitude':'inclined' if score>=68 else 'hesitant' if score<=32 else 'balanced',
            'reason':'Advisory preference only; validated tool required' if authorised and reachable else 'Permission or scene prerequisite unavailable'}
