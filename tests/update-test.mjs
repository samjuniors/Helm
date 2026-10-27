import{mkdtempSync,cpSync,writeFileSync,readFileSync,existsSync,mkdirSync,rmSync}from'node:fs';import{spawnSync}from'node:child_process';import os from'node:os';import path from'node:path';import{fileURLToPath}from'node:url';import assert from'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tmp=mkdtempSync(path.join(os.tmpdir(),'helm-tests-'));
const env={...process.env,GIT_AUTHOR_NAME:'helm-test',GIT_AUTHOR_EMAIL:'helm@test.invalid',GIT_COMMITTER_NAME:'helm-test',GIT_COMMITTER_EMAIL:'helm@test.invalid'};
const node=(a,cwd=root)=>spawnSync(process.execPath,a,{cwd,env,encoding:'utf8'}),git=(cwd,...a)=>spawnSync('git',a,{cwd,env,encoding:'utf8'});let n=0;
const ok=(cond,msg)=>{assert.ok(cond,msg);n++;console.log('PASS '+msg)};
try{
const old=path.join(tmp,'installed');mkdirSync(old);for(const f of ['package.json','server/mcp.mjs']){const to=path.join(old,f);mkdirSync(path.dirname(to),{recursive:true});cpSync(path.join(root,f),to)}
const p=JSON.parse(readFileSync(path.join(old,'package.json'),'utf8'));p.version='0.3.0';p.name='product-kit-plugin';writeFileSync(path.join(old,'package.json'),JSON.stringify(p));
mkdirSync(path.join(old,'bin'));writeFileSync(path.join(old,'bin/helm.mjs'),'// old');
const dry=node(['update.mjs','--into',old,'--dry-run']);ok(dry.status===0&&/DRY RUN/.test(dry.stdout),'legacy 0.3 dry-run');
const up=node(['update.mjs','--into',old]);ok(up.status===0,up.stderr||'update legacy install');
ok(JSON.parse(readFileSync(path.join(old,'package.json'))).version==='0.4.0','plugin version advanced');
ok(existsSync(path.join(old,'bin/helm.mjs')),'helm CLI installed');
ok(node(['update.mjs','--into',old]).stdout.includes('Already at'),'same-version update no-op');
const project=path.join(tmp,'project');mkdirSync(project);git(project,'init','-q','-b','main');
const init=node([path.join(root,'bin/helm.mjs'),'init',project,'--name','Upgrade Test','--brief','existing product'],project);
ok(init.status===0,init.stderr||'project init succeeded');
const kit=path.join(project,'.agents/product-kit');ok(existsSync(path.join(kit,'origin.json')),'origin marker written');
ok(JSON.parse(readFileSync(path.join(kit,'origin.json'))).pluginVersion==='0.4.0','origin has current version');
const sc=node([path.join(kit,'kit.mjs'),'scan'],project);ok(sc.status===0&&/scan/i.test(sc.stdout),'read-only scan');
const before=readFileSync(path.join(kit,'milestones.json'),'utf8');
const re=node([path.join(root,'bin/helm.mjs'),'upgrade-project','--path',project,'--force'],project);
ok(re.status===0,re.stderr||'forced project refresh');
ok(readFileSync(path.join(kit,'milestones.json'),'utf8')===before,'project roadmap preserved');
ok(existsSync(path.join(kit,'archive')),'old engine backed up');
console.log(n+'/'+n+' checks passed');
}finally{rmSync(tmp,{recursive:true,force:true})}
