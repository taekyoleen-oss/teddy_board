// 위젯: ＋ 위젯 창에서 골라 넣는다. 배치는 기기별(localStorage.board), 내용은 서버(dash.widgets)에 저장한다.
// index.html 의 본 스크립트보다 먼저 읽히므로 $·esc·api 같은 이름은 함수 안에서만 쓴다.
const W = {};
let wdata = {}, wDrawn = false, wTicks = 0;
const wid = () => Math.random().toString(36).slice(2, 10);
const wbody = key => document.querySelector(`#w-${key} .wbody`);
const wsave = (key, value) => { wdata[key] = value; return api('/api/dash', {widgets: {[key]: value}}); };
const wtools = (key, html) => { document.querySelector(`#w-${key} .tools`).innerHTML = html; };

function makeWidget(id) {
  const w = W[id.slice(2)];
  if (!w) return null;
  const card = document.createElement('section');
  card.className = 'card widget' + (w.slim ? '' : ' grow') + (w.vtitle ? ' vtitle' : '');
  card.id = id;
  card.setAttribute('aria-label', w.name);
  card.innerHTML = `<div class="head"><h2>${w.name}</h2><div class="tools"></div></div><div class="wbody"></div>`;
  addGrip(card);
  return card;
}
function drawWidget(id) { if (wDrawn) W[id.slice(2)].draw($(id).querySelector('.wbody')); }
function addWidget(key) {
  const id = 'w-' + key, at = document.querySelector('.card.picked'), card = $(id) || makeWidget(id);  // 다른 탭에 있으면 이 탭으로 데려온다
  forgetCard(id);
  const col = at?.parentElement || [...cols.children].sort((a, b) => a.children.length - b.children.length)[0];
  at ? at.after(card) : col.append(card);  // 선택한 카드가 있으면 그 바로 다음, 없으면 카드가 가장 적은 열 끝
  evenCol(col);
  pickCard(card);
  drawWidget(id);
  saveBoard();
  dispatchEvent(new Event('resize'));
}
function removeWidget(id) {
  const card = $(id), col = card.parentElement;
  W[id.slice(2)].leave?.();
  card.remove();
  evenCol(col);
  saveBoard();
  dispatchEvent(new Event('resize'));
}
function drawPick() {
  $('widgetList').innerHTML = Object.entries(W).map(([key, w]) => {
    const card = $('w-' + key), on = cols.contains(card);
    return `<div class="line"><span class="wico">${w.icon}</span><span style="flex:1;min-width:0"><b>${w.name}</b><span class="sub" style="white-space:normal">${w.about}</span></span><button class="pill${on ? ' ghost' : ''}" type="button" data-w="${key}">${on ? '빼기' : card ? '이 탭으로' : '추가'}</button></div>`;
  }).join('');
}
function initWidgets() {
  $('widgetAdd').onclick = () => { drawPick(); $('widgetPick').showModal(); };
  $('widgetList').onclick = e => {
    const key = e.target.dataset.w;
    if (!key) return;
    cols.contains($('w-' + key)) ? removeWidget('w-' + key) : addWidget(key);
    drawPick();
  };
  $('propsDrop').onclick = () => { $('props').hidePopover(); removeWidget(propsCard.id); };
  setInterval(() => {
    wTicks++;
    Object.entries(W).forEach(([key, w]) => { if (w.tick && $('w-' + key)) w.tick(wTicks); });
  }, 1000);
  addEventListener('blur', () => { if (outfitPick && $('w-outfit')) { outfitPick = null; W.outfit.draw(); } });
  initClipCapture();
  initScrollArrows();
}
// 카드 안 스크롤막대 대신, 마우스가 스크롤 가능한 영역의 가장자리에 가면 그쪽 화살표를 띄운다
function initScrollArrows() {
  const WAYS = {left: ['◀', -1], right: ['▶', 1], up: ['▲', -1], down: ['▼', 1]}, across = w => w === 'left' || w === 'right';
  const btn = document.createElement('button');
  Object.assign(btn, {id: 'scrollArrow', type: 'button', tabIndex: -1, hidden: true});
  btn.setAttribute('aria-hidden', 'true');  // 키보드·휠 스크롤은 그대로 동작한다
  document.body.append(btn);
  let box = null, way = '';
  const hide = () => { btn.hidden = true; box = null; };
  const room = (el, w) => ({left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1, up: el.scrollTop > 1, down: el.scrollTop + el.clientHeight < el.scrollHeight - 1})[w];
  const scrolls = (el, w) => room(el, w) && /auto|scroll/.test(getComputedStyle(el)[across(w) ? 'overflowX' : 'overflowY']);
  const edge = (r, e, w) => {  // 가장자리 40px, 작은 영역은 3분의 1
    const zone = Math.min(40, (across(w) ? r.width : r.height) / 3);
    return {left: e.clientX - r.left, right: r.right - e.clientX, up: e.clientY - r.top, down: r.bottom - e.clientY}[w] < zone;
  };
  cols.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons) return hide();
    for (let el = e.target; el && el !== cols; el = el.parentElement) {
      if (/^(TEXTAREA|INPUT|SELECT)$/.test(el.tagName)) continue;
      const r = el.getBoundingClientRect(), hit = Object.keys(WAYS).find(w => scrolls(el, w) && edge(r, e, w));
      if (!hit) continue;
      box = el; way = hit; btn.textContent = WAYS[hit][0]; btn.hidden = false;
      btn.style.left = (across(hit) ? (hit === 'left' ? r.left + 2 : r.right - 26) : r.left + r.width / 2 - 12) + 'px';
      btn.style.top = (across(hit) ? r.top + r.height / 2 - 12 : hit === 'up' ? r.top + 2 : r.bottom - 26) + 'px';
      return;
    }
    hide();
  });
  cols.addEventListener('pointerleave', e => { if (e.relatedTarget !== btn) hide(); });
  btn.addEventListener('pointerleave', e => { if (!box?.contains(e.relatedTarget)) hide(); });
  btn.onmousedown = e => e.preventDefault();  // 눌러도 포커스를 가져가지 않는다
  btn.onclick = () => {
    const el = box, w = way, size = across(w) ? el.clientWidth : el.clientHeight;
    el.scrollBy({[across(w) ? 'left' : 'top']: WAYS[w][1] * size * .8, behavior: 'smooth'});
    setTimeout(() => { if (box === el && way === w && !room(el, w)) hide(); }, 450);
  };
}
// loadDash 뒤마다 부른다. 다른 기기가 바꾼 내용은 입력 중이 아닌 카드만 다시 그린다.
function syncWidgets() {
  const next = state.widgets || {}, first = !wDrawn, old = JSON.stringify(wdata), now = JSON.stringify(next);
  wdata = next;
  wDrawn = true;
  takeTabPlan(next.tabPlan);
  if (!first && old === now) return;
  Object.keys(W).forEach(key => {
    const card = $('w-' + key);
    if (card && (first || !card.contains(document.activeElement))) W[key].draw(card.querySelector('.wbody'));
  });
}
function wDialog(id, title) {
  let box = $(id);
  if (!box) {
    box = document.createElement('dialog');
    box.className = 'pop wpop';
    box.id = id;
    box.setAttribute('aria-label', title);
    box.innerHTML = `<div class="head" style="margin:0"><h2></h2><div class="tools"><button class="icon" type="button" data-close aria-label="닫기">×</button></div></div><div class="wpopBody"></div>`;
    box.querySelector('[data-close]').onclick = () => box.close();
    document.body.append(box);
  }
  box.querySelector('h2').textContent = title;
  return box;
}
const wpopBody = box => box.querySelector('.wpopBody');

// ── 날씨 (외출복과 공유) ──
const WX_HOME = {name: '서울', lat: 37.5665, lon: 126.978};
const wxCache = {};
const wmo = c => c === 0 ? ['☀️', '맑음'] : c === 1 ? ['🌤️', '대체로 맑음'] : c === 2 ? ['⛅', '구름 조금'] : c === 3 ? ['☁️', '흐림'] : c <= 48 ? ['🌫️', '안개'] : c <= 57 ? ['🌦️', '이슬비'] : c <= 67 ? ['🌧️', '비'] : c <= 77 ? ['🌨️', '눈'] : c <= 82 ? ['🌦️', '소나기'] : c <= 86 ? ['🌨️', '소낙눈'] : ['⛈️', '뇌우'];
async function wxGet(p, force) {
  const key = p.lat + ',' + p.lon, hit = wxCache[key];
  if (hit && !force && Date.now() - hit.at < 600000) return hit.data;
  const data = await api(`/api/weather?lat=${p.lat}&lon=${p.lon}`);
  wxCache[key] = {at: Date.now(), data};
  return data;
}
// 지역 찾기 칸. 결과를 누르면 pick({name, lat, lon})
function placeBox(el, pick) {
  el.innerHTML = `<form class="add"><input placeholder="지역 찾기 (예: 부산, Tokyo)" aria-label="지역 찾기"><button class="pill" type="submit">찾기</button></form><div class="wplaces"></div>`;
  const list = el.querySelector('.wplaces');
  el.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const q = el.querySelector('input').value.trim();
    if (!q) return;
    list.textContent = '찾는 중…';
    try {
      const rows = await api('/api/place?q=' + encodeURIComponent(q));
      list.innerHTML = rows.map((r, i) => `<button class="pill ghost" type="button" data-i="${i}">${esc(r.name)} <span class="muted small">${esc(r.area)}</span></button>`).join('') || '찾지 못했습니다';
      list.onclick = ev => { const b = ev.target.closest('[data-i]'); if (b) { const r = rows[b.dataset.i]; pick({name: r.name, lat: r.lat, lon: r.lon}); } };
    } catch (err) { list.textContent = err.message; }
  };
}
const wxFrom = d => Math.max(0, d.hourly.time.indexOf(d.current.time.slice(0, 13) + ':00'));
// 현재 위치는 기기마다 달라서 서버에 저장하지 않고 이 기기에서 30분간 기억한다
let wxHere = null;
const wxFix = fresh => new Promise((ok, no) => {
  if (!window.isSecureContext) return api('/api/here').then(p => ok({coords: {latitude: p.lat, longitude: p.lon}}), no);  // 이 컴퓨터면 서버가 Windows 위치를 준다
  navigator.geolocation.getCurrentPosition(ok, no, {timeout: 20000, maximumAge: fresh ? 0 : 1800000});
});
async function wxPlace(fresh) {
  const c = {...WX_HOME, ...wdata.weather};
  if (!c.auto) {
    if (/[가-힣]/.test(c.name)) return c;
    const name = (await api(`/api/where?lat=${c.lat}&lon=${c.lon}`).catch(() => ({}))).name;  // 예전에 영어로 저장된 지역을 한글로 바꿔 둔다
    if (!name) return c;
    wsave('weather', {...wdata.weather, name});
    return {...c, name};
  }
  try {
    if (fresh || !wxHere || Date.now() - wxHere.at > 1800000) {
      const {latitude: lat, longitude: lon} = (await wxFix(fresh)).coords;
      const name = (await api(`/api/where?lat=${lat}&lon=${lon}`).catch(() => ({}))).name || '현재 위치';
      wxHere = {name, lat, lon, at: Date.now()};
    }
    return {...c, ...wxHere};
  } catch (err) {  // 실패 이유를 그대로 보여 준다
    const why = !window.isSecureContext ? 'https 아님' : {1: '위치 권한 없음', 2: '위치 신호 없음', 3: '위치 시간 초과'}[err.code] || '위치 확인 실패';
    return {...c, name: `${c.name} (${why})`};
  }
}
W.weather = {
  name: '날씨', icon: '🌤️', slim: true, about: '현재·시간별·일자별 날씨. 속성에서 보기와 위치를 고릅니다',
  async draw(el = wbody('weather'), fresh) {
    const view = wdata.weather?.view || 'now';
    try {
      const p = await wxPlace(fresh), d = await wxGet(p, fresh), c = d.current, [ico, word] = wmo(c.weather_code);
      if (view === 'now') {
        el.innerHTML = `<button class="wxline" type="button" title="자세히"><span class="wxtop"><span class="wxico">${ico}</span><b>${Math.round(c.temperature_2m)}°</b><span class="wxword">${esc(p.name)} ${word}</span></span><span class="sub">체감 ${Math.round(c.apparent_temperature)}° · ${Math.round(d.daily.temperature_2m_max[0])}°/${Math.round(d.daily.temperature_2m_min[0])}° · 강수 ${d.daily.precipitation_probability_max[0] ?? 0}%</span></button>`;
      } else {
        const h = d.hourly, from = wxFrom(d), cell = (top, code, temp, low = '') => `<div><span class="sub">${top}</span><span class="wxico" title="${wmo(code)[1]}">${wmo(code)[0]}</span><b>${temp.toFixed(1)}°</b>${low}</div>`;
        const cells = view === 'hour'
          ? h.time.slice(from, from + 24).map((t, i) => cell(+t.slice(11, 13) + '시', h.weather_code[from + i], h.temperature_2m[from + i]))
          : d.daily.time.map((t, i) => cell(i ? new Date(t + 'T00:00').toLocaleDateString('ko', {weekday: 'short'}) : '오늘', d.daily.weather_code[i], d.daily.temperature_2m_max[i], `<span class="sub">${d.daily.temperature_2m_min[i].toFixed(1)}°</span>`));
        el.innerHTML = `<div class="wxhead"><button class="wxname" type="button" title="자세히">${esc(p.name)}</button><span class="sub">${new Date(c.time).toLocaleTimeString('ko', {hour: 'numeric', minute: '2-digit'})} 기준</span><button class="icon" type="button" data-a="again" title="새로고침" aria-label="날씨 새로고침">↻</button></div><div class="wxstrip ${view}">${cells.join('')}</div>`;
        el.querySelector('[data-a=again]').onclick = () => this.draw(el, true);
      }
      el.querySelector('button').onclick = () => this.open();
    } catch (err) { el.innerHTML = `<div class="none">날씨를 가져오지 못했습니다</div>`; }
  },
  keep(patch) { const done = wsave('weather', {...wdata.weather, ...patch}); this.draw(); return done; },
  props(el) {
    const c = {...WX_HOME, ...wdata.weather}, sel = (key, now, rows) => `<select data-c="${key}">${rows.map(([v, name]) => `<option value="${v}"${v === now ? ' selected' : ''}>${name}</option>`).join('')}</select>`;
    el.innerHTML = `<label>보기${sel('view', c.view || 'now', [['now', '현재 날씨'], ['hour', '시간별'], ['day', '일자별']])}</label><label>위치${sel('auto', c.auto ? '1' : '', [['1', '현재 위치'], ['', '지역 지정']])}</label>${c.auto ? '' : `<div class="small muted">지정 지역: <b>${esc(c.name)}</b></div><div class="wxplace"></div>`}`;
    el.onchange = e => {
      const key = e.target.dataset.c;
      if (key) { this.keep({[key]: key === 'auto' ? !!e.target.value : e.target.value}); this.props(el); }
    };
    if (!c.auto) placeBox(el.querySelector('.wxplace'), place => { this.keep({...place, auto: false}); this.props(el); });
  },
  async open() {
    const p = await wxPlace(), box = wDialog('wxPop', p.name + ' 날씨'), d = await wxGet(p);
    const from = wxFrom(d);
    const hours = d.hourly.time.slice(from, from + 12).map((t, i) => `<div><span class="sub">${+t.slice(11, 13)}시</span><span>${wmo(d.hourly.weather_code[from + i])[0]}</span><b>${Math.round(d.hourly.temperature_2m[from + i])}°</b><span class="sub">${d.hourly.precipitation_probability[from + i] ?? 0}%</span></div>`).join('');
    const days = d.daily.time.map((t, i) => `<div class="line"><span style="width:5em">${i ? new Date(t + 'T00:00').toLocaleDateString('ko', {weekday: 'short', day: 'numeric'}) : '오늘'}</span><span>${wmo(d.daily.weather_code[i])[0]} ${wmo(d.daily.weather_code[i])[1]}</span><span class="sub" style="margin-left:auto">강수 ${d.daily.precipitation_probability_max[i] ?? 0}%</span><b>${Math.round(d.daily.temperature_2m_max[i])}° / ${Math.round(d.daily.temperature_2m_min[i])}°</b></div>`).join('');
    wpopBody(box).innerHTML = `<div class="wxhours">${hours}</div><div>${days}</div><div class="wxplace"></div>`;
    placeBox(box.querySelector('.wxplace'), place => { this.keep({...place, auto: false}); box.close(); });
    box.showModal();
  },
  tick(n) { if (n % 1800 === 0) this.draw(); },
};

