import fs from 'node:fs';
import {Simulation} from '../.test-build/core/simulation.js';
import {newGame,createReward,makeItem} from '../.test-build/core/progression.js';
import {mainPortals} from '../.test-build/world/world.js';
import {envelope} from '../.test-build/core/validation.js';
fs.mkdirSync('evidence/fixtures',{recursive:true});
// These fixtures are for integration tests of persistence/screens, NOT playthrough evidence.
const world=newGame(19320422,'lineman');const first=mainPortals(world.seed)[0];world.player.x=first.x;world.player.z=first.z+3;
fs.writeFileSync('evidence/fixtures/near-portal.json',JSON.stringify(envelope(world)));
const sim=new Simulation(world);sim.portalEnter(sim.world.main[0]);for(const e of sim.enemies()){e.dead=true;e.hp=0;}
world.phase='reward';world.reward=createReward(world);
while(world.inventory.length<24)world.inventory.push(makeItem(world.inventory.length,1,'lineman',`fixture:${world.inventory.length}`));
fs.writeFileSync('evidence/fixtures/pending-reward-full-bag.json',JSON.stringify(envelope(world)));
fs.writeFileSync('evidence/fixtures/invalid.json','{"format":"isobara-save","schema":999,"payload":"broken"}');
const workshop=newGame(19320422,'lineman');workshop.shards=5000;workshop.stats.bestTier=2;workshop.crafts=10;
for(let n=1;n<=4;n++){const item=makeItem(n,2,'lineman',`craft:${workshop.seed}:${n}`,{slot:n===4?'shell':'instrument'});item.rarity=n===3?3:1;item.effect=n===3?'first':'none';if(n===2)item.family='inductor';workshop.inventory.push(item);}
fs.writeFileSync('evidence/fixtures/workshop.json',JSON.stringify(envelope(workshop)));
const restored=structuredClone(workshop);restored.seals=[1,2,3,4,5];restored.discovered.push('final');
fs.writeFileSync('evidence/fixtures/restored.json',JSON.stringify(envelope(restored)));
