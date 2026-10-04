import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({executablePath:process.env.PDF_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true});
const report = [];
try {
  for (const slug of ['playbook','vendor-vetting-checklist']) {
    const page = await browser.newPage({viewport:{width:816,height:1056},deviceScaleFactor:1});
    await page.route(/^https?:\/\//, route => route.abort());
    await page.goto(pathToFileURL(path.join(root,slug+'.html')).href);
    await page.emulateMedia({media:'print'});
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p,i) => {
      const footer = p.querySelector('.footer').getBoundingClientRect();
      const content = p.querySelector('.page-body');
      const overflowing = [...content.querySelectorAll('*')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width && r.height && (r.bottom > footer.top-14 || r.right > p.getBoundingClientRect().right-40 || r.left < p.getBoundingClientRect().left+40);
      }).map(e=>({tag:e.tagName,text:e.textContent.trim().slice(0,100)}));
      return {page:i+1,title:p.querySelector('h1,h2')?.textContent,contentBottom:content.getBoundingClientRect().bottom,footerTop:footer.top,overflowing};
    }));
    const images = await page.evaluate(() => [...document.images].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})));
    await page.pdf({path:path.join(root,slug+'.pdf'),format:'Letter',printBackground:true,preferCSSPageSize:true,tagged:true,outline:true});
    const links = await page.locator('a').evaluateAll(els=>els.map(a=>({label:a.textContent.trim(),href:a.href})));
    report.push({slug,pages:layout.length,layout,images,links});
    await page.close();
  }
  await fs.writeFile(path.join(root,'layout-check.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.map(r=>({slug:r.slug,pages:r.pages,overflow:r.layout.filter(p=>p.overflowing.length).map(p=>({page:p.page,excess:Math.ceil(p.contentBottom-p.footerTop+14)})),images:r.images.length,links:r.links.length})),null,2));
  if(report.some(r=>r.layout.some(p=>p.overflowing.length)||r.images.some(i=>!i.loaded))) throw new Error('Layout or image failure: see layout-check.json');
} finally {await browser.close();}
