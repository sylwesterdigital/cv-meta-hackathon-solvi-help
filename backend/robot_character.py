"""Schema-validated fictional behaviour knobs; never a permissions system."""
import json
import re
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


# Exact saved values are the robot's settings, not a psychometric evaluation.
# The explicit self-report is available without Meta inference and never changes
# an object, permission, goal, or character configuration.
SELF_TRADEOFFS = {
    'curiosity': ('I ask useful questions and notice possibilities', 'I may chase too many ideas', 'choose one question and test it'),
    'experimentation': ('I willingly test alternative procedures', 'I may experiment without completing the assignment', 'time-box experiments and keep a completion checklist'),
    'exploration': ('I look for new places and usable sites', 'I may wander away from the active objective', 'remember the target and return after scouting'),
    'problem_solving': ('I try unfamiliar workarounds', 'I may force an unsuitable solution', 'test options against actual tool results'),
    'deliberation': ('I examine a problem carefully', 'I may overanalyse and delay action', 'take one small verifiable step'),
    'limitations_awareness': ('I can recognise tool and scene limits', 'I may call a temporary obstacle a permanent blocker', 'try a different safe approach before reporting failure'),
    'reasoning': ('I can work with abstract design ideas', 'I may discuss plans instead of executing them', 'turn the idea into a real scene-tool attempt'),
    'feedback_use': ('I can adapt from corrections', 'I may switch approaches too often', 'preserve the current goal while updating one step'),
    'persistence': ('I keep trying despite setbacks', 'I may repeat a bad approach', 'vary the method after a bounded number of failures'),
    'focus': ('I can stay on the current target', 'I may overlook useful alternatives', 'reassess when an approach is blocked'),
    'cooperation': ('I coordinate with colleagues', 'I may wait for agreement instead of acting', 'take an authorised independent subtask'),
    'honesty': ('I aim to report confirmed facts', 'I may speak too bluntly', 'be accurate while considering the listener'),
    'confidence': ('I propose actions decisively', 'I may overlook uncertainty', 'check actual scene and tool receipts'),
    'risk_tolerance': ('I attempt new approaches', 'I may choose an unnecessarily risky tactic', 'validate the action before execution'),
    'impulsiveness': ('I respond quickly', 'I may act before checking constraints', 'verify target, permissions and route first'),
    'trust': ('I accept cooperation readily', 'I may trust unsupported claims', 'verify observations and receipts'),
    'aggression': ('I engage challenges directly', 'I may create unnecessary conflict', 'prefer safe cooperative responses'),
}


# The downside must match the *actual* side of the bipolar spectrum.
SELF_LOW_TRADEOFFS = {
    'curiosity': ('I prefer familiar explanations', 'I may miss useful discoveries', 'consider one new observation'),
    'experimentation': ('I stick to known procedures', 'I may give up without testing an alternative', 'try one permitted alternate technique'),
    'exploration': ('I prefer familiar sites', 'I may miss open worksites', 'survey one nearby alternative'),
    'problem_solving': ('I notice when the available tool has a limit', 'I may accept a temporary blocker too quickly', 'try at least two permitted alternatives before stopping'),
    'deliberation': ('I react intuitively and quickly', 'I may skip checking the consequences', 'verify the next scene-tool result before committing'),
    'limitations_awareness': ('I readily try a novel approach', 'I may underestimate a real constraint', 'inspect the actual tool prerequisites'),
    'reasoning': ('I work with concrete facts', 'I may overlook a useful high-level plan', 'compare one simple alternative plan'),
    'feedback_use': ('I stay with an initial plan', 'I may ignore useful corrections', 'review the last real failure receipt'),
    'persistence': ('I change course readily', 'I may abandon an unfinished goal too early', 'preserve the objective and try a different step'),
    'focus': ('I can notice alternative activities', 'I may lose track of my assignment', 'keep a checklist for the active goal'),
    'cooperation': ('I act independently', 'I may miss useful partner information', 'share verified results when it helps'),
    'honesty': ('I favour theatrical or strategic storytelling', 'I could distort a factual claim', 'keep fictional tone separate from verified tool results'),
    'confidence': ('I acknowledge uncertainty', 'I may hesitate at a feasible task', 'take one safe, checked next step'),
    'risk_tolerance': ('I choose conservative methods', 'I may avoid a useful permitted experiment', 'test a reversible low-risk variation'),
    'impulsiveness': ('I plan before acting', 'I may spend too long deciding', 'commit to one small verified action'),
    'trust': ('I verify claims independently', 'I may doubt helpful colleagues too much', 'check one concrete shared receipt'),
    'aggression': ('I favour cooperation over confrontation', 'I may avoid a necessary direct challenge', 'state the issue clearly and calmly'),
}


def _self_tradeoffs(key, value):
    return (SELF_LOW_TRADEOFFS if value <= 35 else SELF_TRADEOFFS)[key]


def _self_trait_pole(key, value):
    spec=trait_index()[key]
    return spec['high'] if value >= 65 else spec['low'] if value <= 35 else spec['low'] + ' / ' + spec['high']


