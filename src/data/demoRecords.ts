export type RecordStatus = 'valid' | 'revoked' | 'expired' | 'replaced';
export interface DemoRecord { id: string; recipient: string; title: string; date: string; status: RecordStatus; category: string }
// Fictional fixtures only. Never used to establish authenticity or authorization.
export const demoRecords: DemoRecord[] = [
 {id:'VM-2026-0482',recipient:'Alex Santos',title:'Community Research Workshop',date:'12 Nov 2026',status:'valid',category:'Completion'},
 {id:'VM-2026-0481',recipient:'Nina Reyes',title:'Peer Leadership Program',date:'11 Nov 2026',status:'valid',category:'Recognition'},
 {id:'VM-2026-0479',recipient:'Gabriel Cruz',title:'Research Ethics Orientation',date:'09 Nov 2026',status:'valid',category:'Participation'},
 {id:'VM-2026-0475',recipient:'Samira Torres',title:'Community Research Workshop',date:'05 Nov 2026',status:'revoked',category:'Completion'},
 {id:'VM-2026-0472',recipient:'Isabel Mendoza',title:'Digital Literacy Seminar',date:'30 Oct 2026',status:'expired',category:'Participation'},
 {id:'VM-2026-0465',recipient:'Elijah Ramos',title:'Sustainable Design Challenge',date:'24 Oct 2026',status:'valid',category:'Recognition'},
 {id:'VM-2026-0460',recipient:'Mara Castillo',title:'Peer Leadership Program',date:'20 Oct 2026',status:'replaced',category:'Recognition'},
 {id:'VM-2026-0458',recipient:'Theo Lim',title:'Community Data Fundamentals',date:'16 Oct 2026',status:'valid',category:'Completion'},
];
export function filterRecords(query: string, status: string) {
 const needle = query.trim().toLowerCase();
 return demoRecords.filter(record => (status === 'all' || record.status === status) && `${record.recipient} ${record.title} ${record.id} ${record.category}`.toLowerCase().includes(needle));
}
