const pasteDiv = document.getElementById('pasteDiv');
const inputEl = document.getElementById('inputHtml');
const cleanBtn = document.getElementById('cleanBtn');
const prettyBtn = document.getElementById('prettyBtn');
const resetBtn = document.getElementById('resetBtn');
const origFrame = document.getElementById('origFrame');
const cleanFrame = document.getElementById('cleanFrame');
const cleanHtmlEl = document.getElementById('cleanHtml');
const logEl = document.getElementById('log');
const wordMode = document.getElementById('wordMode');
const htmlMode = document.getElementById('htmlMode');

let currentMode = 'word';
document.querySelectorAll('input[name="mode"]').forEach(r => {
  r.addEventListener('change', e => {
    currentMode = e.target.value;
    if (currentMode === 'word') { wordMode.classList.remove('hidden'); htmlMode.classList.add('hidden'); }
    else { htmlMode.classList.remove('hidden'); wordMode.classList.add('hidden'); }
    cleanHtmlEl.value = ''; origFrame.srcdoc = ''; cleanFrame.srcdoc = ''; logEl.innerHTML = '';
  });
});

const SANITIZER_CONFIG = {
  tags: {
    b: { replaceWith: "strong", attrs: [], allowedStyles: [] },
    strong: { attrs: [], allowedStyles: [] },
    em: { replaceWith: "i", attrs: [], allowedStyles: [] },
    i: { attrs: [], allowedStyles: [] },
    del: { replaceWith: "s", attrs: [], allowedStyles: [] },
    s: { attrs: [], allowedStyles: [] },
    a: { attrs: ["href", "data-mce-href"], allowedStyles: ["color", "text-decoration"] },
    u: { attrs: [], allowedStyles: ["text-decoration"] },
    center: { replaceWith: "div", attrs: [], allowedStyles: [] },
    div: { attrs: ["style"], allowedStyles: ["text-align", "background-color"] },
    span: { attrs: ["style", "data-mce-style"], allowedStyles: ["color", "font-family"] },
    p: { attrs: ["style"], allowedStyles: ["text-align"] },
    br: { attrs: [], allowedStyles: [] },
    ul: { attrs: [], allowedStyles: [] },
    ol: { attrs: [], allowedStyles: [] },
    li: { attrs: [], allowedStyles: [] },
    table: { attrs: [], allowedStyles: ["border"] },
    tr: { attrs: [], allowedStyles: [] },
    td: { attrs: [], allowedStyles: ["text-align"] },
    th: { attrs: [], allowedStyles: ["text-align"] }
  },
  globalAttrs: ["style", "data-mce-style"],
  globalAllowedStyles: [
    "font-style",
    "text-decoration-line",
    "color",
    "background-color",
    "font-family"
  ],
  allowedTextAlign: ["left", "right", "center", "justify"]
};


function appendLog(text) { const d = document.createElement('div'); d.textContent = text; logEl.prepend(d); }
function setOrigRender(src) { origFrame.srcdoc = src; }
function setCleanRender(src) { cleanFrame.srcdoc = src; }