// ── 계산기 ── eval 없이 직접 해석한다
function calcEval(src) {
  const s = src.replace(/\s/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/²/g, '^2');
  let i = 0;
  const eat = t => s.startsWith(t, i) && (i += t.length, true);
  function expr() { let v = term(); for (;;) { if (eat('+')) v += term(); else if (eat('-')) v -= term(); else return v; } }
  function term() {
    let v = unary();
    for (;;) {
      if (eat('*')) v *= unary();
      else if (eat('/')) v /= unary();
      else if (/^(\d|\.|\(|√|π|e|log|ln)/.test(s.slice(i))) v *= power();  // 2π, 3(4+1) 같은 생략된 곱
      else return v;
    }
  }
  function unary() { return eat('-') ? -unary() : eat('+') ? unary() : power(); }
  function power() { const v = post(); return eat('^') ? v ** unary() : v; }
  function post() { let v = atom(); while (eat('%')) v /= 100; return v; }
  function atom() {
    const num = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (num) { i += num[0].length; return +num[0]; }
    if (eat('(')) { const v = expr(); eat(')'); return v; }
    if (eat('√')) return Math.sqrt(post());
    if (eat('log')) return Math.log10(post());
    if (eat('ln')) return Math.log(post());
    if (eat('π')) return Math.PI;
    if (eat('e')) return Math.E;
    throw new Error('식 오류');
  }
  const v = expr();
  if (i < s.length) throw new Error('식 오류');
  return +v.toPrecision(12);
}
W.calc = {
  name: '계산기', icon: '🧮', about: '사칙연산, 거듭제곱, 제곱근, 로그, 괄호',
  draw(el = wbody('calc')) {
    const keys = ['√', '(', ')', '⌫', 'C', '^', '7', '8', '9', '÷', 'π', '4', '5', '6', '×', 'ln', '1', '2', '3', '−', 'log', '0', '.', '=', '+'];
    el.innerHTML = `<input class="field" aria-label="계산식" inputmode="decimal" autocomplete="off"><div class="calcOut" aria-live="polite"></div><div class="calcKeys">${keys.map(k => `<button type="button" data-k="${k}"${k === '=' ? ' class="eq"' : ''}>${k}</button>`).join('')}</div>`;
    const box = el.querySelector('input'), out = el.querySelector('.calcOut');
    const show = () => {
      if (!box.value.trim()) { out.textContent = ''; return; }
      try { const v = calcEval(box.value); out.textContent = Number.isFinite(v) ? '= ' + v : '계산할 수 없습니다'; } catch { out.textContent = ''; }
    };
    const done = () => { try { const v = calcEval(box.value); if (Number.isFinite(v)) { box.value = v; show(); } } catch { out.textContent = '식을 확인하세요'; } };
    box.oninput = show;
    box.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); done(); } };
    el.querySelector('.calcKeys').onclick = e => {
      const k = e.target.dataset.k;
      if (!k) return;
      if (k === '=') return done();
      if (k === 'C') box.value = '';
      else if (k === '⌫') box.value = box.value.slice(0, -1);
      else box.value += ['√', 'ln', 'log'].includes(k) ? k + '(' : k;
      show();
    };
  },
};

// ── 즐겨찾기 ──
function linkUrl(text) {
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : 'https://' + text);
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch { return null; }
}
const LINK_COLORS = {빨강: '#ef4444', 주황: '#f97316', 노랑: '#eab308', 초록: '#22c55e', 청록: '#14b8a6', 파랑: '#3b82f6', 남색: '#6366f1', 보라: '#a855f7', 분홍: '#ec4899', 회색: '#64748b'};
W.links = {
  name: '즐겨찾기', icon: '⭐', vtitle: true, about: '자주 가는 사이트를 아이콘으로 모아 둡니다',
  draw(el = wbody('links')) {
    const list = wdata.links || [];
    el.innerHTML = `<div class="wchips">${list.map(l => {
      const url = linkUrl(l.url);
      const color = Object.values(LINK_COLORS).includes(l.color) ? l.color : '';
      return url ? `<span class="wlink"${color ? ` style="--lc:${color}"` : ''}><a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer" title="${esc(url.href)}"><span class="lico">${esc(l.label[0] || '?')}<img alt="" src="https://icons.duckduckgo.com/ip3/${esc(url.hostname)}.ico" onerror="this.remove()"></span>${esc(l.label)}</a><button class="lcBtn" type="button" data-color="${l.id}" title="색 고르기" aria-label="${esc(l.label)} 색 고르기"></button><button class="icon" type="button" data-del="${l.id}" aria-label="${esc(l.label)} 지우기">×</button></span>` : '';
    }).join('') || '<div class="none">아래에서 사이트를 추가하세요</div>'}</div><form class="add"><input placeholder="이름" aria-label="이름" style="flex:1"><input placeholder="주소" aria-label="주소" style="flex:2"><button class="pill" type="submit">추가</button></form><div class="werr" role="alert"></div><div class="lcPal" popover>${Object.entries(LINK_COLORS).map(([n, c]) => `<button type="button" style="background:${c}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}<button type="button" data-c="" title="색 없애기" aria-label="색 없애기">×</button></div>`;
    const [name, addr] = el.querySelectorAll('input'), pal = el.querySelector('.lcPal');
    let picking = '';
    pal.onclick = e => {
      const c = e.target.dataset.c;
      if (c === undefined) return;
      wsave('links', list.map(l => l.id === picking ? {...l, color: c} : l));
      pal.hidePopover();
      this.draw(el);
    };
    el.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const url = linkUrl(addr.value.trim());
      if (!url) { el.querySelector('.werr').textContent = 'http 또는 https 주소만 넣을 수 있습니다'; return; }
      wsave('links', [...list, {id: wid(), label: name.value.trim().slice(0, 40) || url.hostname, url: url.href}].slice(0, 100));
      this.draw(el);
    };
    el.querySelector('.wchips').onclick = e => {
      const id = e.target.dataset.del;
      if (id) { wsave('links', list.filter(l => l.id !== id)); this.draw(el); }
      if (e.target.dataset.color) {
        picking = e.target.dataset.color;
        const box = e.target.getBoundingClientRect();
        pal.showPopover();
        pal.style.left = Math.min(box.left, innerWidth - pal.offsetWidth - 8) + 'px';
        pal.style.top = Math.min(box.bottom + 4, innerHeight - pal.offsetHeight - 8) + 'px';
      }
    };
  },
};

// ── 단위 변환 ── 기준 단위에 대한 배율
const UNITS = {
  길이: {base: ['m', 'km'], u: {mm: .001, cm: .01, m: 1, km: 1000, in: .0254, ft: .3048, yd: .9144, mile: 1609.344, 자: .30303, 리: 392.7}},
  무게: {base: ['kg', 'lb'], u: {mg: 1e-6, g: .001, kg: 1, t: 1000, lb: .45359237, oz: .0283495231, 돈: .00375, 근: .6, 관: 3.75}},
  온도: {base: ['°C', '°F'], u: {'°C': 0, '°F': 0, K: 0}},
  넓이: {base: ['m²', '평'], u: {'cm²': 1e-4, 'm²': 1, 'km²': 1e6, ha: 1e4, 'ft²': .092903, 평: 3.305785, acre: 4046.8564}},
  부피: {base: ['L', 'mL'], u: {mL: .001, L: 1, 'm³': 1000, cup: .2, 'fl oz': .0295735, gal: 3.785411784, 되: 1.8039, 말: 18.039}},
  속도: {base: ['km/h', 'm/s'], u: {'m/s': 1, 'km/h': .2777778, mph: .44704, knot: .5144444}},
  시간: {base: ['min', 's'], u: {ms: .001, s: 1, min: 60, h: 3600, day: 86400, week: 604800}},
  데이터: {base: ['MB', 'GB'], u: {B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4}},
};
function unitConvert(kind, v, from, to) {
  if (kind !== '온도') return v * UNITS[kind].u[from] / UNITS[kind].u[to];
  const c = from === '°C' ? v : from === '°F' ? (v - 32) * 5 / 9 : v - 273.15;
  return to === '°C' ? c : to === '°F' ? c * 9 / 5 + 32 : c + 273.15;
}
const unitText = v => !Number.isFinite(v) ? '' : v !== 0 && (Math.abs(v) < 1e-4 || Math.abs(v) >= 1e12) ? v.toExponential(4) : String(+v.toFixed(6));
W.unit = {
  name: '단위 변환', icon: '📐', about: '길이·무게·온도·넓이(평)·부피·속도·시간·데이터',
  draw(el = wbody('unit')) {
    const saved = wdata.unit || {}, kind = UNITS[saved.kind] ? saved.kind : '길이', u = UNITS[kind];
    const [from, to] = u.u[saved.from] !== undefined && u.u[saved.to] !== undefined ? [saved.from, saved.to] : u.base;
    const opts = pick => Object.keys(u.u).map(k => `<option${k === pick ? ' selected' : ''}>${k}</option>`).join('');
    el.innerHTML = `<select aria-label="분류">${Object.keys(UNITS).map(k => `<option${k === kind ? ' selected' : ''}>${k}</option>`).join('')}</select><div class="unitRow"><input class="field" type="number" step="any" aria-label="값" value="${esc(saved.value ?? 1)}"><select aria-label="변환 전 단위">${opts(from)}</select></div><div class="unitRow"><output class="calcOut" style="flex:1"></output><select aria-label="변환 후 단위">${opts(to)}</select></div><button class="pill ghost" type="button">⇄ 맞바꾸기</button>`;
    const [cat, a, b] = el.querySelectorAll('select'), val = el.querySelector('input'), out = el.querySelector('output');
    const show = () => { out.textContent = val.value === '' ? '' : unitText(unitConvert(kind, +val.value, a.value, b.value)); };
    const keep = () => { show(); clearTimeout(this.timer); this.timer = setTimeout(() => wsave('unit', {kind, from: a.value, to: b.value, value: val.value}), 500); };
    cat.onchange = () => { wdata.unit = {kind: cat.value}; wsave('unit', wdata.unit); this.draw(el); };
    val.oninput = a.onchange = b.onchange = keep;
    el.querySelector('button').onclick = () => { [a.value, b.value] = [b.value, a.value]; keep(); };
    show();
  },
};

