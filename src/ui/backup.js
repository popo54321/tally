// Backup reminder.
import * as P from '../state/persist';
import { S } from '../state/app';
import { V } from '../ui/view';
import { dnum, localDate } from '../core/dates';
import { t, tf } from '../i18n/index';
import { $ } from './dom';
import { saveBackupFile } from './sync';

export const BACKUP_DAYS = 14;
export async function markBackedUp(){ await P.saveBackupDate(); drawBackup(); }
export const backupAge = () => S.lastBackup ? dnum(localDate())-dnum(S.lastBackup) : null;
export function backupDue(){
  if(!S.entries.length) return false;
  const age=backupAge();
  if(age==null) return dnum(localDate())-dnum(S.entries[0].date)>=7;
  return age>=BACKUP_DAYS && S.entries.some(e=>e.date>S.lastBackup);
}
export function drawBackup(){
  const age=backupAge(), line=$("bakLine");
  if(line) line.textContent = age==null ? t('bak.never') : age===0 ? t('bak.today') : age===1 ? t('bak.yesterday') : tf('bak.ago',{n:age});
  const bar=$("bakNudge"); if(!bar) return;
  const show=backupDue() && !V.bakSnoozed;
  bar.style.display = show ? '' : 'none';
  if(show) $("bakNudgeText").textContent = age==null ? t('bak.nudge.never') : tf('bak.nudge.ago',{n:age});
}
export function bakFromNudge(){
  saveBackupFile();
  if(S.lastBackup!==localDate()) $("bakNudgeText").textContent=$("syncMsg").textContent || t('sync.writefail');
}
