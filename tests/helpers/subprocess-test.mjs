// Shared test-only child-process runner. Does not affect the application.
// On macOS, a transient launch failure or timeout can return status=null even
// though the tested Python / Node source itself has not produced a failure.
// Retry ONLY that transient launch condition; all nonzero statuses fail normally.
import {spawnSync as nativeSpawnSync} from 'node:child_process';

const TRANSIENT = new Set(['EAGAIN','ENOMEM','ETIMEDOUT','EINTR','EBUSY']);
export const MIN_CHILD_TIMEOUT_MS = 30000;
export const MAX_TRANSIENT_ATTEMPTS = 3;

export function spawnSync(command,args=[],options={},runner=nativeSpawnSync){
  const settings={...options};
  if(settings.timeout!==undefined){
    // CI/Mac runners may be loaded by concurrent tests and Python startup.
    settings.timeout=Math.max(settings.timeout,MIN_CHILD_TIMEOUT_MS);
  }
  let result;
  for(let attempt=1;attempt<=MAX_TRANSIENT_ATTEMPTS;attempt++){
    result=runner(command,args,settings);
    if(result.status!==null)return result; // Real nonzero exits are never retried.
    const code=result.error?.code||'';
    if(!TRANSIENT.has(code)||attempt===MAX_TRANSIENT_ATTEMPTS)break;
  }
  if(result.status===null){
    const info=`[child process failed to exit] ${command} ${Array.isArray(args)?args.slice(0,3).map(String).join(' '):''} status=null signal=${result.signal||'none'} error=${result.error?.code||'none'}: ${result.error?.message||'no error description'}`;
    return {...result,stderr:[result.stderr||'',info].filter(Boolean).join('\n')};
  }
  return result;
}