// ── 세계 시계 ──
const ZONES = [['서울', 'Asia/Seoul'], ['도쿄', 'Asia/Tokyo'], ['상하이', 'Asia/Shanghai'], ['싱가포르', 'Asia/Singapore'], ['뉴델리', 'Asia/Kolkata'], ['두바이', 'Asia/Dubai'], ['런던', 'Europe/London'], ['파리', 'Europe/Paris'], ['베를린', 'Europe/Berlin'], ['모스크바', 'Europe/Moscow'], ['뉴욕', 'America/New_York'], ['시카고', 'America/Chicago'], ['덴버', 'America/Denver'], ['LA', 'America/Los_Angeles'], ['상파울루', 'America/Sao_Paulo'], ['시드니', 'Australia/Sydney'], ['호놀룰루', 'Pacific/Honolulu']];
const zoneGap = tz => {
  const now = new Date(), at = z => new Date(now.toLocaleString('en-US', {timeZone: z}));
  const h = (at(tz) - at('Asia/Seoul')) / 3600000;
  return h === 0 ? '서울과 같음' : `서울 ${h > 0 ? '+' : ''}${h}시간`;
};
W.clock = {
  name: '세계 시계', icon: '🌍', about: '여러 도시의 현재 시각과 서울과의 시차',
  zones: () => wdata.zones || [['서울', 'Asia/Seoul'], ['뉴욕', 'America/New_York'], ['런던', 'Europe/London']],
  draw(el = wbody('clock')) {
    const zones = this.zones(), opt = wdata.clockOpt || {};
    el.innerHTML = zones.map(([name, tz]) => `<div class="line"><span style="flex:1;min-width:0">${esc(name)}<span class="sub">${zoneGap(tz)}</span></span><span style="text-align:right"><b class="wtime" data-tz="${esc(tz)}"></b><span class="sub wdate" data-tz="${esc(tz)}"></span></span><button class="icon" type="button" data-del="${esc(tz)}" aria-label="${esc(name)} 빼기">×</button></div>`).join('')
      + `<div class="add" style="margin-top:4px"><select aria-label="도시 추가"><option value="">＋ 도시 추가</option>${ZONES.filter(z => !zones.some(x => x[1] === z[1])).map(z => `<option value="${z[1]}">${z[0]}</option>`).join('')}</select></div><div class="small muted"><label><input type="checkbox" data-opt="h12"${opt.h12 ? ' checked' : ''}> 12시간</label> <label><input type="checkbox" data-opt="sec"${opt.sec === false ? '' : ' checked'}> 초</label></div>`;
    el.querySelector('select').onchange = e => {
      const z = ZONES.find(x => x[1] === e.target.value);
      if (z) { wsave('zones', [...zones, z]); this.draw(el); }
    };
    el.onclick = e => {
      const tz = e.target.dataset.del;
      if (tz) { wsave('zones', zones.filter(z => z[1] !== tz)); this.draw(el); }
    };
    el.onchange = e => {
      const key = e.target.dataset.opt;
      if (key) { wsave('clockOpt', {sec: true, ...opt, [key]: e.target.checked}); this.draw(el); }
    };
    this.tick();
  },
  tick() {
    const opt = wdata.clockOpt || {}, now = new Date();
    document.querySelectorAll('#w-clock .wtime').forEach(t => {
      t.textContent = now.toLocaleTimeString('ko', {timeZone: t.dataset.tz, hour12: !!opt.h12, hour: '2-digit', minute: '2-digit', ...(opt.sec === false ? {} : {second: '2-digit'})});
    });
    document.querySelectorAll('#w-clock .wdate').forEach(t => { t.textContent = now.toLocaleDateString('ko', {timeZone: t.dataset.tz, month: 'numeric', day: 'numeric', weekday: 'short'}); });
  },
};

// ── 비번 메모 ── 본문은 서버에서 암호화해 저장한다. 비밀번호는 이 탭의 변수에만 있고 잠그면 지운다
const sec = {pw: null, text: '', used: 0, dirty: false, timer: 0};
const SEC_IDLE = 300;
async function secCall(body) { return api('/api/secret', body); }
function secBeacon() {
  if (sec.pw && sec.dirty) navigator.sendBeacon('/api/secret', new Blob([JSON.stringify({pw: sec.pw, text: sec.text})], {type: 'application/json'}));
}
W.secret = {
  name: '비번 메모', icon: '🔒', about: '비밀번호를 정해 잠그는 메모. 5분 동안 쓰지 않으면 다시 잠깁니다',
  draw(el = wbody('secret')) {
    wtools('secret', sec.pw ? '<button class="icon" type="button" data-a="change" title="비밀번호 바꾸기" aria-label="비밀번호 바꾸기">🔑</button><button class="icon" type="button" data-a="lock" title="잠그기" aria-label="잠그기">🔒</button>' : '');
    document.querySelector('#w-secret .tools').onclick = e => {
      const a = e.target.dataset.a;
      if (a === 'lock') this.lock();
      if (a === 'change') this.change(el);
    };
    if (sec.pw) return this.open(el);
    const has = state.secret;
    el.innerHTML = `<form class="wform"><span class="small muted">${has ? '비밀번호를 넣으면 열립니다' : '이 메모에 쓸 비밀번호를 정하세요. 잊으면 복구할 수 없습니다'}</span><input class="field" type="password" autocomplete="off" aria-label="비밀번호" placeholder="비밀번호 (4자 이상)">${has ? '' : '<input class="field" type="password" autocomplete="off" aria-label="비밀번호 확인" placeholder="비밀번호 확인">'}<button class="pill" type="submit">${has ? '열기' : '만들기'}</button>${has ? '<button class="pill ghost" type="button" data-forget>비밀번호를 잊었습니다</button>' : ''}<div class="werr" role="alert"></div></form>`;
    const [a, b] = el.querySelectorAll('input'), err = el.querySelector('.werr');
    el.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      if (b && a.value !== b.value) { err.textContent = '두 비밀번호가 다릅니다'; return; }
      try {
        const res = await secCall({pw: a.value});
        Object.assign(sec, {pw: a.value, text: res.text, used: wTicks, dirty: false});
        state.secret = true;
        this.draw(el);
      } catch (ex) { err.textContent = ex.message; }
    };
    const forget = el.querySelector('[data-forget]');
    if (forget) forget.onclick = async () => {
      if (!confirm('비밀번호를 찾을 방법은 없습니다. 메모 내용을 모두 지우고 처음부터 시작할까요?')) return;
      await secCall({reset: true});
      state.secret = false;
      this.draw(el);
    };
  },
  open(el) {
    el.innerHTML = `<textarea class="secText" aria-label="비밀 메모" spellcheck="false"></textarea><div class="small muted werrline"></div>`;
    const box = el.querySelector('textarea'), note = el.querySelector('.werrline');
    box.value = sec.text;
    box.oninput = () => {
      sec.text = box.value; sec.used = wTicks; sec.dirty = true;
      note.textContent = '';
      clearTimeout(sec.timer);
      sec.timer = setTimeout(() => this.store(note), 800);
    };
    box.onkeydown = box.onpointerdown = () => { sec.used = wTicks; };
    box.focus();
  },
  async store(note) {
    if (!sec.pw || !sec.dirty) return;
    const text = sec.text;
    try {
      await secCall({pw: sec.pw, text});
      if (sec.text === text) sec.dirty = false;
      if (note) note.textContent = '저장했습니다';
    } catch (ex) { if (note) note.textContent = '저장하지 못했습니다: ' + ex.message; }
  },
  async lock() {
    clearTimeout(sec.timer);
    await this.store();
    if (sec.dirty) { sec.used = wTicks; return; }  // 저장 실패면 글을 잃지 않게 잠그지 않는다
    Object.assign(sec, {pw: null, text: ''});
    if ($('w-secret')) this.draw();
  },
  async change(el) {
    const next = prompt('새 비밀번호 (4자 이상)');
    if (next === null) return;
    const note = el.querySelector('.werrline');
    try {
      await secCall({pw: sec.pw, text: sec.text, newPw: next});
      Object.assign(sec, {pw: next, dirty: false});
      note.textContent = '비밀번호를 바꿨습니다';
    } catch (ex) { note.textContent = '바꾸지 못했습니다: ' + ex.message; }
  },
  leave() { secBeacon(); clearTimeout(sec.timer); Object.assign(sec, {pw: null, text: '', dirty: false}); },
  tick(n) { if (sec.pw && n - sec.used >= SEC_IDLE) this.lock(); },
};
addEventListener('pagehide', secBeacon);

// ── 클립보드 기록 ──
const CLIP_MAX = 50, CLIP_LEN = 5000;
let clipDenied = 0;
function addClip(text) {
  if (!text.trim() || text.length > CLIP_LEN) return;
  const list = wdata.clips || [], same = list.find(c => c.text === text);
  if (same && list[0] === same) return;
  const rest = list.filter(c => c !== same), plain = rest.filter(c => !c.fav).slice(0, CLIP_MAX - 1);
  wsave('clips', [same || {id: wid(), text, when: Date.now(), fav: false}, ...rest.filter(c => c.fav || plain.includes(c))]);
  W.clips.draw();
}
function initClipCapture() {
  document.addEventListener('copy', e => {
    if (!$('w-clips') || e.target.closest?.('#w-secret, #lock, #w-clips') || e.target.type === 'password') return;
    const box = document.activeElement, text = box?.selectionStart !== undefined && box.value !== undefined ? box.value.slice(box.selectionStart, box.selectionEnd) : String(getSelection());
    addClip(text);
  });
  addEventListener('focus', () => setTimeout(async () => {
    const auto = wdata.clipAuto !== false;
    if (!auto || !$('w-clips') || sec.pw || clipDenied >= 3 || !window.isSecureContext || !navigator.clipboard?.readText) return;
    try { addClip(await navigator.clipboard.readText()); clipDenied = 0; } catch { clipDenied++; }
  }, 200));
}
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const box = document.createElement('textarea');
  box.value = text;
  document.body.append(box);
  box.select();
  document.execCommand('copy');
  box.remove();
}
W.clips = {
  name: '클립보드 기록', icon: '📋', about: '복사한 글을 모아 두고 다시 복사합니다 (최근 50개, ★는 고정)',
  draw(el = wbody('clips')) {
    if (!el) return;
    const list = [...(wdata.clips || [])].sort((a, b) => b.fav - a.fav), http = !window.isSecureContext;
    wtools('clips', '<button class="icon" type="button" data-clear title="고정 안 한 기록 지우기" aria-label="기록 지우기">🗑</button>');
    document.querySelector('#w-clips .tools').onclick = e => {
      if ('clear' in e.target.dataset && confirm('고정하지 않은 기록을 지울까요?')) { wsave('clips', (wdata.clips || []).filter(c => c.fav)); this.draw(); }
    };
    el.innerHTML = `<form class="add"><input placeholder="글을 붙여넣고 Enter" aria-label="기록에 추가"></form><div class="clipList">${list.map(c => `<div class="line clip"><button class="icon" type="button" data-fav="${c.id}" aria-label="고정" aria-pressed="${!!c.fav}">${c.fav ? '★' : '☆'}</button><button class="clipText" type="button" data-copy="${c.id}" title="눌러서 다시 복사">${esc(c.text.slice(0, 200))}</button><button class="icon" type="button" data-del="${c.id}" aria-label="지우기">×</button></div>`).join('') || '<div class="none">기록이 없습니다</div>'}</div><div class="small muted clipNote">${http ? '이 주소에서는 앱 밖에서 복사한 글을 자동으로 읽지 못합니다. 붙여넣어 주세요.' : `<label><input type="checkbox"${wdata.clipAuto === false ? '' : ' checked'}> 앱으로 돌아올 때 자동 기록</label>`} 비밀번호는 평문으로 저장되니 복사해 두지 마세요.</div>`;
    const auto = el.querySelector('input[type=checkbox]');
    if (auto) auto.onchange = () => wsave('clipAuto', auto.checked);
    el.querySelector('form').onsubmit = e => { e.preventDefault(); addClip(e.target[0].value); };
    el.querySelector('.clipList').onclick = async e => {
      const d = e.target.dataset, all = wdata.clips || [];
      if (d.del) { wsave('clips', all.filter(c => c.id !== d.del)); this.draw(el); }
      if (d.fav) { wsave('clips', all.map(c => c.id === d.fav ? {...c, fav: !c.fav} : c)); this.draw(el); }
      if (d.copy) {
        await copyText(all.find(c => c.id === d.copy).text);
        e.target.classList.add('copied');
        setTimeout(() => e.target.classList.remove('copied'), 700);
      }
    };
  },
};

