#!/usr/bin/env python3
"""Inject SOLVI API/WS proxy into existing HTTPS server block; keep TLS untouched.
Idempotent. Use only from root-owned deployment process after backing up vhost.
"""
from pathlib import Path
import re
import sys


def server_blocks(source):
    # Tokenize braces while ignoring comments/quoted strings.
    safe=list(source)
    in_quote=None
    comment=False
    escape=False
    for i,ch in enumerate(source):
        if comment:
            if ch=='\n':comment=False
            else:safe[i]=' '
            continue
        if in_quote:
            safe[i]=' '
            if escape:escape=False
            elif ch=='\\':escape=True
            elif ch==in_quote:in_quote=None
            continue
        if ch=='#':comment=True;safe[i]=' ';continue
        if ch in ('"',"'"):in_quote=ch;safe[i]=' ';continue
    flat=''.join(safe)
    blocks=[]
    for m in re.finditer(r'\bserver\s*\{',flat):
        start=m.end()-1;depth=0;end=None
        for j in range(start,len(flat)):
            if flat[j]=='{':depth+=1
            if flat[j]=='}':
                depth-=1
                if depth==0:end=j;break
        if end is not None:blocks.append((m.start(),start,end))
    return blocks


def configure(source):
    chosen=[]
    for _,brace,end in server_blocks(source):
        block=source[brace+1:end]
        # The original 'server_name solvi.help' must be in the actual vhost, not a comment.
        if not re.search(r'^\s*server_name\s+[^;\n]*\bsolvi\.help\b',block,re.M):continue
        if re.search(r'\blisten\s+[^;\n]*\bssl\b',block) or re.search(r'\bssl_certificate\s+',block):
            chosen.append((brace,end,block))
    if len(chosen)!=1:raise RuntimeError(f'Expected one HTTPS server block for solvi.help; found {len(chosen)}. Refusing to alter Nginx.')
    brace,end,block=chosen[0]
    # Idempotent: remove previous include statement only. Abort on manually defined
    # competing locations, to avoid damaging unrelated configuration.
    block=re.sub(r'^\s*include\s+/etc/nginx/snippets/solvi-help-api\.conf\s*;\s*\n','',block,flags=re.M)
    if re.search(r'\blocation\s+(?:=\s*)?(?:\^~\s*)?/api(?:/|\b)',block) or re.search(r'\blocation\s+(?:=\s*)?/ws\b',block):
        raise RuntimeError('Existing /api or /ws location in HTTPS vhost. Refusing automatic rewrite; back up and resolve conflict.')
    block=block.rstrip()+ '\n    include /etc/nginx/snippets/solvi-help-api.conf;\n'
    return source[:brace+1]+block+source[end:]


def main():
    if len(sys.argv)!=2:raise SystemExit('Usage: configure-nginx.py /etc/nginx/sites-available/solvi.help')
    p=Path(sys.argv[1]);source=p.read_text();updated=configure(source)
    if updated!=source:p.write_text(updated)
    print(f'HTTPS proxy included: {p}')

if __name__=='__main__':main()
