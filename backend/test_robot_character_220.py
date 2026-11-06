"""Isolated character schema and action preference tests; no Flask required."""
import json
from pathlib import Path
from robot_character import valid_character, contextual_character, evaluate_action, catalog, action_rules
traits={t['id']:t for c in catalog()['categories'] for t in c['traits']}
assert len(catalog()['categories'])==30 and len(traits)==96
assert 'honesty' in traits and 'manipulation' in traits and 'persistence' in traits
profile={'version':1,'preset':'custom','traits':{k:50 for k in traits}}
assert valid_character(profile)
assert not valid_character({**profile,'traits':{**profile['traits'],'dishonest-admin':100}})
assert not valid_character({**profile,'traits':{**profile['traits'],'honesty':101}})
assert not valid_character({**profile,'traits':{**profile['traits'],'honesty':True}})
assert not valid_character({**profile,'version':99})
assert not valid_character({**profile,'authority':'admin'})
assert contextual_character({'character':profile})
assert not evaluate_action(profile,'build',False)['approved']
assert evaluate_action(profile,'build',True)['approved']
assert not evaluate_action(profile,'invented action',True)['approved']
assert not evaluate_action(profile,'build',True,False)['approved']
assert Path(__file__).parent.joinpath('robot-character-schema.json').read_bytes()==Path(__file__).parent.parent.joinpath('robot-character-schema.json').read_bytes()
assert Path(__file__).parent.joinpath('robot-character-policy.json').read_bytes()==Path(__file__).parent.parent.joinpath('robot-character-policy.json').read_bytes()
print('PASS: unified fictional character schema, validated traits, and safe advisory action policy')
