import { describe, expect, it } from 'vitest';
import { demoRecords, filterRecords } from './demoRecords';
describe('fictional collection filtering',()=>{
 it('matches references and case-insensitive recipient text',()=>{expect(filterRecords('  ALEX  ','all').map(r=>r.id)).toEqual(['VM-2026-0482']);expect(filterRecords('0472','all')[0].status).toBe('expired');});
 it('combines search with standing, including a nonvalid result',()=>{expect(filterRecords('Community Research','revoked').map(r=>r.recipient)).toEqual(['Samira Torres']);expect(filterRecords('Alex','revoked')).toEqual([]);});
 it('returns an empty collection for unknown queries and restores all on reset',()=>{expect(filterRecords('no such record','all')).toEqual([]);expect(filterRecords('','all')).toEqual(demoRecords);expect(filterRecords('','replaced')).toHaveLength(1);});
});
