import dns from 'node:dns/promises';import net from 'node:net';import {createClient} from '@supabase/supabase-js';
export const priv=ip=>{if(net.isIPv6(ip)){const l=ip.toLowerCase();return l==='::1'||l==='::'||/^f[cd]|^fe80/.test(l)||(l.startsWith('::ffff:')&&priv(l.slice(7)))}
const[a,b]=ip.split('.').map(Number);return a===10||a===127||a===0||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)};
async function safeFetch(u,hops=0){const url=new URL(u);if(!['http:','https:'].includes(url.protocol)||(url.port&&!['80','443'].includes(url.port)))throw new Error('URL refusée');
const ad=await dns.lookup(url.hostname,{all:true});if(!ad.length||ad.some(x=>priv(x.address)))throw new Error('Adresse interne refusée');
const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{'user-agent':'ATableImport/1.0'}});
const loc=r.headers.get('location');if(r.status>=300&&r.status<400&&loc){if(hops>=3)throw new Error('Trop de redirections');return safeFetch(new URL(loc,url).href,hops+1)}
if(!r.ok)throw new Error('Accès refusé ou page introuvable (HTTP '+r.status+') : aucun contournement tenté');
const rd=r.body.getReader(),ch=[];let n=0;for(;;){const{done,value}=await rd.read();if(done)break;n+=value.length;if(n>2e6){await rd.cancel();throw new Error('Page trop volumineuse')}ch.push(value)}return Buffer.concat(ch).toString('utf8')}
const mins=d=>{const m=/^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(d||'');return m?(+m[1]||0)*60+(+m[2]||0):null};
const steps=x=>(Array.isArray(x)?x:[x]).flatMap(s=>typeof s==='string'?[s]:s&&s.itemListElement?steps(s.itemListElement):s&&s.text?[s.text]:[]).filter(Boolean);
export function parseRecipe(html,src){const w=[];let rec=null;
for(const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)){let j;try{j=JSON.parse(m[1])}catch{continue}
const f=n=>Array.isArray(n)?n.map(f).find(Boolean):n&&n['@graph']?f(n['@graph']):n&&[].concat(n['@type']).includes('Recipe')?n:null;rec=f(j);if(rec)break}
if(!rec)return{found:false,warnings:['Aucune donnée Schema.org Recipe : saisie manuelle ou extraction assistée à valider.']};
const ing=[].concat(rec.recipeIngredient||[]).map(raw=>({raw:String(raw),key:null,qty:null,unit:null})); // rapprochement avec le catalogue : à faire par l'admin
const st=steps(rec.recipeInstructions||[]),sv=parseInt([].concat(rec.recipeYield||[])[0]);
if(!ing.length)w.push('Ingrédients absents');if(!st.length)w.push('Étapes absentes');if(!sv)w.push('Portions absentes');if(ing.length)w.push('Quantités et unités non structurées : à vérifier');
const img=[].concat(rec.image||[])[0];
return{found:true,warnings:w,recipe:{title:rec.name||null,description:rec.description||null,servings:sv||null,prep_min:mins(rec.prepTime),cook_min:mins(rec.cookTime),ingredients:ing,steps:st,
author:rec.author&&(rec.author.name||rec.author)||null,source_url:src,image_url:typeof img==='string'?img:img&&img.url||null,image_reuse_ok:false,status:'draft'}}}
export default async function handler(req,res){if(req.method!=='POST')return res.status(405).end();
try{const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{global:{headers:{Authorization:req.headers.authorization||''}}});
const{data:{user}}=await sb.auth.getUser();if(!user)return res.status(401).json({error:'Connexion requise'});
const{data:p}=await sb.from('profiles').select('role').eq('id',user.id).single();if(!p||p.role!=='admin')return res.status(403).json({error:'Accès réservé'});
const url=new URL(req.body&&req.body.url).href,{data:dup}=await sb.from('recipes').select('id').eq('source_url',url).maybeSingle();
const out=parseRecipe(await safeFetch(url),url);res.status(200).json({...out,duplicate:dup?dup.id:null})}catch(e){res.status(400).json({error:e.message})}}
