const path = require("path");
const root = path.resolve(__dirname, "../../..");
process.chdir(root);
const fs = require("fs"), http = require("http"), { build } = require("esbuild");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const output = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {Room} from './apps/web/src/screens/Room';
window.stats={bubbles:0,artifacts:0,storage:0,tasks:0};window.samples=[];
const original=Storage.prototype.setItem;Storage.prototype.setItem=function(...a){const t=performance.now();try{return original.apply(this,a)}finally{window.stats.storage+=performance.now()-t}};
sessionStorage.setItem('room:ABC-DEF-GHJ:self',JSON.stringify({name:'Tester',role:'Reviewer'}));
document.addEventListener('input',e=>{if(e.target.tagName!=='TEXTAREA')return;const t=performance.now();window.stats={bubbles:0,artifacts:0,storage:0,tasks:0};requestAnimationFrame(()=>window.samples.push({ms:performance.now()-t,...window.stats}))},true);
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/r/ABC-DEF-GHJ']}><Routes><Route path='/r/:code' element={<Room/>}/></Routes></MemoryRouter>);`, resolveDir: root, loader: "tsx" }, jsx: "automatic", bundle: true, write: false, format: "iife", define: { "process.env.NODE_ENV": '"production"', "import.meta.env": JSON.stringify({ VITE_UPSTASH_REDIS_REST_URL: "/unused", VITE_UPSTASH_REDIS_REST_TOKEN: "test-placeholder" }) }, plugins: [{ name: "isolated", setup(b) {
    b.onResolve({ filter: /^@agent-room\/upstash-client$/ }, () => ({ path: path.join(root, "packages/upstash-client/src/index.ts") }));
    b.onLoad({ filter: /hooks[\\/]useRoom\.ts$/ }, () => ({ loader: "ts", contents: `const n=Number(new URLSearchParams(location.search).get('n'));const noop=async()=>{};const participants=[{name:'Tester',client:'web',role:'Reviewer',lastSeenAt:Date.now(),canSpeak:true},{name:'Agent',client:'cc',role:'Engineer',lastSeenAt:Date.now(),canSpeak:true}];const messages=Array.from({length:n},(_,i)=>({id:String(i),name:'Agent',client:'cc',role:'Engineer',initials:'AG',color:'#334455',time:Date.now(),type:'chat',text:'Review step '+i+' **Implementation details**\\n\\nThe component validates input, preserves state, and reports errors. '.repeat(5)+'\\n- Verify behavior\\n- Check edge cases\\n\\n\`src/component.ts\`'}));const result={room:{code:'ABC-DEF-GHJ',topic:'Performance fixture',createdBy:'Tester',createdAt:Date.now(),status:'active',participants,replyMode:'open'},messages,error:null,sendMessage:noop,refreshRoom:noop,forceRefresh:noop};export function useRoom(){return result}` }));
    b.onLoad({ filter: /hooks[\\/]useTaskBoard\.ts$/ }, () => ({ loader: "ts", contents: `import {useState} from 'react';const state={board:{tasks:Array.from({length:200},(_,i)=>({id:'T-'+i,title:'Review task '+i,state:'in_progress',owner:'Agent',createdBy:'Tester',createdAt:1,updatedAt:1,dod:'Validate result'}))},loaded:true,busy:false,error:null,reload:async()=>{},run:async()=>{}};export function useTaskBoard(){const [value,setValue]=useState(state);window.refreshFixtureBoard=()=>setValue({...state,board:{tasks:[...state.board.tasks,{id:'NEW',title:'Incoming task update',state:'todo',createdBy:'Tester',createdAt:1,updatedAt:1}]}});return value}` }));
    b.onLoad({ filter: /screens[\\/]Room\.tsx$/ }, (args) => ({ loader: "tsx", contents: fs.readFileSync(args.path, "utf8").replace("    el.style.height = 'auto';", process.env.NO_GROW ? "    return;" : "    el.style.height = 'auto';").replace("extractArtifacts(messages);", "(()=>{const t=performance.now();const result=extractArtifacts(messages);window.stats.artifacts+=performance.now()-t;return result})();") }));
    b.onLoad({ filter: /components[\\/]TaskBoard\.tsx$/ }, (args) => ({ loader: "tsx", contents: fs.readFileSync(args.path, "utf8").replace("const [", "window.stats.tasks++; const [") }));
    b.onLoad({ filter: /components[\\/]Bubble\.tsx$/ }, (args) => ({ loader: "tsx", contents: fs.readFileSync(args.path, "utf8").replace("export const Bubble = memo(function Bubble({ message, self, ambiguousNames }: Props) {", "export const Bubble = memo(function Bubble({ message, self, ambiguousNames }: Props) { window.stats.bubbles++;") }));
  } }] });
  const css = fs.readFileSync("apps/web/dist/assets/" + fs.readdirSync("apps/web/dist/assets").find((x) => x.endsWith(".css")), "utf8");
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/app.js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8");
    res.end(req.url === "/app.js" ? output.outputFiles[0].text : `<style>${css}</style><div id='root'></div><script src='/app.js'><\/script>`);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const results = [];
  try {
    for (const n of [1e3]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1e3 } });
      page.on("pageerror", (e) => console.error(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/?n=${n}`);
      const input = page.getByPlaceholder("Message the room\u2026");
      await input.waitFor();
      await input.click();
      await page.keyboard.type("x", { delay: 0 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      console.log("first-key", await page.evaluate(() => window.samples));
      await page.keyboard.type("xxx", { delay: 0 });
      await page.evaluate(() => {
        window.samples = [];
      });
      for (let i = 0; i < 40; i++) {
        await page.keyboard.type("x");
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }
      const samples = await page.evaluate(() => window.samples);
      const ms = samples.map((x) => x.ms).sort((a, b) => a - b);
      results.push({ messages: n, samples: samples.length, medianMs: ms[Math.floor(ms.length / 2)], p95Ms: ms[Math.floor(ms.length * 0.95)], bubblesPerKey: samples.reduce((a, x) => a + x.bubbles, 0) / samples.length, artifactMeanMs: samples.reduce((a, x) => a + x.artifacts, 0) / samples.length, taskRendersPerKey: samples.reduce((a, x) => a + x.tasks, 0) / samples.length, storageMeanMs: samples.reduce((a, x) => a + x.storage, 0) / samples.length });
      if (samples.some((x) => x.tasks)) throw Error("Task board rerendered during typing");
      if (n === 1e3) {
        await page.evaluate(() => window.refreshFixtureBoard());
        await page.getByText("Incoming task update", { exact: true }).waitFor();
        await input.fill("line\n".repeat(20));
        await page.waitForFunction(() => document.querySelector("textarea:not([aria-hidden])").style.height === "200px");
        await input.fill("");
        await page.waitForFunction(() => document.querySelector("textarea:not([aria-hidden])").style.height === "42px");
        await input.fill("word ".repeat(30));
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const height = await input.evaluate((el) => el.getBoundingClientRect().height);
        if (height <= 42) throw Error("Narrow viewport did not grow");
        await page.setViewportSize({ width: 1440, height: 1e3 });
        await input.fill("short");
        await page.waitForFunction(() => document.querySelector("textarea:not([aria-hidden])").style.height === "42px");
        console.log("PASS: multiline growth, height cap, clearing, narrow viewport and shrinking.");
      }
      await page.close();
    }
    fs.mkdirSync(".local", { recursive: true });
    fs.writeFileSync(".local/composer-performance.json", JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
