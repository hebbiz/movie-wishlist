import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaAdvice } from '../assets/media-advice.mjs';
class Element {
  constructor(tag='div', text=''){ this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.listeners={};this.dataset={};this.hidden=false;this.open=false;this.isConnected=true;this.classList={add:()=>{}};this.textContent=text; }
  set textContent(v){this._text=String(v);this.children=[];} get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  append(...items){for(const e of items){if(e && typeof e==='object'){e.parent=this;this.children.push(e);} }}
  replaceChildren(...items){this.textContent='';this.append(...items);}
  remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
  setAttribute(k,v){this.attributes[k]=v;} addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  async click(){for(const fn of this.listeners.click??[])await fn({});} focus(){} closest(){return null;}
  showModal(){this.open=true;} close(){this.open=false;for(const fn of this.listeners.close??[])fn({});}
  contains(e){return e===this||this.children.some(x=>x.contains?.(e));}
  querySelector(sel){return this.querySelectorAll(sel)[0]??null;}
  querySelectorAll(sel){const match=e=>sel.startsWith('.')?e.className?.split(' ').includes(sel.slice(1)):sel==='button'?e.tagName==='BUTTON':sel==='textarea'?e.tagName==='TEXTAREA':sel==='h3'?e.tagName==='H3':false;return this.children.flatMap(e=>[...(match(e)?[e]:[]),...(e.querySelectorAll?.(sel)??[])]);}
}
test('rendered combined cards hide prices and transfer the exact Rakuten URL after preview',async()=>{
  const entry=new Element('button'), body=new Element('body');let output=null, calls=0;
  const doc={body,activeElement:entry,createElement:t=>new Element(t),createTextNode:t=>new Element('text',t),defaultView:{scrollY:0,scrollTo(){},requestAnimationFrame(f){f()},navigator:{}}};
  const source=(id,key,extra={})=>({id,identityStatus:'matched',provider:{key},country:'UA',...extra});
  const url='https://rakuten.tv/ua/movies/authored';
  const rows=[source('tmdb:buy','rakuten',{access:{state:'reported',value:'buy'},price:{state:'reported',amount:{state:'reported',value:'123'},currency:{state:'reported',value:'USD'}}}),source('tmdb:rent','rakuten',{access:{state:'reported',value:'rent'}}),source('kinobaza:ua','rakuten',{link:{href:url}}),source('kinobaza:block','rakuten',{country:null,kinobazaLocalization:{audio:{state:'reported-positive'},subtitles:{state:'reported-positive'}}})];
  const control=createMediaAdvice({document:doc,entry,context:()=>({userId:'u',groupId:'g',imdbId:'tt1234567',formSession:'s',title:'Film'}),capability:async()=>true,discover:async()=>{calls++;return{rows}},readForm:()=>({recommended_medium:'DVD',purchase_url:''}),writeForm:v=>output=v});
  await entry.click(); await new Promise(r=>setTimeout(r,0));
  assert.equal(control.dialog.querySelectorAll('.media-advice-row').length,1);assert.equal(control.dialog.querySelectorAll('.media-advice-variant-select').length,0);
  const text=control.dialog.textContent;assert.match(text,/Купівля \/ Оренда/);assert.match(text,/українське аудіо/i);assert.match(text,/субтитри/i);assert.doesNotMatch(text,/123|USD|Ціна/);
  const select=control.dialog.querySelectorAll('button').find(b=>b.textContent==='Обрати');await select.click();
  assert.match(control.dialog.textContent,/Перевірте зміни/);assert.equal(output,null);
  await control.dialog.querySelectorAll('button').find(b=>b.textContent==='Перенести в картку').click();
  assert.deepEqual(output,{recommended_medium:'Rakuten TV',purchase_url:url});assert.equal(calls,1);control.invalidate();
});
