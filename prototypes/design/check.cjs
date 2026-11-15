// Uses the already installed Orca browser; no package installation.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const bin=process.env.VERIMARK_BROWSER||'C:/Users/James/AppData/Local/Programs/orca/resources/agent-browser-win32-x64.exe';
const root=__dirname,out=path.join(root,'evidence');fs.mkdirSync(out,{recursive:true});const log=[];
function run(...args){const r=spawnSync(bin,['--session','verimark-init-c',...args],{encoding:'utf8',timeout:30000});log.push({args,status:r.status,stdout:r.stdout,stderr:r.stderr});if(r.status!==0)throw Error(JSON.stringify(log.at(-1)));return r.stdout}
function evaluate(code){return run('eval',code)}
try{
for(const direction of ['ledger','signal','commons']){
 run('open','file:///'+path.join(root,direction,'index.html').replace(/\\/g,'/'));
 for(const [w,h,label] of [[1440,1000,'desktop'],[390,844,'mobile']]){
  run('set','viewport',String(w),String(h));
  for(const screen of ['landing','verify','details','dashboard','issue','recipient']){
   evaluate(`location.hash='${screen}'`);
   const info=evaluate(`JSON.stringify({screen:location.hash,title:document.title,h1:document.querySelectorAll('h1').length,overflow:document.documentElement.scrollWidth>innerWidth})`);
   const parsed=JSON.parse(JSON.parse(info));if(parsed.overflow||parsed.h1!==1)throw Error(info);
   if(label==='mobile'){const audit=JSON.parse(run('a11y','--json'));if(audit.data.counts.violations)throw Error(JSON.stringify(audit.data.violations))}
   run('screenshot',path.join(out,`${direction}-${screen}-${label}.png`),'--full');
  }
 }
 evaluate("location.hash='verify'");run('fill','#code','DEMO-A8K72');run('click','#verify button');run('wait','--text','Valid · simulated');
 run('fill','#code','bad');run('click','#verify button');run('wait','--text','Invalid identifier');
 run('fill','#code','DEMO-MISSING');run('click','#verify button');run('wait','--text','No fictional record matches');
 evaluate("location.hash='issue'");run('fill','#recipient','Jamie Example');run('click','#issue button');run('click','#edit');run('click','#issue button');run('click','#approve');run('wait','--text','Success: demo record created');
 evaluate("location.hash='details'");run('wait','--text','Jamie Example');
 evaluate("location.hash='verify'");run('fill','#code','DEMO-LOCAL-001');run('click','#verify button');run('wait','--text','Valid · simulated');
 // Identity regression: creating a second record must never rewrite the original lookup.
 run('click','#result a');run('wait','--text','Jamie Example');
 function assertDetails(id,name,excluded){const data=JSON.parse(JSON.parse(evaluate("JSON.stringify({text:document.querySelector('main').innerText})")));if(!data.text.includes(id)||!data.text.includes(name)||data.text.includes(excluded))throw Error('Wrong selected record: '+data.text)}
 assertDetails('DEMO-LOCAL-001','Jamie Example','Alex Santos');
 evaluate("location.hash='verify'");run('fill','#code','DEMO-A8K72');run('click','#verify button');run('wait','--text','Valid · simulated');run('click','#result a');run('wait','--text','Alex Santos');assertDetails('DEMO-A8K72','Alex Santos','Jamie Example');
 // Dashboard's recent row owns its target, independent of the last verified record.
 evaluate("location.hash='dashboard'");run('wait','--text','Your issuance desk.');run('focus','tbody a');run('press','Enter');run('wait','--text','Read the details.');run('wait','--text','Jamie Example');assertDetails('DEMO-LOCAL-001','Jamie Example','Alex Santos');
 evaluate("location.hash='verify'");run('fill','#code','DEMO-LOCAL-001');run('click','#verify button');run('wait','--text','Valid · simulated');run('click','#result a');run('wait','--text','Jamie Example');assertDetails('DEMO-LOCAL-001','Jamie Example','Alex Santos');
 // Landing always advertises the original fixture, even after a new-ID lookup.
 evaluate("location.hash='landing'");run('wait','--text','Read the record');run('click','.panel a');run('wait','--text','Read the details.');run('wait','--text','Alex Santos');assertDetails('DEMO-A8K72','Alex Santos','Jamie Example');
 evaluate("location.hash='verify'");run('fill','#code','DEMO-MISSING');run('click','#verify button');run('wait','--text','No fictional record matches');evaluate("location.hash='details'");run('wait','--text','No fictional record matches the selected identifier');
 evaluate("location.hash='recipient'");run('wait','--text','Jamie Example');
 evaluate("location.hash='verify'");
 for(const state of ['loading','empty','invalid','not-found','expired','revoked','replaced','unable','error','success','denied']){run('select','#state',state);run('wait','--text',state==='not-found'?'Not found':state==='unable'?'Unable to verify':state==='denied'?'Access denied':state[0].toUpperCase()+state.slice(1));run('click','#retry')}
 run('focus','.skip');run('press','Enter');evaluate("JSON.stringify({skipFocus:document.activeElement.id})");
 run('errors');run('a11y','--json');
}
}finally{fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify(log,null,2));run('close')}
console.log('PASS: 36 responsive screenshots; three issuance/verification journeys; state controls. See evidence/browser-checks.json.');
