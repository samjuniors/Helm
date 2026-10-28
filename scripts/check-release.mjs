#!/usr/bin/env node
import{readFileSync,existsSync}from'node:fs';import{resolve,dirname}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),rd=p=>readFileSync(resolve(root,p),'utf8'),j=p=>JSON.parse(rd(p)),pkg=j('package.json'),err=[];
if(pkg.name!=='@samjuniors/helm'||!/^\d+\.\d+\.\d+$/.test(pkg.version)||pkg.bin?.helm!=='./bin/helm.mjs')err.push('invalid npm package name, version or bin');
for(const p of['plugin.json','.claude-plugin/plugin.json']){let x=j(p);if(x.version!==pkg.version||x.name!=='helm')err.push(p+' version/name mismatch')}
if(!j('.mcp.json').mcpServers?.helm||!j('mcp_config.json').mcpServers?.helm)err.push('MCP registration missing');
if(!rd('server/mcp.mjs').includes("const VERSION = '"+pkg.version+"';"))err.push('server version drift');
if(!rd('CHANGELOG.md').includes('## '+pkg.version))err.push('changelog version missing');
for(const p of['LICENSE','README.md','download.mjs','update.mjs','install.mjs','rename.mjs','tests/e2e.mjs','SECURITY.md','CONTRIBUTING.md','tests/update-test.mjs','tests/init-safety-test.mjs','tests/rename-test.mjs','tests/v041-compat-test.mjs','scripts/check-repo.mjs','.github/workflows/release.yml'])if(!existsSync(resolve(root,p)))err.push('missing '+p);
if(err.length){err.forEach(e=>console.error('FAIL '+e));process.exit(1)}console.log('Helm release metadata OK: '+pkg.version);