function sanitizeHtml(source) {
  logEl.innerHTML = '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, 'text/html');

  // 1. Убираем заведомо опасные теги
  ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'].forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => {
      el.remove();
      appendLog(`Removed <${tag}>`);
    });
  });

  // 2. Убираем комментарии
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
  let node;
  while ((node = walker.nextNode())) {
    node.remove();
    appendLog('Removed comment');
  }

  // 3. Проходим по всем элементам
  doc.body.querySelectorAll('*').forEach(el => {
    let tag = el.tagName.toLowerCase();
    let config = SANITIZER_CONFIG.tags[tag];

    // h1–h6 → strong
    if (/^h[1-6]$/.test(tag)) {
      const s = doc.createElement('strong');
      s.innerHTML = el.innerHTML;
      el.replaceWith(s);
      appendLog(`Converted <${tag}> to <strong>`);
      return;
    }

    // Неизвестный тег → раскрываем содержимое
    if (!config) {
      el.replaceWith(...el.childNodes);
      appendLog(`Removed tag <${tag}> but kept content`);
      return;
    }

    // Замена по правилу replaceWith
    if (config.replaceWith) {
      const newEl = doc.createElement(config.replaceWith);
      newEl.innerHTML = el.innerHTML;
      el.replaceWith(newEl);
      appendLog(`Converted <${tag}> to <${config.replaceWith}>`);
      el = newEl;
      tag = el.tagName.toLowerCase();
      config = SANITIZER_CONFIG.tags[tag];
    }

    // Атрибуты
    Array.from(el.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      if (
        !config.attrs.includes(name) &&
        !SANITIZER_CONFIG.globalAttrs.includes(name)
      ) {
        el.removeAttribute(attr.name);
        appendLog(`Removed attribute ${attr.name} on <${tag}>`);
      }
    });

    // Стили
    const style = el.style;
    const kept = [];
    for (let i = 0; i < style.length; i++) {
      const prop = style[i].toLowerCase();
      const value = style.getPropertyValue(prop).trim().toLowerCase();
      const allowed =
        config.allowedStyles.includes(prop) ||
        SANITIZER_CONFIG.globalAllowedStyles.includes(prop);

      if (allowed) {
        if (prop === "text-align" && !SANITIZER_CONFIG.allowedTextAlign.includes(value)) continue;
        if (prop !== "font-weight") kept.push(`${prop}: ${value}`);
      }
    }
  });

  const wrapper = document.createElement('div');
  wrapper.append(...doc.body.childNodes);
  return wrapper.innerHTML;
}


function prettyPrint(html) { try { const p = new DOMParser(); const d = p.parseFromString(html, 'text/html'); return d.documentElement.outerHTML; } catch (e) { return html; } }

function withLoading(fn) {
  cleanBtn.classList.add('is-loading');
  const targets = [origFrame, cleanFrame, cleanHtmlEl];
  targets.forEach(t => t.classList.add('loading'));
  // Clear visible content while loading mask shows
  origFrame.srcdoc = '';
  cleanFrame.srcdoc = '';
  // Keep textarea text, we only mask it
  setTimeout(() => {
    try { fn(); } finally {
      cleanBtn.classList.remove('is-loading');
      targets.forEach(t => t.classList.remove('loading'));
    }
  }, 300); // slight delay to ensure loader is visible before heavy work
}

cleanBtn.addEventListener('click', () => {
  withLoading(() => {
    const src = currentMode === 'word' ? pasteDiv.innerHTML : inputEl.value;
    setOrigRender(src);
    const cleaned = sanitizeHtml(src);
    cleanHtmlEl.value = cleaned;
    setCleanRender(cleaned);
    compareBtn.click();
  });
});

prettyBtn.addEventListener('click', () => {
  const src = currentMode === 'word' ? pasteDiv.innerHTML : inputEl.value;
  const pretty = prettyPrint(src);
  if (currentMode === 'word') { pasteDiv.innerHTML = pretty; setOrigRender(pretty); }
  else { inputEl.value = pretty; setOrigRender(pretty); }
});

resetBtn.addEventListener('click', () => { pasteDiv.innerHTML = ''; inputEl.value = ''; cleanHtmlEl.value = ''; origFrame.srcdoc = ''; cleanFrame.srcdoc = ''; logEl.innerHTML = ''; });

const copyHtmlBtn = document.getElementById('copyHtmlBtn');
const copyVisualBtn = document.getElementById('copyVisualBtn');

copyHtmlBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(cleanHtmlEl.value).then(() => alert('Очищенный HTML скопирован'));
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
  diffOutput.innerHTML = '';
  const start = Date.now();
  // allow paint of loader before heavy work
  setTimeout(() => {
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

    const elapsed = Date.now() - start;
    const left = Math.max(0, 1000 - elapsed);
    setTimeout(() => {
      diffOutput.innerHTML = diffHtml || "<i>Отличий не найдено</i>";
      diffResult.classList.remove('loading');
    }, left);
  }, 0);
});


