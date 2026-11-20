// Run with: node scripts/check-scale.mjs. Exercises mock services without a browser.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "finchbound-check-"));
const tsUrl = pathToFileURL(path.resolve("node_modules/typescript/lib/typescript.js")).href;
const loader = `import fs from 'node:fs';
import ts from ${JSON.stringify(tsUrl)};
export async function resolve(spec,ctx,next){try{return await next(spec,ctx)}catch(e){if(spec.startsWith('.'))for(const ext of ['.ts','.tsx']){try{return await next((spec.endsWith('.js')?spec.slice(0,-3):spec)+ext,ctx)}catch{}}throw e}}
export async function load(url,ctx,next){if(/\\.tsx?$/.test(url))return{format:'module',shortCircuit:true,source:ts.transpileModule(fs.readFileSync(new URL(url),'utf8').replaceAll('import.meta.env', '{DEV:false}'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText};return next(url,ctx)}
`;
fs.writeFileSync(path.join(temp, "loader.mjs"), loader);
const test = `import assert from 'node:assert/strict';
const root=${JSON.stringify(pathToFileURL(process.cwd() + path.sep).href)};
const local=p=>import(new URL(p,root).href);
const storage=new Map();
globalThis.sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
let interval;
globalThis.window={setTimeout:fn=>setTimeout(fn,0),setInterval:fn=>{interval=fn;return 1},clearInterval:()=>{}};
const {listBooks}=await local('src/api/books.ts');
const {listPages}=await local('src/api/pages.ts');
const {listSubmissions,subscribeToSubmissions}=await local('src/api/submissions.ts');
const {cropRect}=await local('src/components/CropModal.tsx');
const {getAccount,updateAccount,changePassword,deleteAccount}=await local('src/api/account.ts');
const {signIn,signOut}=await local('src/api/auth.ts');
const {guestJoinUrl,resolveRoute}=await local('src/lib/routing.ts');
const shared=guestJoinUrl('summer-party','https://example.test/finchbound/?variant=old#/hub/b1');
assert.equal(shared,'https://example.test/summer-party/join');
assert.equal(resolveRoute(new URL(shared).pathname.slice(1).split('/'))[0],'GuestWelcome');
const {paginateText}=await local('src/lib/pagination.ts');
for (const text of ['hello '.repeat(300), 'a'.repeat(600), 'one\\ntwo\\nthree', '\u{1f642}'.repeat(100), '']) {
 const parts=paginateText(text, value=>Array.from(value).length<=35);
 assert.equal(parts.join(''),text);
 assert.ok(parts.every(part=>Array.from(part).length<=35));
}
const {updateGuestDraft,startAnotherGuestDraft}=await local('src/screens/guest/guestDraft.ts');
const revoked=[];const originalRevoke=URL.revokeObjectURL;URL.revokeObjectURL=url=>revoked.push(url);
updateGuestDraft('draft-a',{photo:'blob:first'});updateGuestDraft('draft-a',{message:'retained'});
assert.deepEqual(revoked,[]);updateGuestDraft('draft-a',{photo:'blob:first'});assert.deepEqual(revoked,[]);
updateGuestDraft('draft-a',{photo:'blob:second'});assert.deepEqual(revoked,['blob:first']);
updateGuestDraft('draft-b',{photo:'https://example.test/photo.jpg'});startAnotherGuestDraft('draft-b');assert.equal(revoked.length,1);
startAnotherGuestDraft('draft-a');assert.deepEqual(revoked,['blob:first','blob:second']);URL.revokeObjectURL=originalRevoke;
const {createElement}=await local('node_modules/react/index.js');const {renderToStaticMarkup}=await local('node_modules/react-dom/server.node.js');
const {Button}=await local('src/ui.tsx');
const primary=renderToStaticMarkup(createElement(Button,{},'Save'));
assert.match(primary,/bg-crimson-strong/);assert.ok(primary.includes('hover:bg-[#A8222D]'));
const css=(await import('node:fs')).readFileSync(new URL('src/index.css',root),'utf8');
const strong=css.match(/--color-crimson-strong: (#[0-9a-f]+)/i)[1];
const luminance=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0);
assert.ok(1.05/(luminance(strong)+0.05)>=4.5);assert.ok(luminance('#A8222D')<luminance(strong));
let cropCases=0;
for(const [w,h]of[[1600,900],[900,1600],[1000,1000]])for(const ratio of[1,4/3])for(const x of[0,50,100])for(const y of[0,50,100])for(const zoom of[1,2,3]){const r=cropRect(w,h,ratio,x,y,zoom);assert.ok(Math.abs(r.sw/r.sh-ratio)<1e-8);assert.ok(r.sx>=0&&r.sy>=0&&r.sx+r.sw<=w+1e-6&&r.sy+r.sh<=h+1e-6);cropCases++}
const user={id:'host-1',name:'Avery',email:'avery@gmail.com',plan:'Free'};
const {getSessionSnapshot}=await local('src/api/session.ts');
const exchange=(method,path,body,status,result)=>{
  globalThis.fetch=async(url,init)=>{
    assert.equal(url,'/api'+path);assert.equal(init.method,method);
    assert.equal(init.credentials,'same-origin');
    assert.deepEqual(init.body && JSON.parse(init.body),body);
    return new Response(status===204?null:JSON.stringify(result),{status});
  };
};
exchange('GET','/books?q=Summer+diary&cursor=next&limit=12',undefined,200,{items:[{id:'book'}],nextCursor:'following'});
assert.equal((await listBooks({q:'Summer diary',cursor:'next',limit:12})).nextCursor,'following');
exchange('GET','/books/book/pages?sort=edited&withPhoto=true&q=sunset',undefined,200,{items:[],nextCursor:null});
assert.equal((await listPages('book',{sort:'edited',withPhoto:true,q:'sunset'})).items.length,0);
exchange('GET','/books/b1/submissions?status=pending&q=Guest&withPhoto=true&cursor=next',undefined,200,{items:[],nextCursor:null,counts:{pending:12}});
assert.equal((await listSubmissions('b1',{status:'pending',q:'Guest',withPhoto:true,cursor:'next'})).counts.pending,12);
exchange('GET','/account',undefined,200,{user});assert.deepEqual((await getAccount()).user,user);
const patch={name:'Avery',email:'taken@gmail.com'};
exchange('PATCH','/account',patch,409,{error:{code:'EMAIL_TAKEN',message:'Email in use'}});
await assert.rejects(()=>updateAccount(patch),e=>e.code==='EMAIL_TAKEN');
const login={email:user.email,password:'test-password',remember:false};
exchange('POST','/auth/login',login,200,{user});assert.deepEqual(await signIn(login),user);
assert.deepEqual(getSessionSnapshot(),user);
exchange('POST','/account/password',{currentPassword:'old',newPassword:'new'},200,{ok:true});
await changePassword('old','new');assert.equal(getSessionSnapshot(),null);
exchange('DELETE','/account',{email:user.email},200,{ok:true});await deleteAccount(user.email);
exchange('POST','/auth/logout',undefined,204);await signOut();
exchange('GET','/books',undefined,500,{error:{code:'SERVER',message:'Unavailable'}});
await assert.rejects(()=>listBooks(),e=>e.code==='SERVER');
console.log(JSON.stringify({result:'PASS',cropCases,checks:['moderation filters, cursor and counts','book and page HTTP filters, sort and cursor','crop ratios and bounds','account HTTP requests and conflict handling','cookie session sign-in and logout','password change and account deletion requests','API failure response','share URL routing','draft photo lifetime','primary contrast']},null,2));
`;
fs.writeFileSync(path.join(temp, "test.mjs"), test);
const result = spawnSync(
  process.execPath,
  [
    "--no-warnings",
    "--loader",
    pathToFileURL(path.join(temp, "loader.mjs")).href,
    path.join(temp, "test.mjs"),
  ],
  { encoding: "utf8", cwd: process.cwd() },
);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status ?? 1;
