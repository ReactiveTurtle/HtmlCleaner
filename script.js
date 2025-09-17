const pasteDiv=document.getElementById('pasteDiv');
const inputEl=document.getElementById('inputHtml');
const cleanBtn=document.getElementById('cleanBtn');
const prettyBtn=document.getElementById('prettyBtn');
const resetBtn=document.getElementById('resetBtn');
const origFrame=document.getElementById('origFrame');
const cleanFrame=document.getElementById('cleanFrame');
const cleanHtmlEl=document.getElementById('cleanHtml');
const logEl=document.getElementById('log');
const wordMode=document.getElementById('wordMode');
const htmlMode=document.getElementById('htmlMode');

let currentMode='word';
document.querySelectorAll('input[name="mode"]').forEach(r=>{
  r.addEventListener('change', e=>{
    currentMode=e.target.value;
    if(currentMode==='word'){wordMode.classList.remove('hidden'); htmlMode.classList.add('hidden');}
    else{htmlMode.classList.remove('hidden'); wordMode.classList.add('hidden');}
    cleanHtmlEl.value=''; origFrame.srcdoc=''; cleanFrame.srcdoc=''; logEl.innerHTML='';
  });
});

const TAG_RULES={
  b:{replaceWith:"strong"}, strong:{}, em:{replaceWith:"i"}, i:{}, del:{replaceWith:"s"}, s:{},
  u:{}, center:{replaceWith:"div",keepStyle:{"text-align":"center"}}, div:{}, span:{}, p:{}, br:{}, ul:{}, ol:{}, li:{}, table:{}, tr:{}, td:{}, th:{}
};
const TAG_ATTRS={div:["style"], span:["style"], p:["style"], strong:[], i:[], s:[], u:[], br:[], ul:[], ol:[], li:[], table:[], tr:[], td:[], th:[]};
const GLOBAL_ATTRS=[];
const ALLOWED_STYLES=["text-align","font-style","text-decoration","color","background-color","font-family"];
const ALLOWED_TEXT_ALIGN=["left","right","center","justify"];

function appendLog(text){const d=document.createElement('div');d.textContent=text;logEl.prepend(d);} 
function setOrigRender(src){origFrame.srcdoc=src;}
function setCleanRender(src){cleanFrame.srcdoc=src;}

function sanitizeHtml(source){
  logEl.innerHTML='';
  const parser=new DOMParser();
  const doc=parser.parseFromString(source,'text/html');

  ['script','style','iframe','object','embed','link','meta'].forEach(tag=>{
    Array.from(doc.getElementsByTagName(tag)).forEach(el=>{el.parentNode.removeChild(el); appendLog('Removed <'+tag+'>');});
  });

  const walker=doc.createTreeWalker(doc,NodeFilter.SHOW_COMMENT,null,false);
  let node;
  while(node=walker.nextNode()){node.parentNode.removeChild(node); appendLog('Removed comment');}

  Array.from(doc.body.getElementsByTagName('*')).forEach(el=>{
    let tag=el.tagName.toLowerCase();

    if(/^h[1-6]$/.test(tag)){
      const s=doc.createElement('strong'); s.innerHTML=el.innerHTML;
      el.parentNode.replaceChild(s,el); appendLog('Converted <'+tag+'> to <strong>'); el=s; tag='strong';
    }

    if(TAG_RULES[tag] && TAG_RULES[tag].replaceWith){
      const newEl=doc.createElement(TAG_RULES[tag].replaceWith);
      newEl.innerHTML=el.innerHTML;
      el.parentNode.replaceChild(newEl,el);
      appendLog('Converted <'+tag+'> to <'+TAG_RULES[tag].replaceWith+'>');
      el=newEl; tag=el.tagName.toLowerCase();
    } else if(!TAG_RULES[tag]){
      while(el.firstChild) el.parentNode.insertBefore(el.firstChild,el);
      el.parentNode.removeChild(el);
      appendLog('Removed tag <'+tag+'> but kept content');
      return;
    }

    Array.from(el.attributes||[]).forEach(a=>{
      const name=a.name.toLowerCase();
      if(!["style","data-mce-style"].includes(name)){el.removeAttribute(a.name); appendLog('Removed attribute '+a.name+' on <'+tag+'>');}
    });

    const styleAttr=el.getAttribute('style')||'';
    const val=styleAttr.toLowerCase();

    if(/font-weight\s*:\s*bold/.test(val) && tag!=="strong"){const s=doc.createElement('strong'); s.innerHTML=el.innerHTML; el.parentNode.replaceChild(s,el); appendLog('Converted font-weight:bold to <strong>'); return;}
    if(/font-style\s*:\s*italic/.test(val) && tag!=="i"){const i=doc.createElement('i'); i.innerHTML=el.innerHTML; el.parentNode.replaceChild(i,el); appendLog('Converted font-style:italic to <i>'); return;}
    if(/text-decoration\s*:\s*line-through/.test(val) && tag!=="s"){const s=doc.createElement('s'); s.innerHTML=el.innerHTML; el.parentNode.replaceChild(s,el); appendLog('Converted line-through to <s>'); return;}
    if(/text-decoration\s*:\s*underline/.test(val) && tag!=="u"){const u=doc.createElement('u'); u.innerHTML=el.innerHTML; el.parentNode.replaceChild(u,el); appendLog('Converted underline to <u>'); return;}

    const styles=styleAttr.split(';').map(s=>s.trim()).filter(Boolean);
    const kept=[];
    styles.forEach(s=>{
      const [prop,value]=s.split(':').map(x=>x.trim());
      if(ALLOWED_STYLES.includes(prop.toLowerCase()) && (prop.toLowerCase()!=="text-align" || ALLOWED_TEXT_ALIGN.includes(value.toLowerCase()))){
        if(prop.toLowerCase()!=="font-weight") kept.push(prop+': '+value);
      }
    });
    if(kept.length>0){el.setAttribute('style', kept.join('; ')); el.setAttribute('data-mce-style', kept.join('; '));}
    else{el.removeAttribute('style'); el.removeAttribute('data-mce-style');}
  });

  const wrapper = document.createElement('div');
  Array.from(doc.body.childNodes).forEach(n=>wrapper.appendChild(n.cloneNode(true)));
  return wrapper.innerHTML;
}

