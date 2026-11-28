import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
const COOKIE='ab_account',TTL=30*86400,MAX_ACCOUNTS=10000,MAX_SESSIONS=8;
const CODE=/^ab1_[A-Za-z0-9_-]{43}$/;
const TOKEN=/^[a-f0-9]{64}$/;
const digest=value=>createHash('sha256').update(value).digest('hex');
const cookieValue=header=>header?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
export function openAccounts(db,{now=Date.now,secure=!!process.env.RAILWAY_ENVIRONMENT_ID}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, recovery_hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
 );
 CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
 );
 CREATE INDEX IF NOT EXISTS account_sessions_owner ON account_sessions(account_id,created_at);
 CREATE INDEX IF NOT EXISTS account_sessions_expiry ON account_sessions(expires_at);`);
 const byId=db.prepare('SELECT id,name,recovery_hash FROM accounts WHERE id=?');
 const byCode=db.prepare('SELECT id,name FROM accounts WHERE recovery_hash=?');
 const bySession=db.prepare('SELECT a.id,a.name FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?');
 const insertAccount=db.prepare('INSERT INTO accounts VALUES(?,?,?,?)');
 const insertSession=db.prepare('INSERT INTO account_sessions VALUES(?,?,?,?)');
 const clean=db.prepare('DELETE FROM account_sessions WHERE expires_at<=?');
 const trim=db.prepare('DELETE FROM account_sessions WHERE account_id=? AND token_hash IN (SELECT token_hash FROM account_sessions WHERE account_id=? ORDER BY created_at DESC,token_hash DESC LIMIT -1 OFFSET ?)');
 const revoke=db.prepare('DELETE FROM account_sessions WHERE token_hash=?');
 const remove=db.prepare('DELETE FROM accounts WHERE id=?');
 const count=db.prepare('SELECT count(*) AS n FROM accounts');
 const transferProfile=db.prepare('INSERT INTO guest_history_profiles(guest_id,opted_at,matches,wins,rounds) SELECT ?,opted_at,matches,wins,rounds FROM guest_history_profiles WHERE guest_id=?');
 const transferMatches=db.prepare('UPDATE guest_match_history SET guest_id=? WHERE guest_id=?');
 const deleteHistory=db.prepare('DELETE FROM guest_history_profiles WHERE guest_id=?');
 const cookie=(token,age=TTL)=>COOKIE+'='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(secure?'; Secure':'');
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}
 function session(account){
  const t=now(),token=randomBytes(32).toString('hex'),hash=digest(token);
  clean.run(t);trim.run(account.id,account.id,MAX_SESSIONS-1);
  insertSession.run(hash,account.id,t+TTL*1000,t);
  return {account:{id:account.id,name:account.name},cookie:cookie(token)};
 }
 function read(header){const token=cookieValue(header);return TOKEN.test(token||'')?bySession.get(digest(token),now())||null:null;}
 function create(guest){
  return transaction(()=>{
   if(count.get().n>=MAX_ACCOUNTS)return null;
   const id=randomBytes(32).toString('hex'),code='ab1_'+randomBytes(32).toString('base64url');
   insertAccount.run(id,guest.name,digest(code),now());
   transferProfile.run(id,guest.id);transferMatches.run(id,guest.id);deleteHistory.run(guest.id);
   return {...session({id,name:guest.name}),code};
  });
 }
 function signIn(code){if(typeof code!=='string'||!CODE.test(code))return null;return transaction(()=>{const a=byCode.get(digest(code));return a?session(a):null;});}
 function signOut(header){const token=cookieValue(header);if(TOKEN.test(token||''))revoke.run(digest(token));return cookie('',0);}
 function deleteAccount(id,code){if(typeof code!=='string'||!CODE.test(code))return false;return transaction(()=>{const a=byId.get(id);if(!a||!timingSafeEqual(Buffer.from(a.recovery_hash,'hex'),Buffer.from(digest(code),'hex')))return false;deleteHistory.run(id);remove.run(id);return true;});}
 return {read,create,signIn,signOut,deleteAccount};
}