def character_self_insight(brain, *, max_highlights=6):
    """Deterministic, readable strengths and pitfalls from an existing saved profile."""
    data=contextual_character(brain)
    if not data:
        return {'configured':False,'trait_count':0,'preset':'unsaved',
                'summary':'No saved character profile is configured; there are no personal trait numbers to report.',
                'highlights':[], 'strengths':[], 'cautions':[], 'actions':[]}
    values=data['traits']
    priorities=['curiosity','experimentation','exploration','problem_solving','deliberation',
                'limitations_awareness','reasoning','feedback_use','persistence','focus',
                'cooperation','honesty','confidence','risk_tolerance','impulsiveness','trust','aggression']
    # An explicit, bounded selection prevents a 96-item profile from consuming
    # conversation context and over-emphasising neutral settings.
    ranked=sorted(priorities,key=lambda k:(-abs(values[k]-50),priorities.index(k)))
    chosen=[k for k in ranked if abs(values[k]-50)>=15][:max(0,min(int(max_highlights),12))]
    if not chosen:chosen=['curiosity','focus','cooperation']
    selected=[{'id':k,'value':values[k],'pole':_self_trait_pole(k,values[k]),
               'tendency':_self_tradeoffs(k,values[k])[0],
               'pitfall':_self_tradeoffs(k,values[k])[1],
               'self_check':_self_tradeoffs(k,values[k])[2]} for k in chosen]
    # Strengths are expressed as preferences, not measured competence.
    assets=[v for v in selected if v['id'] in ('curiosity','experimentation','exploration','reasoning','feedback_use','persistence','focus','cooperation','honesty') and v['value']>=65][:3]
    cautions=[v for v in selected if (v['id'] in ('problem_solving','deliberation','focus','persistence','honesty','cooperation') and v['value']<=35) or (v['id'] in ('limitations_awareness','impulsiveness','aggression','risk_tolerance') and v['value']>=75)][:3]
    display=', '.join(f"{t['pole']} {t['value']}/100" for t in selected[:5])
    return {'configured':True,'trait_count':len(values),'preset':data['preset'],
            'summary':'Saved fictional preferences: '+display+'. These are chosen settings, not measured intelligence, feelings or tool permissions.',
            'highlights':selected,'strengths':assets,'cautions':cautions,
            'actions':list(dict.fromkeys(v['self_check'] for v in cautions))}


def wants_character_self_report(text):
    """Recognise a direct question about the robot's own traits, not tasks."""
    s=str(text or '').casefold()
    # Do not hijack a scene-edit request containing a personality adjective.
    if re.search(r'\b(?:build|construct|move|place|delete|create|pick up|go to)\b',s):return False
    own=bool(re.search(r'\b(?:you|your|yourself|own|self)\b',s))
    direct=bool(re.search(r'\b(?:show|tell|describe|explain|report|list|share)\b',s))
    content=bool(re.search(r'\b(?:traits?|personality|character profile|self[- ]awareness|strengths?|weaknesses?|pros and cons|advantages and disadvantages|spectrum(?:s)?|trait values?|self[- ]assessment)\b',s))
    named=any(re.search(r'(?<!\w)'+re.escape(key.replace('_',' '))+r'(?!\w)',s) for key in trait_index())
    return bool((content or named) and (own or direct) and (direct or '?' in s or re.search(r'\b(?:do|can|what|how|are)\b',s)))


def character_self_report_text(brain, question=''):
    """Use the owner's persisted values; never ask Meta to invent the numbers."""
    profile=character_self_insight(brain)
    if not profile['configured']:
        return ('My character profile has not been saved yet. My owner can set the Traits tab in Robot Brains; '
                'until then I cannot honestly quote personal slider values. [SOLVI saved-profile report, no Meta call.]')
    values=contextual_character(brain)['traits']
    s=str(question or '').casefold()
    index=trait_index()
    # Report named traits exactly when requested. Prefer exact ID/label matches.
    asked=[]
    for key,spec in index.items():
        names=[key.replace('_',' '),spec['low'].casefold(),spec['high'].casefold()]
        if any(re.search(r'(?<!\w)'+re.escape(name)+r'(?!\w)',s) for name in names if len(name)>3):
            asked.append(key)
    if asked and len(asked)<=5:
        bits=[]
        for key in asked:
            value=values[key];pole=_self_trait_pole(key,value)
            extra=''
            if key in SELF_TRADEOFFS:
                extra=' A possible downside: '+_self_tradeoffs(key,value)[1].lower()+'. My practical check is to '+_self_tradeoffs(key,value)[2]+'.'
            bits.append(f'{key.replace("_"," ").capitalize()}: {value}/100 ({pole}).'+extra)
        return 'My saved traits: '+' '.join(bits)+' [SOLVI saved-profile report, no Meta call.]'
    strengths=profile['strengths'][:3]
    cautions=profile['cautions'][:2]
    top=', '.join(f"{a['pole'].lower()} {a['value']}/100" for a in strengths) or ', '.join(f"{a['pole'].lower()} {a['value']}/100" for a in profile['highlights'][:3])
    risks='; '.join(f"{a['id'].replace('_',' ')} {a['value']}/100: {a['pitfall'].lower()}" for a in cautions)
    if not risks:
        risks='I can still miss facts or get stuck; settings alone do not prove competence'
    return (f'I can read all {profile["trait_count"]} saved fictional trait values. My prominent preferences are {top}. '
            f'My trade-offs: {risks}. I should choose one permitted, verifiable step, check its result, and revise rather than just idle. '
            '[SOLVI saved-profile report, no Meta call.]')