// ── 메모리 비우기 ── 서버가 도는 PC 의 메모리를 보여 준다
let memState = null, memNote = '';
const memGb = n => (n / 1024 ** 3).toFixed(1) + ' GB';
W.memory = {
  name: '메모리 비우기', icon: '🧹', about: 'PC 메모리를 많이 쓰는 앱을 보고 필요 없는 앱을 끕니다 (저장 안 한 문서는 앱이 먼저 묻습니다)',
  tick(t) { if (t % 60 === 0) this.load(); },
  async load() {
    try { memState = await api('/api/memory'); memNote = ''; } catch (err) { memNote = err.message; }
    this.draw();
  },
  draw(el = wbody('memory')) {
    if (!el) return;
    wtools('memory', '<button class="icon" type="button" data-re title="새로 고침" aria-label="새로 고침">↻</button>');
    document.querySelector('#w-memory .tools').onclick = e => { if ('re' in e.target.dataset) this.load(); };
    if (!memState) {
      el.innerHTML = memNote ? `<div class="alert">${esc(memNote)}</div>` : '<div class="none">메모리를 살피는 중입니다</div>';
      if (!memNote) this.load();
      return;
    }
    const m = memState, when = new Date(m.when * 1000).toLocaleTimeString('ko', {hour12: false, hour: '2-digit', minute: '2-digit'});
    el.innerHTML = `<div class="small muted">램 ${Math.round(m.total / 1024 ** 3)}GB 중 여유 ${Math.round(m.free / m.total * 100)}% · 램이 넘쳐 디스크에 내려놓은 짐 ${memGb(m.paged)} · ${when} 기준</div>${memNote ? `<div class="alert">${esc(memNote)}</div>` : ''}${m.apps.slice(0, 12).map((a, i) => `<div class="line mem"><b>${esc(a.label)}</b><span class="amt">${memGb(a.bytes)}</span>${a.kill ? `<button class="kill" type="button" data-kill="${i}" aria-label="${esc(a.label)} 끄기">끄기</button>` : ''}</div>`).join('')}`;
    el.onclick = async e => {
      const a = memState.apps[e.target.dataset.kill];
      if (!a || !confirm(`${a.label}을(를) 끌까요? 저장하지 않은 문서가 있으면 앱이 먼저 묻습니다.`)) return;
      e.target.disabled = true;
      try {
        const got = await api('/api/memory', {label: a.label});
        memState = got.state;
        memNote = got.closed ? '' : `${a.label}이(가) 아직 켜져 있습니다. 앱 화면에서 저장 확인 창을 살펴 주세요`;
      } catch (err) { memNote = err.message; }
      this.draw();
    };
  },
};

// ── 주식 ── 시세 카드와 따로 관심 종목을 둔다
const STOCK_HOME = [{symbol: '^KS11', name: '코스피'}, {symbol: '^KQ11', name: '코스닥'}, {symbol: '^DJI', name: '다우'}, {symbol: '^GSPC', name: 'S&P 500'}, {symbol: '^IXIC', name: '나스닥'}];
// ── 이슈 ── 매일 아침 6시 ai-buzz\run.ps1 이 만든 보험 이슈·해외 AI·국내 AI 글 (서버 /api/issues)
let issueData = null, issueTab = localStorage.issueTab || 'insurance';
const issueMd = s => esc(s || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');  // 글 안의 **굵게** 만 살린다
W.issues = {
  name: '이슈', icon: '📰', about: '보험 이슈·해외 AI·국내 AI 소식. 매일 아침 6시쯤 새로 채웁니다',
  tick(t) { if (t % 1800 === 0) this.load(); },
  async load() {
    try { issueData = await api('/api/issues'); } catch (err) { issueData = {err: err.message}; }
    this.draw();
  },
  draw(el = wbody('issues')) {
    if (!el) return;
    wtools('issues', '<button class="icon" type="button" data-re title="새로 고침" aria-label="이슈 새로 고침">↻</button>');
    document.querySelector('#w-issues .tools').onclick = e => { if ('re' in e.target.dataset) this.load(); };
    if (!issueData) { el.innerHTML = '<div class="none">이슈를 읽는 중입니다</div>'; this.load(); return; }
    if (issueData.err) { el.innerHTML = `<div class="alert">${esc(issueData.err)}</div>`; return; }
    const tab = issueData.find(t => t.key === issueTab) || issueData[0];
    const art = it => `<article class="iart">${it.badge ? `<span class="ibadge">${esc(it.badge)}</span>` : ''}<h3>${esc(it.title)}</h3>`
      + (it.sections || []).map(s => `<p>${s.lead ? `<b>${esc(s.lead)}</b> ` : ''}${issueMd(s.text)}</p>`).join('')
      + (it.quotes || []).map(q => `<blockquote>${esc(q)}</blockquote>`).join('')
      + (it.meta ? `<div class="imeta">${esc(it.meta)}</div>` : '')
      + ((it.links || []).length ? `<div class="ilinks">${it.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label || '원문')} ↗</a>`).join('')}</div>` : '')
      + '</article>';
    el.innerHTML = `<div class="itabs">${issueData.map(t => `<button type="button" data-tab="${t.key}" aria-pressed="${t === tab}">${t.items?.length ? '• ' : ''}${esc(t.name)}</button>`).join('')}</div>`
      + `<div class="imeta">${tab.updated ? esc(tab.updated) + ' 기준' : ''}${tab.notice ? ' · ' + esc(tab.notice) : ''}</div>`
      + (tab.items?.length ? tab.items.map(art).join('') : `<div class="none">${esc(tab.note || '오늘은 조용합니다')}</div>`);
    el.querySelector('.itabs').onclick = e => {
      const key = e.target.dataset.tab;
      if (key) { issueTab = localStorage.issueTab = key; this.draw(el); el.scrollTop = 0; }
    };
  },
};

const sparkLine = list => {
  if (!list || list.length < 2) return '';
  const lo = Math.min(...list), hi = Math.max(...list), span = hi - lo || 1;
  return `<svg class="wspark" viewBox="0 0 60 18" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke" points="${list.map((v, i) => `${(i / (list.length - 1) * 60).toFixed(1)},${(17 - (v - lo) / span * 16).toFixed(1)}`).join(' ')}"/></svg>`;
};
W.stocks = {
  name: '주식', icon: '📈', about: '관심 종목의 현재가·등락률. 이름이나 코드로 찾아 추가합니다',
  rows: [],
  list: () => wdata.stocks || STOCK_HOME,
  draw(el = wbody('stocks')) {
    wtools('stocks', '<button class="icon" type="button" title="새로고침" aria-label="새로고침">↻</button>');
    document.querySelector('#w-stocks .tools').onclick = () => this.load();
    el.innerHTML = `<div class="stockRows"></div><div class="wplaces stockHits"></div><form class="add"><input placeholder="종목 찾기 (삼성전자, AAPL, 005930)" aria-label="종목 찾기"><button class="pill" type="submit">찾기</button></form>`;
    el.querySelector('form').onsubmit = e => { e.preventDefault(); this.search(el, e.target[0].value.trim()); };
    el.querySelector('.stockRows').onclick = e => {
      const code = e.target.dataset.del;
      if (code) { wsave('stocks', this.list().filter(s => s.symbol !== code)); this.load(); }
    };
    this.load();
  },
  async load() {
    const el = wbody('stocks'), list = this.list();
    if (!el) return;
    const rows = el.querySelector('.stockRows');
    if (!list.length) { rows.innerHTML = '<div class="none">종목을 추가하세요</div>'; return; }
    try {
      const got = await api('/api/stocks?s=' + encodeURIComponent(list.map(s => s.symbol).join(',')));
      rows.innerHTML = got.map((q, i) => {
        const d = q.price == null ? 0 : q.price - q.prev;
        return `<div class="line stock"><span class="stockName" title="${esc(q.symbol)}">${esc(list[i].name)}</span><span class="${sign(d)}">${sparkLine(q.spark)}</span><b>${q.price == null ? '—' : q.price.toLocaleString('ko', {maximumFractionDigits: 2})}</b><span class="${sign(d)} stockPct">${q.price == null ? '' : `${arrow(d)}${Math.abs(d / q.prev * 100).toFixed(2)}%`}</span><button class="icon" type="button" data-del="${esc(q.symbol)}" aria-label="${esc(list[i].name)} 빼기">×</button></div>`;
      }).join('');
    } catch { rows.innerHTML = '<div class="none">시세를 가져오지 못했습니다</div>'; }
  },
  async search(el, q) {
    const hits = el.querySelector('.stockHits');
    if (!q) return;
    hits.textContent = '찾는 중…';
    let rows = [];
    try { rows = await api('/api/stocks/search?q=' + encodeURIComponent(q)); } catch { /* 코드 직접 입력으로 넘어간다 */ }
    if (!rows.length && /^\d{6}$/.test(q)) rows = [{symbol: q + '.KS', name: q, where: '코스피'}, {symbol: q + '.KQ', name: q, where: '코스닥'}];
    if (!rows.length && /^[A-Za-z.^-]{1,10}$/.test(q)) rows = [{symbol: q.toUpperCase(), name: q.toUpperCase(), where: ''}];
    hits.innerHTML = rows.map((r, i) => `<button class="pill ghost" type="button" data-i="${i}">${esc(r.name)} <span class="muted small">${esc(r.symbol)} ${esc(r.where)}</span></button>`).join('') || '찾지 못했습니다';
    hits.onclick = e => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const r = rows[b.dataset.i];
      if (!this.list().some(s => s.symbol === r.symbol)) wsave('stocks', [...this.list(), {symbol: r.symbol, name: r.name.slice(0, 30)}].slice(0, 30));
      hits.textContent = '';
      el.querySelector('form input').value = '';
      this.load();
    };
  },
  tick(n) { if (n % 300 === 0) this.load(); },
};

