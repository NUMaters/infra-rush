import { chromium } from '/Users/root1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const results=[];
try {
for(const [name,width,height,mobile] of [['desktop',1440,900,false],['mobile',390,844,true]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const start=Date.now();await page.goto((process.env.BASE_URL??'http://localhost:5173/')+'?qa');await page.locator('#start').waitFor({timeout:120000});const load=Date.now()-start;console.log(name+' title loaded');
 await page.screenshot({path:`docs/qa/${name}-title.png`});
 await page.locator('[data-difficulty="easy"]').click();await page.locator('#start').click();console.log(name+' started');
 for(let i=0;i<5;i++){await page.locator(`[data-bot="blue-${i}"]`).click();await page.locator('[data-action="mine"]').click();}
 console.log(name+' mining ordered');await page.evaluate(()=>window.infraQA.advance(32));const mined=await page.evaluate(()=>window.infraQA.snapshot());if(mined.teams.blue.resources.stone<50)throw Error('Mining did not produce stone50');
 await page.locator('[data-bot="blue-0"]').click();await page.screenshot({path:`docs/qa/${name}-mining.png`});await page.locator('[data-action="build"]').click();
 await page.evaluate(()=>window.infraQA.advance(24));let s=await page.evaluate(()=>window.infraQA.snapshot());if(s.bridges[0].level!==1)throw Error('Bridge missing');
 await page.locator('[data-bot="blue-0"]').click();await page.locator('[data-action="march"]').click();await page.evaluate(()=>window.infraQA.advance(15));s=await page.evaluate(()=>window.infraQA.snapshot());if(s.teams.red.hp!==4||s.bots[0].state!=='IDLE')throw Error(`Attack/return failed ${s.teams.red.hp} ${s.bots[0].state}`);
 await page.screenshot({path:`docs/qa/${name}-bridge.png`});
 for(let i=1;i<5;i++){await page.locator(`[data-bot="blue-${i}"]`).click();await page.locator('[data-action="march"]').click();}
 await page.evaluate(()=>window.infraQA.advance(26));s=await page.evaluate(()=>window.infraQA.snapshot());if(s.winner!=='blue')throw Error(`Winner ${s.winner}`);await page.screenshot({path:`docs/qa/${name}-result.png`});
 const metrics=await page.evaluate(()=>window.infraQA.metrics());const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 await page.locator('#restart').click();s=await page.evaluate(()=>window.infraQA.snapshot());if(s.teams.red.hp!==5||s.bridges.some(b=>b.level))throw Error('Restart failed');
 results.push({name,loadMs:load,metrics,errors,overflow,coreLoop:'passed',victory:'passed',restart:'passed'});console.log(JSON.stringify(results.at(-1)));await context.close();
}
} finally {await writeFile('docs/qa/browser-results.json',JSON.stringify(results,null,2));await browser.close();}
