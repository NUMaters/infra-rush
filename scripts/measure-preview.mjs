// Production UI and timing smoke test. Viewport emulation is not a physical phone.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const records=[];
try {
  for (const [name,width,height,mobile] of [['desktop',1440,900,false],['mobile',390,844,true]]) {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const start=Date.now();await page.goto(process.env.BASE_URL || 'http://localhost:5177/');
    await page.locator('#start').waitFor({timeout:60000});const loadMs=Date.now()-start;
    await page.screenshot({path:`docs/qa/${name}-production-title.png`});
    await page.locator('[data-difficulty="easy"]').click();await page.locator('#start').click();
    await page.keyboard.press("1");await page.locator('[data-action="mine"]').click();
    const performanceSample=await page.evaluate(()=>new Promise(resolve=>{
      const times=[];let previous=performance.now();const begin=previous;
      const frame=(now)=>{times.push(now-previous);previous=now;if(times.length<180 && now-begin<12000){requestAnimationFrame(frame);return;}
        const sorted=times.slice(5).sort((a,b)=>a-b);const mean=sorted.reduce((a,b)=>a+b,0)/sorted.length;
        resolve({frames:sorted.length,fps:1000/mean,p95FrameMs:sorted[Math.floor(sorted.length*.95)],heapMB:performance.memory?.usedJSHeapSize/1048576 ?? null});};requestAnimationFrame(frame);
    }));
    await page.screenshot({path:`docs/qa/${name}-production-game.png`});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    records.push({name,viewport:{width,height},physicalDevice:false,loadMs,...performanceSample,overflow,errors});
    await context.close();
  }
} finally {await browser.close();await writeFile('docs/qa/production-performance.json',JSON.stringify(records,null,2)+'\n');}
console.log(JSON.stringify(records,null,2));