// ── 이미지 ──
const IMG_MAX = 40, IMG_DIM = 1280;
const slideSrc = i => /^(\/uploads\/|https?:\/\/)/.test(i.src) ? i.src : '';
async function shrinkImage(file) {
  if (/gif/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file), r = Math.min(1, IMG_DIM / Math.max(bmp.width, bmp.height));
    const can = document.createElement('canvas');
    can.width = Math.round(bmp.width * r); can.height = Math.round(bmp.height * r);
    can.getContext('2d').drawImage(bmp, 0, 0, can.width, can.height);
    const png = file.type === 'image/png', blob = await new Promise(ok => can.toBlob(ok, png ? 'image/png' : 'image/jpeg', .82));
    return blob && (r < 1 || blob.size < file.size) ? new File([blob], (file.name || 'image').replace(/\.\w+$/, '') + (png ? '.png' : '.jpg'), {type: blob.type}) : file;
  } catch { return file; }
}
W.images = {
  name: '이미지', icon: '🖼️', about: '사진을 슬라이드로 넘겨 봅니다. 파일·붙여넣기·끌어다 놓기·주소로 추가',
  index: 0, spent: 0, restored: false,
  cfg: () => ({title: '', intervalSec: 5, items: [], ...(wdata.images || {})}),
  put(next) { wsave('images', {...this.cfg(), ...next}); this.draw(); if ($('imgManage')?.open) this.manage(); if ($('imgFull')?.open) this.full(); },
  note(text) { document.querySelectorAll('.imgNote').forEach(n => { n.textContent = text; }); },
  remember(top = 0, left = 0) { localStorage.imgView = JSON.stringify({index: this.index, top, left}); },
  async addFiles(files) {
    const room = IMG_MAX - this.cfg().items.length, take = [...files].slice(0, Math.max(0, room)), skipped = files.length - take.length;
    const added = [];
    this.note('올리는 중…');
    for (const file of take) {
      const small = await shrinkImage(file), name = small.name && /\.\w+$/.test(small.name) ? small.name : 'image.png';
      const res = await fetch('/api/upload?name=' + encodeURIComponent(name), {method: 'POST', body: small});
      if (res.ok) added.push({id: wid(), src: '/uploads/' + encodeURIComponent((await res.json()).stored), caption: (file.name || '').replace(/\.\w+$/, '').replace(/^image$/, '')});
    }
    if (added.length) this.put({items: [...this.cfg().items, ...added]});
    this.note(skipped > 0 ? `최대 ${IMG_MAX}장이라 ${skipped}개를 건너뛰었습니다. 기존 이미지를 지운 뒤 추가해 주세요.` : added.length < take.length ? '일부 이미지를 올리지 못했습니다.' : '');
  },
  addUrl(text) {
    const url = linkUrl(text.trim());
    if (!url) return this.note('http 또는 https 주소만 넣을 수 있습니다.');
    if (this.cfg().items.length >= IMG_MAX) return this.note(`최대 ${IMG_MAX}장입니다.`);
    this.put({items: [...this.cfg().items, {id: wid(), src: url.href, caption: ''}]});
    this.note('');
  },
  // 붙여넣기·끌어다 놓기 공통: 이미지 파일이 있으면 파일로, 없으면 주소로
  take(data, e) {
    const files = imageFiles(data.files);
    if (!files.length && !/^https?:\/\/\S+$/.test((data.getData('text/uri-list') || data.getData('text') || '').trim())) return false;
    e.preventDefault(); e.stopPropagation();
    files.length ? this.addFiles(files) : this.addUrl(data.getData('text/uri-list') || data.getData('text'));
    return true;
  },
  async pasteButton() {
    if (!navigator.clipboard?.read) return this.note('이 주소에서는 버튼을 쓸 수 없습니다. 카드를 누르고 Ctrl+V 를 눌러 주세요.');
    try {
      const files = [];
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) { const blob = await item.getType(type); files.push(new File([blob], '', {type})); }
      }
      files.length ? this.addFiles(files) : this.note('클립보드에 이미지가 없습니다. 화면을 캡처한 뒤 다시 눌러 주세요.');
    } catch { this.note('클립보드 읽기 권한이 필요합니다. 권한을 허용하거나 Ctrl+V 로 붙여넣어 주세요.'); }
  },
  pickFile() { $('imgFile').click(); },
  go(step) {
    const n = this.cfg().items.length;
    if (n) { this.index = (this.index + step + n) % n; this.spent = 0; this.draw(); this.remember(); if ($('imgFull')?.open) this.full(); }
  },
  download(item) {
    if (!item.src.startsWith('/uploads/')) return open(item.src, '_blank', 'noopener');
    const a = document.createElement('a');
    a.href = item.src;
    a.download = decodeURIComponent(item.src.slice(9)).replace(/^[0-9a-f]{8}_/, '');
    a.click();
  },
  draw(el = wbody('images')) {
    if (!el) return;
    const c = this.cfg(), items = c.items;
    document.querySelector('#w-images h2').textContent = c.title.trim() || this.name;
    wtools('images', '<button class="icon" type="button" data-a="manage" title="관리" aria-label="이미지 관리">⚙</button>');
    document.querySelector('#w-images .tools').onclick = e => { if (e.target.dataset.a) this.manage(); };
    if (!document.querySelector('#imgFile')) {
      document.body.insertAdjacentHTML('beforeend', '<input id="imgFile" type="file" accept="image/*" multiple hidden>');
      $('imgFile').onchange = e => { this.addFiles(imageFiles(e.target.files)); e.target.value = ''; };
    }
    if (!this.restored && items.length) {
      this.restored = true;
      const v = JSON.parse(localStorage.imgView || '{}');
      if (v.index > 0 && v.index < items.length) this.index = v.index;
      this.view = v;
    }
    el.tabIndex = 0;
    el.setAttribute('aria-label', '이미지 슬라이드. Ctrl+V 로 이미지 추가');
    el.onpaste = e => this.take(e.clipboardData, e);
    el.ondragover = e => { e.preventDefault(); e.stopPropagation(); };
    el.ondragenter = el.ondragleave = e => e.stopPropagation();
    el.ondrop = e => { e.preventDefault(); e.stopPropagation(); this.take(e.dataTransfer, e); };
    el.onkeydown = e => { if (e.target === el && e.key === 'ArrowLeft') this.go(-1); if (e.target === el && e.key === 'ArrowRight') this.go(1); };
    if (!items.length) {
      el.innerHTML = `<div class="imgEmpty"><span>🖼️</span><span class="small">이미지가 없습니다. 눌러서 파일을 고르거나, Ctrl+V 로 붙여넣으세요.</span><div class="imgBar" style="position:static;opacity:1"><button class="pill ghost" type="button" data-a="file">＋ 파일</button><button class="pill ghost" type="button" data-a="paste">붙여넣기</button></div><span class="small err imgNote"></span></div>`;
      el.querySelector('.imgEmpty').onclick = e => (e.target.dataset.a === 'paste' ? this.pasteButton() : this.pickFile());
      return;
    }
    this.index = Math.min(this.index, items.length - 1);
    const item = items[this.index];
    el.innerHTML = `<div class="imgStage"><div class="imgScroll"><img src="${esc(slideSrc(item))}" alt="${esc(item.caption || `슬라이드 ${this.index + 1}`)}" draggable="false"></div>${items.length > 1 ? '<button class="imgNav" type="button" data-a="prev" aria-label="이전 이미지" style="left:4px">‹</button><button class="imgNav" type="button" data-a="next" aria-label="다음 이미지" style="right:4px">›</button>' : ''}<div class="imgBar"><button type="button" data-a="file" title="파일 추가" aria-label="파일 추가">＋</button><button type="button" data-a="paste" title="붙여넣기" aria-label="붙여넣기">📋</button><button type="button" data-a="save" title="내려받기" aria-label="현재 이미지 내려받기">⬇</button></div></div>${item.caption ? `<div class="small imgCap">${esc(item.caption)}</div>` : ''}${items.length > 1 ? `<div class="imgDots">${items.map((x, i) => `<button type="button" data-i="${i}" aria-label="${i + 1}번째" aria-current="${i === this.index}"></button>`).join('')}</div>` : ''}<div class="small err imgNote"></div>`;
    const box = el.querySelector('.imgScroll'), img = box.querySelector('img');
    img.onerror = () => { box.innerHTML = '<div class="none">이미지를 불러오지 못했습니다</div>'; };
    if (this.view) { const v = this.view; this.view = null; img.onload = () => { box.scrollTop = v.top || 0; box.scrollLeft = v.left || 0; }; }
    box.onscroll = () => { clearTimeout(this.scrollTimer); this.scrollTimer = setTimeout(() => this.remember(box.scrollTop, box.scrollLeft), 300); };
    // 끌면 이동, 거의 안 움직이고 떼면 전체 보기
    box.onpointerdown = e => {
      const x = e.clientX, y = e.clientY, top = box.scrollTop, left = box.scrollLeft;
      let moved = false;
      box.setPointerCapture(e.pointerId);
      box.onpointermove = ev => {
        if (Math.hypot(ev.clientX - x, ev.clientY - y) >= 5) moved = true;
        if (moved) { box.scrollTop = top - (ev.clientY - y); box.scrollLeft = left - (ev.clientX - x); }
      };
      box.onpointerup = () => { box.onpointermove = box.onpointerup = null; if (!moved) this.full(); };
    };
    el.querySelector('.imgStage').onclick = e => this.act(e.target.dataset.a, item);
    el.querySelector('.imgDots')?.addEventListener('click', e => { if (e.target.dataset.i) this.go(+e.target.dataset.i - this.index); });
  },
  act(a, item) {
    if (a === 'prev') this.go(-1);
    if (a === 'next') this.go(1);
    if (a === 'file') this.pickFile();
    if (a === 'paste') this.pasteButton();
    if (a === 'save') this.download(item);
  },
  full() {
    const c = this.cfg(), box = wDialog('imgFull', c.title.trim() || this.name), item = c.items[this.index];
    if (!item) return box.close();
    wpopBody(box).innerHTML = `<div class="imgStage imgBig"><div class="imgScroll" style="cursor:default"><img src="${esc(slideSrc(item))}" alt="${esc(item.caption || '')}"></div>${c.items.length > 1 ? '<button class="imgNav" type="button" data-a="prev" aria-label="이전 이미지" style="left:6px">‹</button><button class="imgNav" type="button" data-a="next" aria-label="다음 이미지" style="right:6px">›</button>' : ''}<div class="imgBar" style="opacity:1"><button type="button" data-a="paste" aria-label="붙여넣기">📋</button><button type="button" data-a="save" aria-label="내려받기">⬇</button></div></div><div class="small imgCap">${esc(item.caption)} <span class="muted">${this.index + 1} / ${c.items.length}</span></div><div class="small err imgNote"></div>`;
    wpopBody(box).querySelector('.imgStage').onclick = e => this.act(e.target.dataset.a, item);
    box.onkeydown = e => { if (e.key === 'ArrowLeft') this.go(-1); if (e.key === 'ArrowRight') this.go(1); };
    box.onpaste = e => this.take(e.clipboardData, e);
    if (!box.open) box.showModal();
  },
  manage() {
    const c = this.cfg(), box = wDialog('imgManage', '이미지 관리');
    const body = wpopBody(box);
    body.innerHTML = `<div class="unitRow"><label class="small" style="flex:1">제목 <input class="field" data-f="title" value="${esc(c.title)}" maxlength="40"></label><label class="small" style="width:8em">자동 넘김(초, 0은 끔) <input class="field" data-f="interval" type="number" min="0" max="60" value="${c.intervalSec}"></label></div><div class="imgDrop" tabindex="0">파일을 끌어다 놓거나 여기를 누른 뒤 Ctrl+V <span><button class="pill ghost" type="button" data-a="file">＋ 파일</button> <button class="pill ghost" type="button" data-a="paste">붙여넣기</button></span></div><form class="add"><input placeholder="이미지 주소 (https://…)" aria-label="이미지 주소"><button class="pill" type="submit">주소 추가</button></form><div class="small err imgNote"></div><div class="imgRows">${c.items.map((x, i) => `<div class="line imgRow" data-id="${x.id}"><img src="${esc(slideSrc(x))}" alt=""><input class="field" data-cap value="${esc(x.caption)}" placeholder="설명" aria-label="${i + 1}번째 설명" maxlength="100"><button class="icon" type="button" data-move="-1" aria-label="위로"${i ? '' : ' disabled'}>▲</button><button class="icon" type="button" data-move="1" aria-label="아래로"${i < c.items.length - 1 ? '' : ' disabled'}>▼</button><button class="icon" type="button" data-del aria-label="지우기">×</button></div>`).join('') || '<div class="none">이미지가 없습니다</div>'}</div>`;
    const clampSec = v => v <= 0 ? 0 : Math.min(60, Math.max(2, v || 5));
    body.querySelector('[data-f=title]').onchange = e => { wsave('images', {...this.cfg(), title: e.target.value}); this.draw(); };
    body.querySelector('[data-f=interval]').onchange = e => { e.target.value = clampSec(+e.target.value); wsave('images', {...this.cfg(), intervalSec: +e.target.value}); };
    body.querySelector('form').onsubmit = e => { e.preventDefault(); this.addUrl(e.target[0].value); };
    const drop = body.querySelector('.imgDrop');
    drop.onclick = e => { if (e.target.dataset.a === 'file') this.pickFile(); if (e.target.dataset.a === 'paste') this.pasteButton(); };
    box.onpaste = e => { if (e.target.tagName !== 'INPUT' || imageFiles(e.clipboardData.files).length) this.take(e.clipboardData, e); };
    box.ondragover = e => { e.preventDefault(); e.stopPropagation(); };
    box.ondrop = e => { e.preventDefault(); e.stopPropagation(); this.take(e.dataTransfer, e); };
    const rows = body.querySelector('.imgRows');
    rows.onchange = e => {
      if (!('cap' in e.target.dataset)) return;
      const id = e.target.closest('.imgRow').dataset.id;
      wsave('images', {...this.cfg(), items: this.cfg().items.map(x => x.id === id ? {...x, caption: e.target.value} : x)});
      this.draw();
    };
    rows.onclick = e => {
      const row = e.target.closest('.imgRow');
      if (!row) return;
      const list = [...this.cfg().items], i = list.findIndex(x => x.id === row.dataset.id);
      if ('del' in e.target.dataset) { list.splice(i, 1); this.put({items: list}); }
      if (e.target.dataset.move) { const j = i + +e.target.dataset.move; [list[i], list[j]] = [list[j], list[i]]; this.put({items: list}); }
    };
    if (!box.open) box.showModal();
  },
  tick() {
    const c = this.cfg(), sec5 = c.intervalSec, el = wbody('images');
    if (!sec5 || c.items.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches || el.matches(':hover') || el.contains(document.activeElement) || $('imgFull')?.open || $('imgManage')?.open) return;
    if (++this.spent >= sec5) this.go(1);
  },
};

