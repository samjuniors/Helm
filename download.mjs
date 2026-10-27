#!/usr/bin/env node
// Authenticated download of GitHub release ZIP/tarball with SHA256 verification.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import{spawnSync}from'node:child_process';
const args=process.argv.slice(2),opt=(k,d)=>{const i=args.indexOf('--'+k);return i<0?d:args[i+1]},die=s=>{console.error('download: '+s);process.exit(1)};
if(args.includes('--help')){console.log('node download.mjs [--version X.Y.Z] [--asset zip|tgz] [--out DIR]');process.exit(0)}
const v=opt('version',null),kind=opt('asset','zip'),out=path.resolve(opt('out','.'));
if(v&&!/^\d+\.\d+\.\d+$/.test(v))die('invalid version');if(!['zip','tgz'].includes(kind))die('asset must be zip or tgz');
const gh=spawnSync('gh',['auth','token'],{encoding:'utf8',timeout:5000});
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||(gh.status===0?gh.stdout.trim():null);
const headers={'User-Agent':'helm-release-downloader','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:'Bearer '+token}:{})};
async function request(url,accept='application/vnd.github+json'){const r=await fetch(url,{headers:{...headers,Accept:accept},redirect:'follow'});if(!r.ok)die('HTTP '+r.status+'; private repo requires gh auth login or GH_TOKEN');return r}
const url='https://api.github.com/repos/samjuniors/Helm/releases/'+(v?'tags/v'+v:'latest');
const release=await(await request(url)).json(),tag=release.tag_name;
if(!/^v\d+\.\d+\.\d+$/.test(tag))die('invalid release tag');
const name='helm-'+tag+'.'+kind,assets=new Map((release.assets||[]).map(x=>[x.name,x]));
if(!assets.has(name)||!assets.has('SHA256SUMS'))die('release assets or checksum file missing');
const bytes=async item=>new Uint8Array(await(await request(item.url,'application/octet-stream')).arrayBuffer());
const checksums=new TextDecoder().decode(await bytes(assets.get('SHA256SUMS')));
const entry=checksums.split('\n').map(s=>s.match(/^([0-9a-f]{64})\s+\*?(.+)$/)).find(m=>m&&m[2]===name);
if(!entry)die('expected checksum missing');
const data=await bytes(assets.get(name)),sha=crypto.createHash('sha256').update(data).digest('hex');
if(sha!==entry[1])die('SHA256 mismatch: refusing to save');
fs.mkdirSync(out,{recursive:true});const result=path.join(out,name);fs.writeFileSync(result,data,{mode:0o600});
console.log('Verified SHA256 '+sha+'; saved '+result+'; extract and run node install.mjs, or node update.mjs --into INSTALL-DIR');
