import {DatabaseSync} from 'node:sqlite';
import {openAccounts} from './accounts.js';
import {summarizeMatch} from '../src/match-summary.js';
export function openHistory(path=':memory:',{now=Date.now}={}){
 const db=new DatabaseSync(path);
 const version=db.prepare('PRAGMA user_version').get().user_version;
 if(version>2){db.close();throw Error('Unsupported history schema version');}
 db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS guest_history_profiles (
  guest_id TEXT PRIMARY KEY, opted_at INTEGER NOT NULL,
  matches INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
  rounds INTEGER NOT NULL DEFAULT 0
 );
 CREATE TABLE IF NOT EXISTS guest_match_history (
  guest_id TEXT NOT NULL REFERENCES guest_history_profiles(guest_id) ON DELETE CASCADE,
  match_id TEXT NOT NULL, completed_at INTEGER NOT NULL,
  placement INTEGER NOT NULL CHECK(placement BETWEEN 1 AND 4),
  rounds INTEGER NOT NULL, round_wins INTEGER NOT NULL, damage REAL NOT NULL, prevented REAL NOT NULL,
  PRIMARY KEY(guest_id,match_id)
 );
 CREATE INDEX IF NOT EXISTS guest_history_recent ON guest_match_history(guest_id,completed_at DESC,match_id DESC);
`);
 const accounts=openAccounts(db,{now});
 db.exec('PRAGMA user_version=2');
 const get=db.prepare('SELECT opted_at,matches,wins,rounds FROM guest_history_profiles WHERE guest_id=?');
 const list=db.prepare('SELECT completed_at,placement,rounds,round_wins,damage,prevented FROM guest_match_history WHERE guest_id=? ORDER BY completed_at DESC,match_id DESC LIMIT 100');
 const addProfile=db.prepare('INSERT OR IGNORE INTO guest_history_profiles(guest_id,opted_at) VALUES(?,?)');
 const deleteProfile=db.prepare('DELETE FROM guest_history_profiles WHERE guest_id=?');
 const count=db.prepare('SELECT count(*) AS n FROM guest_history_profiles');
 const insert=db.prepare('INSERT OR IGNORE INTO guest_match_history VALUES(?,?,?,?,?,?,?,?)');
 const totals=db.prepare('UPDATE guest_history_profiles SET matches=matches+1,wins=wins+?,rounds=rounds+? WHERE guest_id=?');
 const trim=db.prepare('DELETE FROM guest_match_history WHERE guest_id=? AND match_id IN (SELECT match_id FROM guest_match_history WHERE guest_id=? ORDER BY completed_at DESC,match_id DESC LIMIT -1 OFFSET 100)');
 function read(id){const p=get.get(id);return {enabled:!!p,totals:p?{matches:p.matches,wins:p.wins,rounds:p.rounds}:{matches:0,wins:0,rounds:0},history:p?list.all(id):[]};}
 function set(id,enabled){if(enabled){if(!get.get(id)&&count.get().n>=10000)return null;addProfile.run(id,now());}else deleteProfile.run(id);return read(id);}
 function record(id,matchId,match,seat,joinedAt){
  const p=get.get(id);if(!p||p.opted_at>joinedAt)return false;
  const s=summarizeMatch(match,seat);
  if(match.phase!=='finished'||s.placement<1||s.placement>4||s.rounds<1)return false;
  db.exec('BEGIN IMMEDIATE');
  try{
   const changed=insert.run(id,matchId,now(),s.placement,s.rounds,s.wins,s.totals.damage,s.totals.prevented).changes;
   if(changed){totals.run(Number(s.placement===1),s.rounds,id);trim.run(id,id);}
   db.exec('COMMIT');return !!changed;
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 return {read,set,record,accounts,close:()=>db.close()};
}