function prettyPrint(html){try{const p=new DOMParser();const d=p.parseFromString(html,'text/html');return d.documentElement.outerHTML;}catch(e){return html;}}

function withLoading(fn){
  cleanBtn.classList.add('is-loading');
  const targets=[origFrame, cleanFrame, cleanHtmlEl];
  targets.forEach(t=>t.classList.add('loading'));
  // Clear visible content while loading mask shows
  origFrame.srcdoc='';
  cleanFrame.srcdoc='';
  // Keep textarea text, we only mask it
  setTimeout(()=>{
    try{ fn(); } finally {
      cleanBtn.classList.remove('is-loading');
      targets.forEach(t=>t.classList.remove('loading'));
    }
  }, 300); // slight delay to ensure loader is visible before heavy work
}

cleanBtn.addEventListener('click',()=>{
  withLoading(()=>{
    const src=currentMode==='word'?pasteDiv.innerHTML:inputEl.value;
    setOrigRender(src);
    const cleaned=sanitizeHtml(src);
    cleanHtmlEl.value=cleaned;
    setCleanRender(cleaned);
    compareBtn.click();
  });
});

prettyBtn.addEventListener('click',()=>{
  const src=currentMode==='word'?pasteDiv.innerHTML:inputEl.value;
  const pretty=prettyPrint(src);
  if(currentMode==='word'){pasteDiv.innerHTML=pretty; setOrigRender(pretty);} 
  else{inputEl.value=pretty; setOrigRender(pretty);} 
});

resetBtn.addEventListener('click',()=>{pasteDiv.innerHTML=''; inputEl.value=''; cleanHtmlEl.value=''; origFrame.srcdoc=''; cleanFrame.srcdoc=''; logEl.innerHTML='';});

const copyHtmlBtn=document.getElementById('copyHtmlBtn');
const copyVisualBtn=document.getElementById('copyVisualBtn');

copyHtmlBtn.addEventListener('click',()=>{
  navigator.clipboard.writeText(cleanHtmlEl.value).then(()=>alert('Очищенный HTML скопирован'));
});

copyVisualBtn.addEventListener('click', () => {
  const html = cleanHtmlEl.value;
  const text = cleanFrame.contentDocument.body.innerText;

  if (navigator.clipboard && window.ClipboardItem) {
    const data = {
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" })
    };

    navigator.clipboard.write([new ClipboardItem(data)])
      .then(() => alert("Визуальный контент скопирован!"))
      .catch(err => {
        console.error("Ошибка при копировании:", err);
        alert("Не удалось скопировать контент");
      });
  } else {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    document.body.appendChild(tempDiv);

    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    try {
      document.execCommand("copy");
      alert("Визуальный контент скопирован (fallback)!");
    } catch (e) {
      alert("Ошибка при копировании визуального контента");
    }

    sel.removeAllRanges();
    document.body.removeChild(tempDiv);
  }
});

const compareBtn = document.getElementById('compareBtn');
const diffResult = document.getElementById('diffResult');
const diffOutput = document.getElementById('diffOutput');

compareBtn.addEventListener('click', () => {
  // show loader in diff result for ~1s
  diffResult.classList.remove('hidden');
  diffResult.classList.add('loading');
  diffOutput.innerHTML='';
  const start=Date.now();
  // allow paint of loader before heavy work
  setTimeout(()=>{
    const originalText = origFrame.contentDocument.body.innerText;
    const cleanedText = cleanFrame.contentDocument.body.innerText;

    const diff = Diff.diffLines(originalText, cleanedText);

    let diffHtml = "";
    let origLine = 1;
    let cleanLine = 1;

    diff.forEach(part => {
      const lines = part.value.split("\n");
      lines.forEach((line, idx) => {
        if (!line.trim()) {
          if (!part.added) origLine++;
          if (!part.removed) cleanLine++;
          return;
        }

        if (part.added) {
          diffHtml += `<div style="color:green">[очищенный ${cleanLine}] + ${line}</div>`;
          cleanLine++;
        } else if (part.removed) {
          diffHtml += `<div style="color:red">[оригинал ${origLine}] - ${line}</div>`;
          origLine++;
        } else {
          origLine++;
          cleanLine++;
        }
      });
    });

    const elapsed=Date.now()-start;
    const left=Math.max(0, 1000 - elapsed);
    setTimeout(()=>{
      diffOutput.innerHTML = diffHtml || "<i>Отличий не найдено</i>";
      diffResult.classList.remove('loading');
    }, left);
  }, 0);
});


