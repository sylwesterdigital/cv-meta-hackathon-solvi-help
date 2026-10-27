"""Print a PBKDF2 password hash to put in SOLVI_ADMIN_PASSWORD_HASH (never plaintext)."""
import getpass
import hashlib
import secrets
password=getpass.getpass('New admin password: ')
if len(password)<14:raise SystemExit('Admin password must have at least 14 characters')
salt=secrets.token_bytes(16)
print('pbkdf2_sha256:'+salt.hex()+':'+hashlib.pbkdf2_hmac('sha256',password.encode(),salt,260000).hex())
