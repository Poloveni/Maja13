import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const ignored = new Set(['node_modules', '.npm-cache', '.git']);
const files = [];

function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(root);

const errors = [];
const textFiles = files.filter(file => /\.(?:html|css|js|mjs|ts|sql|json|xml|md|yml|yaml|txt)$/i.test(file));
const forbidden = [
  /famille\s*moni/i,
  /roxwood/i,
  /YOUR_PROJECT_REF/i,
  /1450234264305008693|1489387311245558004|nM3ttEtYz|8zBwmG4y3/,
  /BCLzeteW_uRb6hKgzoCTgLZSCEqa71675H53SvoM1ZmFBXBn6tC2NJBMiko0d6Zp4Bs_BGzJqn6JlP4h8ho5hfs/
];

for (const file of textFiles) {
  const rel = path.relative(root, file);
  const source = fs.readFileSync(file, 'utf8');
  if (rel !== path.join('scripts', 'check-project.mjs')) {
    for (const pattern of forbidden) {
      if (pattern.test(source)) errors.push(`${rel}: ancienne référence ou valeur privée détectée (${pattern})`);
    }
  }
  if (/\.json$/i.test(file)) {
    try { JSON.parse(source); } catch (error) { errors.push(`${rel}: JSON invalide — ${error.message}`); }
  }
  if (/\.(?:js|mjs)$/i.test(file)) {
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (checked.status !== 0) errors.push(`${rel}: JavaScript invalide — ${(checked.stderr || checked.stdout).trim()}`);
  }
  if (/\.html$/i.test(file)) {
    const scripts = [...source.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)];
    scripts.forEach((match, index) => {
      if (/application\/ld\+json/i.test(match[1])) return;
      try { new vm.Script(match[2], { filename: `${rel}#script-${index + 1}` }); }
      catch (error) { errors.push(`${rel}: script intégré ${index + 1} invalide — ${error.message}`); }
    });
    const localRefs = [...source.matchAll(/(?:href|src)=["']([^"'#?]+)["']/gi)].map(match => match[1]);
    for (const ref of localRefs) {
      if (/^(?:https?:|data:|mailto:|tel:|\/\/)/i.test(ref)) continue;
      if (/[${}]/.test(ref)) continue;
      const target = path.resolve(path.dirname(file), decodeURIComponent(ref));
      if (!fs.existsSync(target)) errors.push(`${rel}: ressource locale absente — ${ref}`);
    }
  }
}

if (errors.length) {
  console.error(`Échec des contrôles (${errors.length}) :\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Contrôles réussis : ${files.length} fichiers, syntaxe et références validées.`);