// ── 외출복 ── 참고 앱의 체감 구간·활동·위험 규칙을 옮겼다. 시간별 예보(Open-Meteo)를 그대로 쓴다
const OUT_ACTS = {urban_walk: ['🏙️', '산책'], picnic: ['🧺', '소풍'], river: ['🌊', '강변'], beach: ['🏖️', '해변'], running: ['🏃', '달리기'], cycling: ['🚴', '자전거'], hiking: ['🏔️', '등산'], golf: ['⛳', '골프']};
const OUT_SENSE = {'cold-much': ['추위 많이 탐', -3], cold: ['추위 탐', -1.5], normal: ['보통', 0], heat: ['더위 탐', 1.5], 'heat-much': ['더위 많이 탐', 3]};
const OUT_PERIODS = [['dawn', '새벽', '🌙', 3], ['h07_09', '07~09시', '🌅', 8], ['h10_12', '10~12시', '☀️', 11], ['h13_15', '13~15시', '🌤', 14], ['h16_18', '16~18시', '🌇', 17], ['h19_21', '19~21시', '🌆', 20], ['h21_23', '22~23시', '🌙', 22]];
const outPeriodAt = h => h < 7 ? 0 : h < 10 ? 1 : h < 13 ? 2 : h < 16 ? 3 : h < 19 ? 4 : h < 22 ? 5 : 6;
const OUT_LABEL = {hot: '덥다! 가볍게', warm: '따뜻해요', mild: '선선해요', cool: '쌀쌀해요', cold: '추워요', freezing: '매우 추워요'};
const OUT_CATS = {base: '이너', top: '상의', mid: '미들레이어', outer: '아우터', bottom: '하의', foot: '신발', acc: '액세서리', rain: '우천 준비', mask: '마스크'};
const outZone = f => f >= 28 ? 'hot' : f >= 23 ? 'warm' : f >= 18 ? 'mild' : f >= 12 ? 'cool' : f >= 6 ? 'cold' : 'freezing';
const OUT_MICRO = {river: -2, beach: -1, golf: -2, hiking: -2};
const OUT_NOTE = {
  river: '🌊 강변은 강바람과 수면 증발로 체감온도가 도심보다 2~3°C 낮아요. 방풍 소재 겉옷을 꼭 챙기세요.',
  beach: '🏖️ 해변은 수면 반사로 자외선이 도심보다 30~50% 강합니다. 자외선 차단에 특히 신경 쓰고, 해풍으로 생각보다 시원할 수 있어요.',
  golf: '⛳ 골프장은 탁 트인 개방지라 바람이 세고 체감온도가 낮아요. 이른 아침 라운딩이라면 더욱 따뜻하게 레이어링을 준비하세요.',
  hiking: '🏔️ 산은 100m 오를수록 약 0.6°C씩 기온이 내려가요. 정상부는 3~5°C 낮고 바람도 강하니, 배낭에 여분 레이어를 반드시 챙기세요.',
};
const it = (name, icon, cat, need, cond, tag) => ({name, icon, cat, need, cond, tag});
function outBase(zone, female, act, fl, uv) {
  const a = [], top = female ? '👚' : '👕';
  if (zone === 'freezing') { a.push(it('긴팔/내복(상의)', '🧣', 'base', true)); if (female) a.push(it('긴팔/내복(하의)', '🩱', 'base', true)); }
  a.push(it({hot: '얇은 (반팔)셔츠', warm: female ? '얇은 블라우스 (긴팔)' : '얇은 긴팔 셔츠', mild: '긴팔 셔츠', cool: '두꺼운 긴팔', cold: '두꺼운 상의', freezing: '두꺼운 상의'}[zone], top, 'top', true));
  if (zone === 'hot' && !['golf', 'beach'].includes(act) && uv >= 3) {
    const high = uv >= 6, cond = `UV ${uv} — 자외선 ${high ? '높음' : '보통'}`;
    a.push(it('모자', '🧢', 'acc', high, cond), it('선글라스', '🕶️', 'acc', high, cond));
  }
  if (zone === 'mild') a.push(it(female ? '얇은 가디건' : '맨투맨', '🧥', 'mid', false, '아침저녁 쌀쌀할 때'));
  if (zone === 'cool') a.push(it('맨투맨', '🧥', 'mid', true, '점퍼 안에 레이어드 — 함께 착용'));
  if (zone === 'cold' || zone === 'freezing') a.push(it('두꺼운 상의', '🧥', 'mid', true));
  if (zone === 'cool') a.push(it('얇은 점퍼', '🧥', 'outer', true, '가디건 위에 겹쳐 착용'));
  if (zone === 'cold') a.push(it('경량 패딩', '🧥', 'outer', true));
  if (zone === 'freezing') a.push(it(fl < 0 ? '다운 패딩' : '두꺼운 패딩', '🥶', 'outer', true, fl < 0 ? '0℃ 미만 — 한파·강풍 시 장시간 야외 자제' : '0~5℃ 구간'));
  const bottom = {hot: '반바지', warm: '얇은 바지', mild: '면바지', cool: '면바지', cold: '두꺼운 바지', freezing: '두꺼운 바지'}[zone];
  a.push(it(bottom, zone === 'hot' && !female ? '🩳' : '👖', 'bottom', true));
  if (female) {
    if (zone === 'hot') a.push(it('원피스 (선택)', '👗', 'bottom', false, '원피스로 대체 가능'));
    if (zone === 'warm') a.push(it('미디스커트 (선택)', '👗', 'bottom', false, '스커트로 대체 가능'));
    if (zone === 'mild') a.push(it('미디스커트 + 스타킹 (선택)', '👗', 'bottom', false, '스커트 착용 시 스타킹 필수'));
    if (zone === 'cool') a.push(it('롱스커트 + 두꺼운 타이츠 (선택)', '👗', 'bottom', false, '스커트 착용 시 타이츠 필수'));
  }
  a.push(outShoes(act, zone, female));
  return a;
}
function outShoes(act, zone, female) {
  if (act === 'hiking') return it('등산화', '🥾', 'foot', true);
  if (act === 'running' || act === 'cycling') return it('운동화', '👟', 'foot', true);
  if (act === 'golf') return it('골프화', '👞', 'foot', true);
  if (act === 'beach') return it('샌들', '🩴', 'foot', true);
  if (zone === 'cold' || zone === 'freezing') return it('방한 부츠', '🥾', 'foot', true);
  if (zone === 'cool' && female) return it('로퍼', '👞', 'foot', true);
  if ((zone === 'hot' || zone === 'warm') && female) return it('샌들', '🩴', 'foot', true);
  return it('운동화', '👟', 'foot', true);
}
function outActivity(act, zone, female, uv) {
  const a = [], tag = {running: '달리기 전용', cycling: '자전거 전용', golf: '골프 전용', hiking: '등산 전용', beach: '해변 전용'}[act];
  if (act === 'golf') { a.push(it('골프 모자', '🧢', 'acc', true, '', tag)); if (female) a.push(it('골프 하의', '🩺', 'bottom', false, '', tag)); }
  if (act === 'hiking') {
    a.push(it('등산 모자', '🧢', 'acc', false, '', tag), it('등산 스틱', '🏔️', 'acc', false, '무릎 보호', tag));
    if (zone === 'cold' || zone === 'freezing') a.push(it('장갑', '🧤', 'acc', true, '', tag));
  }
  if (act === 'running' || act === 'cycling') {
    a.push(it('스포츠 모자', '🎽', 'acc', false, '', tag));
    if (zone === 'cold' || zone === 'freezing') a.push(it('얇은 장갑', '🧤', 'acc', true, '', tag));
  }
  if (act === 'beach') a.push(it('선글라스', '🕶️', 'acc', true, '', tag));
  if (zone === 'cold' || zone === 'freezing') a.push(it(female ? '머플러' : '목도리', '🧣', 'acc', zone === 'freezing'));
  if (zone === 'freezing') a.push(it('두꺼운 모자', '🎓', 'acc', true), it('장갑', '🧤', 'acc', true));
  if (zone === 'cool' && female) a.push(it('에코백 / 숄더백', '👜', 'acc', false, '스타일 포인트'));
  if (zone === 'warm' && uv >= 3) {
    const high = uv >= 6, cond = `UV ${uv} — 자외선 ${high ? '높음' : '보통'}`;
    a.push(it('모자', '👒', 'acc', high, cond), it('선글라스', '🕶️', 'acc', high, cond));
  }
  return a;
}
function outMicro(act, zone, female) {
  const a = [], warm = zone === 'hot' || zone === 'warm';
  if (act === 'river') {
    if (warm) a.push(it('바람막이', '💨', 'outer', true, '강변 강풍·체감온도 저하 대비', '강변'));
    if (zone === 'mild') a.push(it('방풍 점퍼', '💨', 'outer', true, '강변 강풍 체감온도 대비', '강변'));
  }
  if (act === 'golf') {
    if (warm) a.push(it('팔토시', '🧴', 'acc', false, '개방 잔디밭 직사광선·자외선 차단', '골프 전용'), it('넥 게이터', '🧣', 'acc', false, '목·얼굴 자외선·열 차단', '골프 전용'));
    if (zone === 'mild' || zone === 'cool') a.push(it('윈드 조끼', '🧥', 'mid', false, '이른 라운딩 아침 한기 대비', '골프 전용'));
  }
  if (act === 'beach') {
    a.push(it('모자', '👒', 'acc', true, '수면 반사 자외선 차단 필수', '해변 전용'), it('선크림', '🧴', 'acc', true, '2시간마다 덧발라주세요', '해변 전용'));
    if (female) a.push(it('비치 커버업', '👗', 'outer', false, '이동 시 자외선·모래 차단', '해변 전용'));
  }
  if (act === 'hiking' && (warm || zone === 'mild')) a.push(it('바람막이', '🏔️', 'outer', true, '정상부 기온 저하·강풍 대비', '등산 전용'), it('경량 다운', '🎒', 'mid', false, '정상 체온 유지·비상용', '등산 전용'));
  return a;
}
function outDanger(s) {
  const r = [], {activity: act, windSpeed: wind, feelsLike: fl, uvIndex: uv, dustGrade: dust, ptyCode: pty, precipitation: mm} = s;
  let level = 'none', cancel = false;
  const raise = to => { if (level === 'none') level = to; };
  if ((pty === '4' || (pty === '1' && mm >= 5)) && act !== 'urban_walk') { r.push('⚡ 낙뢰 위험: 골프채·등산스틱·라켓 등 긴 물체를 즉시 내려놓고 안전한 건물이나 차량으로 대피하세요. (기상청 낙뢰 행동요령)'); level = 'cancel'; cancel = true; }
  if (wind >= 21 && ['golf', 'hiking', 'cycling', 'beach'].includes(act)) { r.push('🌪️ 강풍경보 수준 (21m/s 이상): 야외 스포츠 활동을 취소하세요. (기상청 강풍 행동요령)'); level = 'cancel'; cancel = true; }
  if (mm >= 15 && ['hiking', 'river', 'picnic', 'beach'].includes(act)) { r.push('🌧️ 호우 위험: 등산·강변·야영·해변 활동을 중단하고 안전한 곳으로 이동하세요. (기상청 호우 행동요령)'); level = 'cancel'; cancel = true; }
  if (dust === '4') { raise('warning'); r.push('😷 미세먼지 매우나쁨: 야외 운동·장시간 실외활동을 제한하고 실내로 대체하세요. (에어코리아 미세먼지 행동요령)'); if (['running', 'cycling', 'hiking'].includes(act)) cancel = true; }
  if (wind >= 14 && wind < 21) { raise('warning'); r.push('💨 강풍주의보 수준 (14m/s 이상): 야외활동을 자제하고 낙하물 위험 구역을 피하세요. (기상청 강풍 행동요령)'); }
  if (fl >= 38) { raise('warning'); r.push('🥵 폭염 경고: 체감온도 38°C 이상입니다. 한낮 야외활동을 멈추고 충분히 쉬세요. (기상청 폭염 특보 기준)'); }
  else if (fl >= 33) { raise('caution'); r.push('☀️ 폭염 주의: 체감온도 33°C 이상입니다. 수시 수분 섭취와 장시간 야외활동 자제가 필요합니다. (기상청 생활기상지수)'); }
  if (uv >= 8) { raise('caution'); r.push(`☀️ 자외선 매우높음 (UV ${uv}): 오전 10시~오후 3시 외출을 피하고 긴팔·모자·선글라스·선크림이 필수입니다. (기상청 생활기상지수)`); }
  else if (uv >= 6) { raise('caution'); r.push(`🌡️ 자외선 높음 (UV ${uv}): 한낮에는 그늘에 머물고 긴팔·모자·선글라스·선크림을 갖추세요. (기상청 생활기상지수)`); }
  if (dust === '3') { raise('caution'); r.push('😷 미세먼지 나쁨 (PM10 81~150 ㎍/㎥): 보건용 마스크(KF80 이상)를 착용하고 조깅·등산·자전거 등 호흡량 많은 운동을 줄이세요. (에어코리아 미세먼지 행동요령)'); }
  return {level, reasons: r, cancel};
}
function outTips(zone, s) {
  const t = [], {uvIndex: uv, dustGrade: dust, windSpeed: wind, activity: act, precipitation: mm, feelsLike: fl, humidity: hum, temperature: temp} = s;
  if (uv >= 11) t.push(`☀️ 자외선 위험 (UV ${uv}): 가능한 실내에 머무르세요. 외출 시 긴 소매·모자·선글라스·SPF50+ 선크림이 필요합니다.`);
  else if (uv >= 8) t.push(`☀️ 자외선 매우높음 (UV ${uv}): 오전 10시~오후 3시 외출을 피하고, 긴 소매·모자·선글라스·선크림을 갖추세요.`);
  else if (uv >= 6) t.push('🌡️ 오늘은 자외선이 강합니다. 긴팔 또는 팔토시, 모자, UV 차단 선글라스, 자외선 차단제가 필요합니다.');
  else if (uv >= 3) t.push(`💡 UV ${uv}: 모자·선글라스·자외선 차단제를 챙겨 두세요. (기상청 생활기상지수)`);
  if (dust === '4') t.push('😷 미세먼지 매우나쁨: KF94 마스크 필수. 야외 운동(조깅·등산·자전거)을 중단하고 실내에 머무세요.');
  else if (dust === '3') t.push('😷 미세먼지가 나쁩니다. 보건용 마스크를 준비하고 조깅, 등산, 자전거처럼 숨이 많이 차는 활동은 줄이세요.');
  if (['hot', 'warm', 'mild'].includes(zone) && ['running', 'cycling', 'hiking', 'golf'].includes(act)) t.push('⏰ 오존 피크 시간(오전 10시~오후 4시): 고강도 야외 운동은 이른 아침·저녁으로 조정하면 더 안전합니다. (에어코리아 오존 행동요령)');
  if (zone === 'warm' && (dust === '3' || dust === '4')) t.push('🌡️ 체감이 따뜻한 날 대기질이 나쁩니다. 격한 운동을 줄이고 마스크 또는 활동 시간 조정을 검토하세요.');
  if (fl >= 38) t.push(`🥵 체감온도 ${Math.round(fl)}°C: 한낮 야외활동을 즉시 중단하세요. CDC 권고: 밝은색 헐렁한 옷·그늘·수분 섭취.`);
  else if (fl >= 33) t.push(`☀️ 체감온도 ${Math.round(fl)}°C: 수시로 물을 마시고 장시간 야외활동을 자제하세요. 통기성 밝은색 의류를 선택하세요.`);
  else if (fl >= 29) t.push(`🌡️ 체감온도 ${Math.round(fl)}°C: 통기성이 좋은 옷과 충분한 수분 섭취, 그늘 휴식이 필요합니다.`);
  if (hum >= 70 && temp >= 25) t.push(`💧 습도 ${Math.round(hum)}%·기온 ${Math.round(temp)}°C: 땀이 잘 마르는 기능성 소재와 여벌 상의를 추천합니다.`);
  if (zone === 'freezing') t.push(wind >= 5 ? '🥶 강풍+혹한: 바람이 노출 피부 열손실을 키웁니다. 목도리·모자·장갑으로 노출부를 완전히 덮어야 합니다. (기상청 한파 행동요령)' : '❄️ 노출 부위 보온이 중요합니다. 내복, 목도리, 모자, 장갑, 방한화를 준비하고 장시간 야외활동은 피하세요.');
  else if (zone === 'cold') t.push('❄️ 추운 날씨: 보온 이너와 겉옷을 겹쳐 입고, 바람이 세면 목도리·장갑·비니를 추가하세요.');
  if (wind >= 14) t.push(`💨 강풍주의보 수준 (풍속 ${wind.toFixed(0)}m/s): 우산 대신 방수 재킷을 착용하고 낙하물 위험 구역을 피하세요.`);
  else if (wind >= 5) t.push(`💨 바람 ${wind.toFixed(0)}m/s: 얇은 방풍 외피를 챙기고, 모자는 턱끈 또는 깊은 형태가 좋습니다.`);
  if (zone === 'mild' || zone === 'cool') t.push('🌡️ 아침·저녁 기온차가 있어요. 벗고 입기 쉬운 겉옷을 꼭 챙기세요.');
  if (mm >= 15) t.push('🌧️ 호우 주의: 등산·강변·야영 활동은 중단하고 안전한 곳으로 이동하세요. (기상청 호우 행동요령)');
  else if (mm >= 1) t.push('☂️ 비: 우산 또는 방수 재킷, 미끄럼 적은 신발을 준비하세요.');
  if (act === 'river') { t.push('🌊 강변: 강바람·수면 증발로 체감온도가 도심보다 2~3°C 낮습니다. 방풍 겉옷을 반드시 챙기세요.'); if (uv >= 3) t.push('☀️ 수면 반사로 강변 자외선이 도심보다 강합니다. 선크림과 모자를 챙기세요.'); }
  if (act === 'beach') t.push('🏖️ 해변 자외선은 수면 반사로 도심보다 30~50% 강합니다. SPF50+ 선크림을 2시간마다 덧발라주세요.', '👕 모래·바닷물로 의류 손상이 빠릅니다. 여벌 옷과 래시가드를 준비하세요.');
  if (act === 'hiking') { t.push('🏔️ 등산: 100m 오를수록 약 0.6°C 기온 저하. 정상부는 3~5°C 낮고 바람이 강합니다. 배낭에 여분 레이어를 챙기세요.'); if (mm > 0) t.push('⛈️ 비·번개 시 즉시 하산하고 계곡·능선·정상 접근을 금지합니다. (기상청 낙뢰 행동요령)'); }
  if (act === 'golf') t.push(zone === 'mild' || zone === 'cool' ? '⛳ 이른 아침 라운딩은 기온이 낮습니다. 윈드 베스트 등 보온 레이어를 준비하세요.' : '⛳ 골프장은 탁 트인 개방지라 자외선이 강합니다. UV 팔토시·모자를 챙기세요.', '⚡ 낙뢰 예상 시 골프채를 즉시 내려놓고 클럽하우스나 차량으로 대피하세요. (기상청 낙뢰 행동요령)');
  if ((act === 'running' || act === 'cycling') && (dust === '3' || dust === '4')) t.push('😷 미세먼지 높을 때 조깅·자전거는 호흡량을 크게 늘립니다. 실내 운동으로 전환하세요.');
  return t.slice(0, 6);
}
function recommendOutfit(s) {
  const danger = outDanger(s), {activity: act, gender, uvIndex: uv, windSpeed: wind, ptyCode: pty, precipitation: mm, dustGrade: dust} = s;
  const female = gender === 'female', fl = s.feelsLike + (OUT_MICRO[act] || 0), base = outZone(s.feelsLike), zone = outZone(fl);
  const seen = new Set(), items = [];
  const push = i => { const key = i.cat + i.name; if (!seen.has(key)) { seen.add(key); items.push(i); } };
  [...outBase(zone, female, act, fl, uv), ...outActivity(act, zone, female, uv), ...outMicro(act, base, female)].forEach(push);
  if (uv >= 6 && act !== 'beach') {
    push(it('긴팔 겉옷', '👕', 'top', uv >= 8, `UV ${uv} — 기상청 생활기상지수(높음 이상)`));
    if (zone !== 'hot') push(it('모자', '👒', 'acc', false, 'UV 6 이상'));
  }
  const windDone = (act === 'river' || act === 'hiking') && ['hot', 'warm', 'mild'].includes(base);
  if (wind >= 5 && !windDone && (zone === 'warm' || zone === 'mild')) push(it('얇은 바람막이', '💨', 'outer', false, '풍속 5m/s 이상'));
  if (zone === 'cold' && wind >= 5) { const c = '바람 강함 + 추운 구간'; push(it('목도리', '🧣', 'acc', false, c)); push(it('장갑', '🧤', 'acc', false, c)); push(it('비니 / 니트 모자', '🎓', 'acc', false, c)); }
  if (zone === 'freezing' && fl >= 0) { const c = '장시간 야외(2시간↑)'; push(it('방한화', '🥾', 'foot', false, c)); push(it('귀마개 / 이어워머', '🎓', 'acc', false, c)); }
  if (pty === '1' || pty === '4') {
    if (mm >= 10) push(it('우의', '🌂', 'rain', true, '강한 비(10mm/h↑)·낙뢰 위험 시 우산 사용 자제'));
    else { push(it('우산', '☂️', 'rain', true)); if (mm >= 7) push(it('우의', '🌂', 'rain', false, '보통 비 후반(7mm/h↑) — 우산만으론 부족할 때 선택')); }
    if (mm >= 7) push(it('방수 신발', '🥾', 'foot', false, '보통 비 후반(7mm/h↑) — 젖은 노면 안전'));
  } else if (pty === '2' || pty === '3') push(it('방수 신발', '🥾', 'foot', true));
  if (dust === '3' || dust === '4') push(it('보건용 마스크', '😷', 'mask', dust === '4', dust === '4' ? '미세먼지 매우나쁨 — KF94 필수 (에어코리아)' : '미세먼지 나쁨 — KF80 이상 권장 (에어코리아)'));
  if (uv >= 6 && act !== 'beach') push(it('선크림', '🧴', 'acc', uv >= 8, uv >= 8 ? 'UV 매우높음 — 외출 시 필수 (기상청 생활기상지수)' : 'UV 높음 — 외출 30분 전 도포 권장'));
  return {items, zone, label: OUT_LABEL[zone], tips: outTips(zone, s), note: OUT_NOTE[act], windAlert: wind >= 14, ...danger};
}
// 시간대 칩: 오늘 지금 구간부터 끝까지 + 내일
function outSlots(d) {
  const now = d.current.time, hour = +now.slice(11, 13), start = outPeriodAt(hour), next = d.daily.time[1];
  return [
    ...OUT_PERIODS.slice(start).map((p, i) => ({key: p[0], date: now.slice(0, 10), hour: p[3], name: p[1], icon: p[2], first: i === 0})),
    ...OUT_PERIODS.map(p => ({key: p[0] + '@1', date: next, hour: p[3], name: p[1], icon: p[2], tomorrow: true})),
  ];
}
function outSnapshot(d, cfg, slot) {
  const now = d.current.time, stamp = slot ? `${slot.date}T${String(slot.hour).padStart(2, '0')}:00` : now.slice(0, 13) + ':00';
  const i = Math.max(0, d.hourly.time.indexOf(stamp)), h = d.hourly, code = h.weather_code[i], hour = +stamp.slice(11, 13);
  const pty = (code >= 71 && code <= 77) || code === 85 || code === 86 ? '3' : [56, 57, 66, 67].includes(code) ? '2' : code >= 95 ? '4' : code >= 51 && code <= 82 ? '1' : '0';
  const sky = code === 0 ? '1' : code <= 2 ? '3' : '4', uv = Math.round(h.uv_index[i] ?? 0), night = hour < 7 || hour >= 19, pm = d.pm10?.[stamp];
  return {
    temperature: h.temperature_2m[i], feelsLike: h.apparent_temperature[i] + (OUT_SENSE[cfg.sensitivity] || OUT_SENSE.normal)[1],
    humidity: h.relative_humidity_2m[i], windSpeed: h.wind_speed_10m[i], uvIndex: uv, ptyCode: pty, skyCode: sky, precipitation: h.precipitation[i] ?? 0,
    dustGrade: pm == null ? '1' : pm <= 30 ? '1' : pm <= 80 ? '2' : pm <= 150 ? '3' : '4', hasDust: pm != null, activity: cfg.activity, gender: cfg.gender, isNight: night,
    showSunshine: !night && code <= 2 && uv >= 3, month: +stamp.slice(5, 7), label: slot ? `${slot.tomorrow ? '내일 ' : ''}${slot.name}` : '지금',
  };
}
function outSlot(zone, s, windAlert) {
  const hit = [];
  if (s.ptyCode === '3' || s.ptyCode === '2') hit.push('snow');
  if (s.ptyCode === '1' || s.ptyCode === '4') hit.push(s.precipitation >= 3 ? 'rain-heavy' : 'rain-light');
  if (s.showSunshine && (zone === 'hot' || zone === 'warm')) hit.push('sunny-uv');
  if (windAlert) hit.push('windy');
  if (hit[0] === 'rain-light' && zone !== 'freezing') return 'rain-light-' + zone;
  return hit[0] || {hot: 'hot', warm: 'warm-shirt', mild: 'mild', cool: 'cool-layered', cold: 'cold', freezing: 'freezing'}[zone];
}
// 캐릭터 뒤 날씨 그림 (참고 앱의 200×296 좌표)
const cloud = (d, fill, op) => `<path d="${d}" fill="${fill}" opacity="${op}"/>`;
const CL = ['M28 30C18 30 14 22 22 18C20 10 36 6 44 14C52 6 70 12 70 22C80 22 84 32 74 36L32 36C22 38 18 32 28 30Z', 'M118 36C110 36 106 28 112 24C110 16 124 12 132 20C140 12 156 18 156 26C166 26 168 36 158 40L122 40C114 42 110 38 118 36Z', 'M80 88C74 88 70 82 74 78C72 72 84 70 90 74C96 70 108 74 108 82C116 82 118 90 110 92L84 92C76 94 74 90 80 88Z'];
const drops = (list, dx, l, c, w, op) => list.map(([x, y]) => `<line x1="${x}" y1="${y}" x2="${x - dx}" y2="${y + l}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`).join('');
const moon = (cx, cy, r, op) => `<path d="M${cx + 2} ${cy - r}A${r} ${r} 0 1 1 ${cx - r} ${cy + 4}A${r * .85} ${r * .85} 0 1 0 ${cx + 2} ${cy - r}Z" fill="#E5E7EB" stroke="#64748B" stroke-width=".8" opacity="${op}"/>`;
const stars = list => list.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#94A3B8" opacity=".55"/>`).join('');
function outBg(s, windAlert) {
  const P = s.ptyCode, mode = P === '3' || P === '2' ? 'snow' : P === '1' || P === '4' ? (s.precipitation >= 3 ? 'heavy' : 'light') : windAlert ? 'wind' : s.showSunshine || s.skyCode === '1' ? (s.isNight ? 'clearN' : 'sun') : s.skyCode === '3' ? (s.isNight ? 'partN' : 'part') : 'cloud';
  const art = {
    light: cloud(CL[0], '#5B8DEE', .18) + drops([[40, 50], [62, 64], [88, 52], [110, 70], [134, 56], [156, 72], [180, 60], [50, 82], [96, 88], [144, 92]], 4, 10, '#5B8DEE', 2, .45),
    heavy: cloud(CL[0], '#3B6FD8', .26) + cloud(CL[1], '#3B6FD8', .2) + drops([[30, 56], [50, 72], [70, 60], [90, 80], [110, 64], [130, 84], [150, 70], [170, 90], [40, 100], [80, 108], [120, 104], [160, 112], [60, 128], [100, 132], [140, 134]], 5, 14, '#3B6FD8', 2.4, .55),
    snow: cloud(CL[0], '#94A3B8', .22) + [[36, 52, 3.2], [62, 70, 2.4], [88, 56, 3], [114, 74, 2.6], [140, 60, 3.2], [166, 76, 2.4], [50, 96, 2.8], [94, 102, 3], [138, 104, 2.6], [178, 100, 3], [28, 124, 2.4], [110, 130, 2.8], [156, 134, 2.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#94A3B8" stroke-width=".6" opacity=".7"/>`).join(''),
    sun: `<circle cx="156" cy="50" r="20" fill="#FCD34D" opacity=".55"/><circle cx="156" cy="50" r="14" fill="#F59E0B" opacity=".35"/>` + [[156, 18, 156, 26], [180, 30, 188, 22], [186, 50, 196, 50], [180, 70, 188, 78], [132, 30, 124, 22], [126, 50, 116, 50], [132, 70, 124, 78], [156, 82, 156, 90]].map(([a, b, c, e]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${e}" stroke="#F59E0B" stroke-width="2.2" stroke-linecap="round" opacity=".45"/>`).join(''),
    part: `<circle cx="42" cy="38" r="14" fill="#FCD34D" opacity=".45"/><circle cx="42" cy="38" r="9" fill="#F59E0B" opacity=".3"/>` + cloud(CL[1], '#94A3B8', .3) + cloud(CL[2], '#94A3B8', .22),
    clearN: moon(156, 50, 18, .8) + stars([[28, 32], [68, 22], [98, 36], [118, 20], [134, 60], [186, 22], [44, 70], [82, 78], [180, 78]]),
    partN: moon(44, 40, 14, .75) + cloud(CL[1], '#64748B', .32) + stars([[82, 22], [100, 60], [176, 60]]),
    cloud: cloud(CL[0], '#94A3B8', .35) + cloud(CL[1], '#94A3B8', .28) + cloud(CL[2], '#94A3B8', .22),
    wind: ['M12 70Q60 60 100 72T192 70', 'M12 102Q50 92 90 100T168 100', 'M24 138Q70 130 110 140T192 138', 'M12 178Q60 170 100 178T188 174'].map(d => `<path d="${d}" fill="none" stroke="#7EC8C8" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>`).join(''),
  }[mode];
  return `<svg viewBox="0 0 200 296" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art}</svg>`;
}
function outFigure(s, r, cfg) {
  const name = `${cfg.gender === 'female' ? 'female' : 'male'}-${outSlot(r.zone, s, r.windAlert)}-v1.webp`;
  return `<div class="ofig">${outBg(s, r.windAlert)}<img src="/outfit/${name}" alt="${cfg.gender === 'female' ? '여성' : '남성'} 복장 일러스트 — ${r.label}"></div>`;
}
let outfitPick = null;
W.outfit = {
  name: '외출복', icon: '🧥', about: '체감 날씨·활동·시간대에 맞는 옷차림을 그림과 함께 추천합니다',
  cfg: () => ({...WX_HOME, label: '서울', gender: 'male', activity: 'urban_walk', sensitivity: 'normal', ...(wdata.outfit || {})}),
  slot(d) { return outfitPick ? outSlots(d).find(x => x.key === outfitPick.key) : null; },
  chips(d) {
    const slots = outSlots(d), key = outfitPick?.key;
    let out = `<button type="button" data-k="" aria-pressed="${!key}">지금</button>`;
    slots.forEach(s => {
      if (s.first) return;
      if (s.tomorrow && s.key === 'dawn@1') out += '<span class="small muted">내일</span>';
      out += `<button type="button" data-k="${s.key}" aria-pressed="${s.key === key}">${s.icon} ${s.name}</button>`;
    });
    return `<div class="tabs ochips">${out}</div>`;
  },
  bindChips(root) {
    root.querySelector('.ochips').onclick = e => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      outfitPick = b.dataset.k ? {key: b.dataset.k, at: Date.now()} : null;
      this.draw();
      if ($('outPop')?.open) this.full();
    };
  },
  async draw(el = wbody('outfit')) {
    if (!el) return;
    const c = this.cfg();
    wtools('outfit', '<button class="icon" type="button" data-a="full" title="자세히" aria-label="자세히">⤢</button><button class="icon" type="button" data-a="set" title="설정" aria-label="설정">⚙</button>');
    document.querySelector('#w-outfit .tools').onclick = e => { if (e.target.dataset.a === 'full') this.full(); if (e.target.dataset.a === 'set') this.settings(); };
    try {
      const d = await wxGet(c), s = outSnapshot(d, c, this.slot(d)), r = recommendOutfit(s);
      const items = [...r.items].sort((a, b) => b.need - a.need);
      el.innerHTML = `${this.chips(d)}<div class="obody"><div class="oleft"><div class="small muted ohead"><span>${esc(c.label)}</span><span>${OUT_ACTS[c.activity][0]} ${OUT_ACTS[c.activity][1]}</span></div><div class="onow"><b>${Math.round(s.feelsLike)}°</b> 체감 · ${r.label}</div>${r.cancel ? '<div class="alert">⚠ 야외활동 주의 — 자세히에서 확인</div>' : ''}<ul class="olist">${items.map(i => `<li class="${i.need ? 'need' : ''}" title="${esc(i.cond || '')}"><span>${i.icon}</span><span class="on">${i.name}</span><span class="small">${i.tag || (i.need ? '필수' : '선택')}</span></li>`).join('')}</ul></div>${outFigure(s, r, c)}</div>`;
      this.bindChips(el);
    } catch { el.innerHTML = '<div class="none">날씨를 불러오지 못했습니다</div>'; }
  },
  async full() {
    const c = this.cfg(), box = wDialog('outPop', '외출복 추천'), d = await wxGet(c), s = outSnapshot(d, c, this.slot(d)), r = recommendOutfit(s);
    const groups = Object.entries(OUT_CATS).map(([cat, name]) => {
      const list = r.items.filter(i => i.cat === cat);
      return list.length ? `<h3 class="small muted">${name}</h3><div class="wchips">${list.map(i => `<span class="ochip${i.need ? ' need' : ''}" title="${esc(i.cond || '')}">${i.icon} ${i.name} <span class="small">${i.tag || (i.need ? '필수' : '선택')}</span></span>`).join('')}</div>` : '';
    }).join('');
    wpopBody(box).innerHTML = `${this.chips(d)}<div class="ogrid"><div><div class="ohead"><span><b>${esc(c.label)}</b><span class="sub">${OUT_ACTS[c.activity][0]} ${OUT_ACTS[c.activity][1]} · ${s.label}</span></span><span style="text-align:right"><b style="font-size:24px">${Math.round(s.feelsLike)}°</b><span class="sub">체감 · ${r.label}</span></span></div>${r.reasons.length ? `<div class="odanger${r.level === 'cancel' || r.level === 'warning' ? ' bad' : ''}" role="alert">${r.cancel ? '<b>⚠ 야외활동을 중단/연기하는 것이 안전합니다.</b>' : ''}${r.reasons.map(x => `<div class="small">${x}</div>`).join('')}</div>` : ''}${groups}${r.note ? `<div class="odanger small">${r.note}</div>` : ''}${r.tips.length ? `<h3 class="small muted">팁</h3><ul class="otips small">${r.tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}<div class="small muted">Open-Meteo 예보 기반${s.hasDust ? ' · 미세먼지 반영' : ' · 미세먼지 자료 없음'} · 오존 수치 미반영</div></div><div>${outFigure(s, r, c)}</div></div>`;
    this.bindChips(wpopBody(box));
    if (!box.open) box.showModal();
  },
  settings() {
    const c = this.cfg(), box = wDialog('outSet', '외출복 설정');
    const sel = (key, table, name) => `<label class="small">${name}<select data-c="${key}">${Object.entries(table).map(([k, v]) => `<option value="${k}"${c[key] === k ? ' selected' : ''}>${Array.isArray(v) && key === 'activity' ? v[0] + ' ' + v[1] : Array.isArray(v) ? v[0] : v}</option>`).join('')}</select></label>`;
    wpopBody(box).innerHTML = `<div class="small">지역: <b class="oplace">${esc(c.label)}</b></div><div class="oplaces"></div>${sel('gender', {male: '남성', female: '여성'}, '성별')}${sel('activity', OUT_ACTS, '활동')}${sel('sensitivity', OUT_SENSE, '더위·추위 민감도')}`;
    const keep = patch => { wsave('outfit', {...this.cfg(), ...patch}); this.draw(); };
    placeBox(wpopBody(box).querySelector('.oplaces'), p => { keep({label: p.name, lat: p.lat, lon: p.lon}); box.querySelector('.oplace').textContent = p.name; });
    wpopBody(box).onchange = e => { const key = e.target.dataset.c; if (key) keep({[key]: e.target.value}); };
    box.showModal();
  },
  tick(n) {
    if (outfitPick && Date.now() - outfitPick.at > 600000) { outfitPick = null; this.draw(); }
    else if (n % 600 === 0) this.draw();
  },
};
