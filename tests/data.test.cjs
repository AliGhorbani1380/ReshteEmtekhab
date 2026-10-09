const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const seed = JSON.parse(fs.readFileSync(path.join(root,'src/seed.json'),'utf8'));
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'src/data.js'),'utf8'),context);
const entries = context.window.DEFAULT_CHOICES;
test('initial data has exactly 136 numbered rows',()=>{
  assert.equal(entries.length,136);
  assert.deepEqual(Array.from(entries, x=>x.sourceRow),Array.from({length:136},(_,i)=>i+1));
});
test('seed.json matches production defaults',()=>assert.equal(JSON.stringify(seed),JSON.stringify(entries)));
test('IDs are unique and readable',()=>{
  assert.equal(new Set(entries.map(x=>x.id)).size,136);
  assert.ok(entries.every(x=>x.title.length>2));
  assert.ok(entries.every(x=>Number.isInteger(x.sourcePage)));
});
test('only numbered crossed-out rows are inactive',()=>{
  assert.deepEqual(Array.from(entries.filter(x=>!x.active),x=>x.sourceRow),[40,50]);
});
test('each item points at one of the eight source scans',()=>{
  for(const item of entries) assert.ok(fs.existsSync(path.join(root,'assets/sources',`${item.sourcePage}.jpg`)));
});
test('important rows match the photographs order',()=>{
  assert.match(entries[0].title,/دندان‌پزشکی/);
  assert.match(entries[33].title,/پزشکی روزانه شیراز/);
  assert.match(entries[88].title,/داروسازی روزانه شیراز/);
  assert.match(entries[132].title,/فیزیوتراپی/);
  assert.match(entries[135].title,/پزشکی تعهدی جهرم/);
});
