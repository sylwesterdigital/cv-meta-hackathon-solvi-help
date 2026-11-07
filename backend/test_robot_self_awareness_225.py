"""v0.2.225 isolated self-profile assertions; no Flask or network required."""
from robot_character import (
    valid_character, catalog, trait_index, contextual_character,
    character_self_insight, character_self_report_text, wants_character_self_report,
    action_rules, evaluate_action,
)
assert len(trait_index()) == 96
profile={'version':1,'preset':'custom','traits':{
    'curiosity':100,'experimentation':89,'exploration':78,
    'problem_solving':0,'deliberation':3,'limitations_awareness':92,
    'honesty':75,'aggression':10}}
brain={'character':profile}
assert valid_character(profile)
report=character_self_insight(brain)
assert report['trait_count']==96 and report['configured']
assert report['strengths'][0]['id']=='curiosity'
assert any(r['id']=='problem_solving' and 'accept a temporary blocker too quickly' in r['pitfall'] for r in report['cautions'])
assert any(r['id']=='deliberation' and 'skip checking the consequences' in r['pitfall'] for r in report['cautions'])
assert '100/100' in character_self_report_text(brain,'@Ania describe your strengths and weaknesses')
assert '0/100' in character_self_report_text(brain,'@Ania describe your strengths and weaknesses')
assert 'Curiosity: 100/100' in character_self_report_text(brain,'@Ania what is your curiosity value?')
assert 'no Meta call' in character_self_report_text(brain,'@Ania what is your curiosity value?')
assert 'not been saved yet' in character_self_report_text({},'@Ania share your traits')
for q in ('@Ania what are your traits?', '@Ania describe your strengths and weaknesses',
          '@Ania do you know your spectrum numbers?', '@Ania what is your curiosity value?'):
    assert wants_character_self_report(q),q
for q in ('@Ania build a house with personality','@Ania move to the orchard',
          '@Ania please go to @Choka and discuss traits', '@Ania how is the house building going?'):
    assert not wants_character_self_report(q),q
assert set(k for action in action_rules().values() for k in action).issubset(trait_index()),'policy must only reference real sliders'
assert not evaluate_action(profile,'build',False)['approved']
print('PASS: exact character self-report, bipolar pros/cons and advisory tool safety')
