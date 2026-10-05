import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { declareSchema } from '@/lib/db';
import { parseNewInventoryItem } from '@/features/inventory/domain';
import { parseContainer, parseContentText, parseSpace, isValidContainerCode } from '@/features/storage/domain';
import { parseMember } from '@/features/members/domain';
import { parseRecipe } from '@/features/recipes/domain';
import { parseEvent } from '@/features/calendar/domain';
import { demoData, populateDemo } from './seed';

test('la casa demo conserva relaciones válidas, perfiles y ejemplos locales', () => {
  const data=demoData();
  const t=data.tables;
  assert.equal(data.schemaVersion,12);
  assert.equal(t.members.length,8);
  assert.equal(t.recipes.length,15);
  assert.equal(t.comments.length,47);
  for (const comment of t.comments) { assert(t.recipes.some(r=>r.id===comment.ownerId)); assert(t.members.some(m=>m.id===comment.authorId)); }
  assert.equal(t.inventory.length,84);
  assert.equal(t.members.filter(m=>m.role==='admin').length,1);
  assert.equal(new Set(t.containers.map(c=>c.code)).size,t.containers.length);
  for(const space of t.spaces) parseSpace(space as Parameters<typeof parseSpace>[0]);
  for(const member of t.members) { parseMember(member as Parameters<typeof parseMember>[0]); assert(!('userId' in member)); assert(!('pin' in member)); }
  for(const c of t.containers){parseContainer(c as Parameters<typeof parseContainer>[0]);assert(isValidContainerCode(c.code));assert(t.spaces.some(s=>s.id===c.spaceId));}
  for(const item of t.inventory){parseNewInventoryItem(item);assert(t.containers.some(c=>c.id===item.containerId));}
  for(const c of t.containerContents){parseContentText(c.text);assert(t.containers.some(p=>p.id===c.containerId));}
  for(const price of t.prices){assert(t.inventory.some(i=>i.id===price.itemId));assert(Number.isInteger(price.amountCents)&&price.amountCents>0);}
  for(const recipe of t.recipes){parseRecipe(recipe as Parameters<typeof parseRecipe>[0]);for(const i of recipe.ingredients) if('itemId' in i) assert(t.inventory.some(p=>p.id===i.itemId));}
  for(const event of t.events) parseEvent(event as Parameters<typeof parseEvent>[0]);
  for(const photo of t.photos){assert(t.containers.some(c=>c.id===photo.ownerId));assert(photo.blob.$blob.length>0);}
  assert(!('syncState' in t));
});

test('cada visitante conserva su copia; abrirla de nuevo no repuebla ni pisa cambios', async () => {
  const a=new Dexie('DemoVisitorA'), b=new Dexie('DemoVisitorB');
  for(const instance of [a,b]) {declareSchema(instance);instance.on('populate',populateDemo);}
  try {
    await a.open();await b.open();
    const item=await a.table('inventory').toCollection().first();
    await a.table('inventory').update(item.id,{quantity:999});
    assert.notEqual((await b.table('inventory').get(item.id)).quantity,999);
    await a.transaction("rw", a.tables, populateDemo);
    assert.equal(await a.table("inventory").count(),84);
    a.close();await a.open();
    assert.equal((await a.table('inventory').get(item.id)).quantity,999);
    const photo=await a.table('photos').toCollection().first();
    assert(photo.blob instanceof Blob && photo.blob.size>0);
  } finally {await a.delete();await b.delete();}
});
