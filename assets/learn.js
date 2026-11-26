/* 学习站：主题 + 本机进度 + 课程导学/小测/错题复习 + 游戏互链。 */
(function () {
  var KEY = 'crypto-learn-progress-v1';
  var COOKIE = 'crypto_learn_progress';
  var QUIZ_KEY = 'crypto-quiz-v1';
  var QUIZ_COOKIE = 'crypto_quiz_progress';
  var root = document.documentElement;
  var EN = (root.lang || '').toLowerCase().indexOf('en') === 0;
  var ASSETS = '/assets/';
  var META = {};
  var QDATA = null;
  var GDATA = null;
  var CAPDATA = null;

  function t(zh, en) { return EN ? en : zh; }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  }
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function path() { return location.pathname.replace(/index\.html$/, ''); }
  function isHome() { return path() === '/' || path() === '/en/'; }
  function isProgress() { return /\/progress\/?$/.test(path()); }
  function courseIdFromPath() {
    var m = path().match(/\/courses\/([^/]+)/);
    return m ? m[1] : '';
  }
  function lessonCourseId() {
    var box = $('[data-lesson-course]');
    return box ? box.getAttribute('data-course') || '' : '';
  }
  function playBase() {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? 'http://localhost:8791/' : 'https://play.poyi.net/';
  }
  function logEvent(name, data) {
    try {
      if (window.CryptoEvents && window.CryptoEvents.track) window.CryptoEvents.track(name, data || {});
      else {
        var q = window.__cryptoEventsQueue || (window.__cryptoEventsQueue = []);
        q.push([name, data || {}]);
      }
    } catch (e) {}
  }
  function getJSON(name) {
    try {
      return fetch(ASSETS + name, {cache: 'no-store'}).then(function (r) {
        return r.ok ? r.json() : null;
      }).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function themeInit() {
    try {
      var t0 = localStorage.getItem('crypto-theme');
      if (t0 === 'dark' || t0 === 'light') root.setAttribute('data-theme', t0);
    } catch (e) {}
    var btn = $('[data-theme-toggle]');
    if (btn) {
      if (EN) btn.setAttribute('aria-label', 'Toggle light and dark theme');
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('crypto-theme', next); } catch (e) {}
        var icon = btn.querySelector('[data-theme-icon]');
        if (icon) icon.textContent = next === 'dark' ? '☾' : '☀';
      });
    }
  }

  function readCookieName(name) {
    var hit = document.cookie.split(';').filter(function (x) { return x.trim().indexOf(name + '=') === 0; })[0];
    if (!hit) return {};
    try { return JSON.parse(decodeURIComponent(hit.split('=').slice(1).join('='))); } catch (e) { return {}; }
  }

  function readCookie() { return readCookieName(COOKIE); }

  function read() {
    var out = {};
    try { out = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
    var c = readCookie();
    for (var k in c) if (!out[k]) out[k] = c[k];
    return out;
  }

  function write(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    try {
      var cookie = COOKIE + '=' + encodeURIComponent(JSON.stringify(data)) + '; Path=/; Max-Age=31536000; SameSite=Lax';
      if (/(^|\.)poyi\.net$/.test(location.hostname)) cookie += '; Domain=.poyi.net';
      document.cookie = cookie;
    } catch (e) {}
  }

  function count(data, ids) {
    var n = 0;
    for (var i = 0; i < ids.length; i++) if (data[ids[i]]) n++;
    return n;
  }

  function paintCoursePanels(data) {
    var panels = $all('[data-course-progress]');
    for (var i = 0; i < panels.length; i++) {
      var panel = panels[i], total = +panel.getAttribute('data-total') || 0;
      var ids = [];
      var rows = $all('[data-lesson-id]');
      for (var j = 0; j < rows.length; j++) ids.push(rows[j].getAttribute('data-lesson-id'));
      var n = count(data, ids);
      var num = panel.querySelector('[data-progress-count]');
      var bar = panel.querySelector('[data-progress-bar]');
      if (num) num.textContent = n + ' / ' + total;
      if (bar) bar.style.width = (total ? Math.round(n / total * 100) : 0) + '%';
      for (var k = 0; k < rows.length; k++) {
        var done = !!data[rows[k].getAttribute('data-lesson-id')];
        rows[k].classList.toggle('is-done', done);
        var state = rows[k].querySelector('.lesson-state');
        if (state) {
          var level = (state.textContent.match(/L\d+/) || [''])[0];
          var doneText = done ? t('已读', 'Read') : t('未读', 'Unread');
          state.textContent = level ? level + ' · ' + doneText : doneText;
        }
      }
    }
  }

  function paintProgressCards(data) {
    var cards = $all('[data-progress-card]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i], total = +card.getAttribute('data-total') || 0;
      var ids = (card.getAttribute('data-lessons') || '').split(',').filter(Boolean);
      var n = count(data, ids);
      var countEl = card.querySelector('[data-progress-count]');
      if (countEl && ids.length) countEl.textContent = n + ' / ' + total;
    }
  }

  function markButtons(data) {
    var btns = $all('[data-mark]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        var id = btn.getAttribute('data-mark');
        function paint() {
          var done = !!data[id];
          btn.setAttribute('aria-pressed', done ? 'true' : 'false');
          var icon = btn.querySelector('[data-mark-icon]'), txt = btn.querySelector('[data-mark-text]');
          if (icon) icon.textContent = done ? '✓' : '○';
          if (txt) txt.textContent = done ? t('已读，取消标记', 'Read — undo') : t('标记已读', 'Mark as read');
        }
        paint();
        btn.addEventListener('click', function () {
          if (data[id]) delete data[id]; else data[id] = new Date().toISOString().slice(0, 10);
          write(data); paint();
          paintCoursePanels(data);
          var toast = document.getElementById('learn-toast');
          if (!toast) {
            toast = document.createElement('div');
            toast.id = 'learn-toast';
            toast.className = 'sr-progress';
            document.body.appendChild(toast);
          }
          toast.textContent = data[id] ? t('已标记，记录保存在本机', 'Marked; saved on this device') : t('已取消标记', 'Mark removed');
          toast.classList.add('show');
          clearTimeout(window.__learnToast);
          window.__learnToast = setTimeout(function () { toast.classList.remove('show'); }, 1800);
          var cid = btn.getAttribute('data-mark-course') || lessonCourseId() || courseIdFromPath();
          logEvent(data[id] ? 'lesson_read' : 'lesson_unread', {lesson: id, course: cid});
        });
      })(btns[i]);
    }
  }

  function paintLessonCourse(data) {
    var box = $('[data-lesson-course]');
    if (!box) return;
    var total = +box.getAttribute('data-total') || 0;
    var ids = (box.getAttribute('data-lessons') || '').split(',').filter(Boolean);
    var done = count(data, ids);
    var bar = box.querySelector('[data-lesson-course-bar]');
    if (bar && total) bar.style.width = Math.round(done / total * 100) + '%';
  }

  function renderSyllabus(cid) {
    var meta = META[cid];
    var head = $('.course-head');
    if (!meta || !head || $('.course-guide')) return;
    var outcomes = EN ? (meta.outcomes_en || []) : (meta.outcomes_zh || []);
    var sec = document.createElement('section');
    sec.className = 'course-guide';
    var out = outcomes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    sec.innerHTML =
      '<div class="guide-grid">' +
        '<div><p class="eyebrow">' + t('课程导学', 'COURSE GUIDE') + '</p>' +
        '<h2>' + t('学完能做什么', 'What you can do afterwards') + '</h2>' +
        '<ul class="guide-outcomes">' + out + '</ul></div>' +
        '<aside class="guide-card">' +
          '<p><strong>' + t('建议先修', 'Prerequisite') + '</strong><br>' + esc(EN ? meta.prereq_en : meta.prereq_zh) + '</p>' +
          '<p><strong>' + t('建议投入', 'Suggested time') + '</strong><br>' + esc(EN ? meta.time_en : meta.time_zh) + '</p>' +
          '<p><strong>' + t('结业项目', 'Capstone') + '</strong><br>' + esc(EN ? meta.project_en : meta.project_zh) + '</p>' +
        '</aside>' +
      '</div>';
    head.parentNode.insertBefore(sec, head.nextSibling);
  }

  function renderCapstones() {
    if (!isHome() || !CAPDATA || !CAPDATA.routes || $('.capstones')) return;
    var grid = $('.track-grid');
    if (!grid) return;
    var sec = document.createElement('section');
    sec.className = 'section capstones';
    var cards = CAPDATA.routes.map(function (r) {
      var m = (r.course || '').match(/courses\/([^/]+)/);
      var cid = m ? m[1] : '';
      var href = (EN ? '/en' : '') + '/courses/' + cid + '/';
      var steps = (EN ? r.steps_en : r.steps_zh) || [];
      var list = steps.slice(0, 3).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
      return '<article class="capstone-card"><p class="eyebrow">' + esc(t('结业项目', 'CAPSTONE')) + '</p>' +
        '<h3><a href="' + href + '">' + esc(EN ? r.title_en : r.title_zh) + '</a></h3>' +
        '<p>' + esc(EN ? r.desc_en : r.desc_zh) + '</p>' +
        '<p class="capstone-deliverable"><strong>' + t('交付物', 'Deliverable') + '</strong> ' + esc(EN ? r.deliverable_en : r.deliverable_zh) + '</p>' +
        '<ol>' + list + '</ol>' +
        '<div class="capstone-foot"><a class="quiet-link" href="' + href + '">' + t('进入路线 →', 'Open route →') + '</a>' +
        (r.game ? '<a class="quiet-link" href="' + playBase() + 'game/' + esc(r.game) + '/?from=learn&amp;course=' + esc(cid) + '">' + t('先玩一局 →', 'Try the game →') + '</a>' : '') +
        '</div></article>';
    }).join('');
    sec.innerHTML = '<div class="section-heading"><p class="eyebrow">' + t('五条路线', 'FIVE ROUTES') + '</p><h2>' +
      t('把一条路线走成一件作品', 'Turn one route into a piece of work') + '</h2><p>' +
      t('每门课有 3 题小测；每条路线有一个可交付的结业项目，不按“读完 912 页”计算。', 'Each course has a 3-question check; each route ends in a deliverable, not “read all 912 pages”.') +
      '</p></div><div class="capstone-grid">' + cards + '</div>';
    grid.parentNode.insertBefore(sec, grid.nextSibling);
  }

  function readQuiz() {
    var out = {};
    try { out = JSON.parse(localStorage.getItem(QUIZ_KEY) || '{}') || {}; } catch (e) {}
    var c = readCookieName(QUIZ_COOKIE);
    if (c && c.courses) {
      out.courses = out.courses || {};
      for (var k in c.courses) if (!out.courses[k]) out.courses[k] = c.courses[k];
      out.wrong = out.wrong || {};
      for (var w in (c.wrong || {})) if (!out.wrong[w]) out.wrong[w] = c.wrong[w];
    }
    out.courses = out.courses || {};
    out.wrong = out.wrong || {};
    return out;
  }

  function writeQuiz(data) {
    try { localStorage.setItem(QUIZ_KEY, JSON.stringify(data)); } catch (e) {}
    try {
      var summary = {courses: data.courses || {}, wrong: data.wrong || {}};
      var cookie = QUIZ_COOKIE + '=' + encodeURIComponent(JSON.stringify(summary)) + '; Path=/; Max-Age=31536000; SameSite=Lax';
      if (/(^|\.)poyi\.net$/.test(location.hostname)) cookie += '; Domain=.poyi.net';
      document.cookie = cookie;
    } catch (e) {}
  }

  function questionBlock(q) { return EN ? (q.en || q.zh) : (q.zh || q.en); }

  function renderQuiz(cid) {
    if (!cid || !QDATA || !QDATA.courses || !QDATA.courses[cid]) return;
    var list = $('.lesson-list');
    if (!list || $('.course-quiz')) return;
    var qs = QDATA.courses[cid].questions || [];
    if (!qs.length) return;
    var state = readQuiz();
    var prev = state.courses[cid];
    var sec = document.createElement('section');
    sec.className = 'course-quiz';
    sec.innerHTML =
      '<div class="quiz-head"><div><p class="eyebrow">' + t('课程小测', 'COURSE CHECK') + '</p>' +
      '<h2>' + t('3 题自检，不替代结业项目', 'Three questions — not a substitute for the capstone') + '</h2>' +
      '<p>' + t('答错会自动进入复习队列；小测结果保存在本机，并在 .poyi.net 下共享。', 'Wrong answers enter your review queue; results stay on this device and sync under .poyi.net.') + '</p></div>' +
      '<div class="quiz-status" data-quiz-status>' + (prev ? t('上次：', 'Last: ') + prev.score + ' / ' + prev.total : t('尚未作答', 'Not taken yet')) + '</div></div>' +
      '<div class="quiz-panel" data-quiz-panel><button class="button primary" type="button" data-quiz-start>' + t('开始 3 题小测', 'Start the 3-question check') + '</button></div>';
    list.parentNode.insertBefore(sec, list);
    var panel = sec.querySelector('[data-quiz-panel]');
    var status = sec.querySelector('[data-quiz-status]');
    var startBtn = sec.querySelector('[data-quiz-start]');

    startBtn.addEventListener('click', function () {
      panel.innerHTML = '<form class="quiz-form">' + qs.map(function (q, qi) {
        var b = questionBlock(q);
        return '<fieldset class="quiz-q" data-qid="' + esc(q.id) + '"><legend><span>' + (qi + 1) + '.</span> ' + esc(b.q) + '</legend>' +
          '<div class="quiz-options">' + (b.options || []).map(function (o, oi) {
            var id = 'q-' + esc(q.id) + '-' + oi;
            return '<label for="' + id + '"><input type="radio" id="' + id + '" name="' + esc(q.id) + '" value="' + oi + '"><span>' + esc(o) + '</span></label>';
          }).join('') + '</div><p class="quiz-why" hidden></p></fieldset>';
      }).join('') + '<div class="quiz-actions"><button class="button primary" type="submit">' + t('提交并看解析', 'Submit and see explanations') + '</button><span class="quiz-hint">' + t('答错会进入复习队列', 'Wrong answers go to review') + '</span></div></form>';

      var form = panel.querySelector('form');
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var score = 0, chosen = {};
        qs.forEach(function (q) {
          var b = questionBlock(q);
          var sel = form.querySelector('input[name="' + q.id + '"]:checked');
          var val = sel ? +sel.value : -1;
          chosen[q.id] = val;
          var field = form.querySelector('[data-qid="' + q.id + '"]');
          var why = field.querySelector('.quiz-why');
          var ok = val === b.answer;
          if (ok) score++;
          field.classList.toggle('is-correct', ok);
          field.classList.toggle('is-wrong', !ok);
          why.hidden = false;
          why.innerHTML = '<strong>' + (ok ? t('答对了。', 'Correct.') : t('正确答案：', 'Correct answer: ')) + '</strong>' +
            (ok ? '' : esc((b.options || [])[b.answer])) + ' ' + esc(b.why || '');
        });
        form.querySelectorAll('input').forEach(function (x) { x.disabled = true; });
        var actions = form.querySelector('.quiz-actions');
        if (actions) actions.innerHTML = '<strong>' + t('得分 ', 'Score ') + score + ' / ' + qs.length + '</strong><span class="quiz-hint">' + t('错题已加入复习队列', 'Wrong answers added to review') + '</span>';
        state.courses[cid] = {score: score, total: qs.length, at: Date.now()};
        qs.forEach(function (q) {
          var b = questionBlock(q);
          if (chosen[q.id] === b.answer) delete state.wrong[q.id];
          else state.wrong[q.id] = {course: cid, due: Date.now() + 86400000, stage: 0};
        });
        writeQuiz(state);
        status.textContent = t('上次：', 'Last: ') + score + ' / ' + qs.length;
        logEvent('quiz_completed', {course: cid, score: score, total: qs.length});
      });
    });
  }

  function findQuestion(qid) {
    if (!QDATA || !QDATA.courses) return null;
    for (var cid in QDATA.courses) {
      var qs = QDATA.courses[cid].questions || [];
      for (var i = 0; i < qs.length; i++) if (qs[i].id === qid) return {course: cid, q: qs[i]};
    }
    return null;
  }

  function renderReview() {
    if (!isProgress() || !QDATA || $('.review-panel')) return;
    var head = $('.course-head');
    if (!head) return;
    var state = readQuiz();
    var due = [];
    var now = Date.now();
    for (var qid in state.wrong) {
      var w = state.wrong[qid];
      if (!w || w.due > now) continue;
      var found = findQuestion(qid);
      if (found) due.push({id: qid, found: found, due: w.due});
    }
    due.sort(function (a, b) { return a.due - b.due; });
    var sec = document.createElement('section');
    sec.className = 'review-panel';
    var body = due.length ? due.slice(0, 12).map(function (it) {
      var b = questionBlock(it.found.q);
      var meta = META[it.found.course] || {};
      var cid = it.found.course;
      var href = (EN ? '/en' : '') + '/courses/' + cid + '/';
      return '<article class="review-item"><p class="review-course"><a href="' + href + '">' + esc(EN ? (meta.title_en || cid) : (meta.title_zh || cid)) + '</a></p>' +
        '<p class="review-q">' + esc(b.q) + '</p>' +
        '<details><summary>' + t('查看答案与解析', 'See answer and explanation') + '</summary><p><strong>' + esc((b.options || [])[b.answer]) + '</strong> — ' + esc(b.why || '') + '</p></details></article>';
    }).join('') : '<p class="review-empty">' + t('暂时没有到期的错题。完成课程小测后，答错的题会在这里出现。', 'No due review items. Wrong answers from course checks appear here.') + '</p>';
    sec.innerHTML = '<div class="section-heading"><p class="eyebrow">' + t('复习队列', 'REVIEW QUEUE') + '</p><h2>' +
      t('到期错题', 'Due for review') + '</h2><p>' + t('只列已经到期的题；答对后自动移出队列。', 'Only due items are listed; a correct answer removes it.') + '</p></div>' + body;
    head.parentNode.insertBefore(sec, head.nextSibling);
  }

  function renderCourseGames(cid) {
    if (!cid || !GDATA || !GDATA.courses || !GDATA.courses[cid] || $('.course-games')) return;
    var list = $('.lesson-list');
    if (!list) return;
    var games = GDATA.courses[cid] || [];
    if (!games.length) return;
    var sec = document.createElement('section');
    sec.className = 'course-games';
    sec.innerHTML = '<p class="eyebrow">' + t('练习', 'PRACTICE') + '</p><h2>' + t('用一局游戏检查理解', 'Check your understanding with a game') + '</h2>' +
      '<div class="game-chips">' + games.map(function (g) {
        return '<a class="game-chip" href="' + playBase() + 'game/' + esc(g.slug) + '/?from=learn&amp;course=' + esc(cid) + '"><span>' + esc(EN ? (g.title_en || g.title_zh) : (g.title_zh || g.title_en)) + '</span><b>▶</b></a>';
      }).join('') + '</div>';
    list.parentNode.insertBefore(sec, list);
  }

  var EN_MAP = {
    '学习站': 'Learn', '主站': 'Main site', '游戏站': 'Play', '知识站': 'Knowledge',
    '内容仓 ↗': 'Content repo ↗', '游戏仓 ↗': 'Games repo ↗',
    '进入课程 →': 'Open course →', '读这一课 →': 'Read lesson →', '继续 →': 'Continue →',
    '从第一课开始': 'Start with lesson one', '先去游戏里试试': 'Try a game first',
    '五条路线，先选一条走': 'Five routes — choose one and walk it',
    '二十四门技术域课程': 'Twenty-four domain courses',
    '先读四条，再决定走哪条路': 'Read four entries, then choose a route',
    '五条路线': 'Five routes',
    '不是另一套百科，': 'Not another encyclopedia,',
    '一条能走完的路': 'a path you can finish',
    '课程导学': 'Course guide', '课程小测': 'Course check',
    '学习记录': 'Learning record', '课程进度': 'Course progress',
    '已读课时 · 本机记录': 'Read lessons · saved locally',
    '课程坐标': 'Course map', '前置与关联': 'Prerequisites & links', '换一种方式': 'Other ways',
    '主站完整条目': 'Full entry on main site', '相关游戏': 'Related game', '回到课程': 'Back to course',
    '这一课要解决什么': 'What this lesson solves',
    '为什么值得读': 'Why it matters',
    '边界与攻击面': 'Boundaries & attack surface',
    '这是导读，不是全文。完整定义、来源、计算与图表在主站条目页。': 'This is a guide, not the full article. Definitions, sources, calculations and diagrams live on the main site.',
    '去主站读全文 ↗': 'Read the full entry on the main site ↗',
    '玩相关游戏 →': 'Play the related game →',
    '标记已读': 'Mark as read', '已读，取消标记': 'Read — undo', '未读': 'Unread',
    '已读': 'Read',
    '上一课': 'Previous lesson', '下一课': 'Next lesson',
    '无显式前置；可以直接从这一课开始。': 'No explicit prerequisite; you can start here.',
    '知识课时': 'Knowledge lessons', '技术域课程': 'Domain courses', '宏观路线': 'Tracks',
    '从术语到后量子，': 'From terminology to post-quantum,',
    '按路线走，': 'follow a route,',
    '不是按目录翻。': 'not a catalogue.',
    '继续学习': 'Continue learning', '开始学习': 'Start learning', '查看全部课程': 'Browse all courses',
    '内容 CC BY 4.0 · 代码 MIT': 'Content CC BY 4.0 · Code MIT',
    '从古典到后量子，路线不是目录，而是依赖顺序。每条路线下是具体技术域课程。': 'From classical to post-quantum, routes are dependencies, not a catalogue. Each route contains concrete domain courses.',
    '每门课按层级从低到高排列；跨域条目只落在它的第一技术域，避免重复计数。': 'Each course orders lessons from low to high level; cross-domain entries stay in their first domain to avoid double counting.',
    '基础与古典': 'Foundations & Classical', '机器、密钥与流': 'Machines, Keys & Streams', '现代密码': 'Modern Cryptography',
    '应用、历史与理论': 'Applications, History & Theory', '量子与后量子': 'Quantum & Post-Quantum'
  };

  var TRACK_EN = {
    foundations: {title: 'Foundations & Classical', desc: 'Start with terms, alphabets and hand ciphers: separate plaintext, ciphertext, algorithm and key.'},
    machines: {title: 'Machines, Keys & Streams', desc: 'Rotors, telegraph, one-time pads and key management: where security comes from when rules become machines and processes.'},
    modern: {title: 'Modern Cryptography', desc: 'Blocks, hashes, authentication, public keys, signatures, protocols and zero knowledge: the trunk and its dependencies.'},
    security: {title: 'Applications, History & Theory', desc: 'Put cryptography into real systems: side channels, steganography, Chinese standards, engineering security and theoretical limits.'},
    quantum: {title: 'Quantum & Post-Quantum', desc: 'Quantum key distribution, quantum threats and post-quantum migration: what the next generation must answer.'}
  };

  function setText(el, txt) { if (el) el.textContent = txt; }
  function replaceLeafText(rootEl, map) {
    $all('*', rootEl).forEach(function (el) {
      if (el.children.length) return;
      var s = (el.textContent || '').trim();
      if (map[s]) el.textContent = map[s];
    });
  }
  function translateMetaNumbers(rootEl) {
    $all('.track-meta span', rootEl).forEach(function (el) {
      var s = el.textContent || '';
      s = s.replace(/(\d+)\s*课时/, '$1 lessons').replace(/(\d+)\s*门课/, '$1 courses');
      el.textContent = s;
    });
  }

  function localizeEnglish() {
    if (!EN) return;
    for (var mc in META) {
      if (META[mc].title_zh && META[mc].title_en) EN_MAP[META[mc].title_zh] = META[mc].title_en;
      if (META[mc].track_zh && META[mc].track_en) EN_MAP[META[mc].track_zh] = META[mc].track_en;
    }
    document.title = document.title.replace('密码学探索馆', 'Cryptography Atlas').replace('学习站', 'Learn');
    var md = $('meta[name="description"]');
    if (md) {
      if (isHome()) md.setAttribute('content', 'Five routes, 24 courses and 912 lessons: a learning path starting from canonical entries on the main site.');
      else if (isProgress()) md.setAttribute('content', 'Your local learning record and due review queue.');
      else {
        var cid0 = courseIdFromPath();
        if (cid0 && META[cid0]) md.setAttribute('content', META[cid0].desc_en || md.getAttribute('content'));
      }
    }
    setText($('.skip-link'), 'Skip to content');
    $all('.brand-words strong, footer .brand strong').forEach(function (el) { el.textContent = 'Cryptography Atlas'; });
    $all('nav[aria-label], .desktop-nav, .bottom-nav').forEach(function (el) {
      if (el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Main navigation');
    });
    $all('.language-button').forEach(function (el) { el.setAttribute('aria-label', 'Switch to Chinese'); });
    $all('.language-button span').forEach(function (el) { el.textContent = 'ZH'; });
    replaceLeafText(document.body, EN_MAP);
    translateMetaNumbers(document.body);

    var heroEyebrow = $('.learn-hero .hero-eyebrow');
    if (heroEyebrow) heroEyebrow.textContent = 'LEARN · LEARNING SITE';
    var hero = $('.learn-hero h1');
    if (hero) {
      hero.innerHTML = hero.innerHTML
        .replace('不是另一套百科，', 'Not another encyclopedia,')
        .replace('而是', 'but ')
        .replace('一条能走完的路', 'a path you can finish');
    }
    var note = $('.learn-note');
    if (note) note.innerHTML = 'Course pages give only the guide, goals and boundaries. Full definitions, sources and calculations live on the main site. Records stay on this device and sync across the three sites with a <code>.poyi.net</code> cookie.';
    $all('.hero-actions a').forEach(function (a) {
      var s = a.textContent || '';
      if (s.indexOf('从第一课开始') >= 0) a.textContent = 'Start with lesson one →';
      else if (s.indexOf('先去游戏里试试') >= 0) a.textContent = 'Try a game first ↗';
    });

    $all('a.course-card[href*="/courses/"]').forEach(function (card) {
      var m = (card.getAttribute('href') || '').match(/courses\/([^/]+)/);
      var cid = m ? m[1] : '';
      var meta = META[cid];
      if (!meta) return;
      var h3 = card.querySelector('h3'); if (h3) h3.textContent = meta.title_en || h3.textContent;
      var p = card.querySelector('p:not(.course-en)'); if (p) p.textContent = meta.desc_en || p.textContent;
      var foot = card.querySelector('.course-foot span'); if (foot) foot.textContent = meta.track_en || foot.textContent;
      var strong = card.querySelector('.course-foot strong'); if (strong) strong.textContent = 'Open course →';
      var en = card.querySelector('.course-en'); if (en) en.style.display = 'none';
    });
    $all('a.course-card[href*="/lessons/"]').forEach(function (card) {
      var code = card.querySelector('.course-code');
      var m = code ? (code.textContent || '').match(/d\d{2}/) : null;
      var meta = m ? META[m[0]] : null;
      if (!meta) return;
      var en = card.querySelector('.course-en'); if (en) en.style.display = 'none';
      var foot = card.querySelector('.course-foot span'); if (foot) foot.textContent = meta.title_en;
      var strong = card.querySelector('.course-foot strong'); if (strong) strong.textContent = 'Read lesson →';
    });
    $all('.course-card[data-progress-card]').forEach(function (card) {
      var cid = card.getAttribute('data-course') || '';
      var meta = META[cid];
      if (!meta) return;
      var h3 = card.querySelector('h3'); if (h3) h3.textContent = meta.title_en || h3.textContent;
      var p = card.querySelector('p'); if (p) p.textContent = meta.desc_en || p.textContent;
      var a = card.querySelector('.course-foot a'); if (a) a.textContent = 'Continue →';
    });
    $all('.track-card[href*="/courses/"]').forEach(function (card) {
      var m = (card.getAttribute('href') || '').match(/courses\/([^/]+)/);
      var cid = m ? m[1] : '';
      var meta = META[cid];
      if (!meta) return;
      var info = TRACK_EN[meta.track_key || ''];
      var h3 = card.querySelector('h3'); if (h3) h3.textContent = meta.track_en || h3.textContent;
      var p = card.querySelector('p'); if (p && info) p.textContent = info.desc;
    });

    var head = $('.course-head');
    var cid = courseIdFromPath();
    if (head && cid && META[cid]) {
      var meta = META[cid];
      var e = head.querySelector('.eyebrow'); if (e) e.textContent = cid.slice(0, 3) + ' · ' + meta.track_en;
      var desc = head.querySelector('p:not(.eyebrow):not(.course-en)'); if (desc) desc.textContent = meta.desc_en || desc.textContent;
      var ce = head.querySelector('.course-en'); if (ce) ce.style.display = 'none';
      var panel = head.querySelector('.course-progress-panel');
      if (panel) {
        replaceLeafText(panel, EN_MAP);
        var pp = panel.querySelector('p'); if (pp) pp.textContent = 'Open a lesson for the guide; mark it read on the lesson page. Progress will later unlock content on Play.';
      }
    }

    var lcid = lessonCourseId();
    if (lcid && META[lcid]) {
      var lm = META[lcid];
      var lessonEyebrow = $('.lesson-main .eyebrow'); if (lessonEyebrow) lessonEyebrow.textContent = lcid.slice(0, 3) + ' · ' + lm.track_en;
      var metaBox = $('.lesson-meta');
      if (metaBox) {
        var spans = metaBox.querySelectorAll('span');
        if (spans.length) spans[spans.length - 1].textContent = lm.title_en;
      }
      var goalH = $('.lesson-goal h2'); if (goalH) goalH.textContent = 'What this lesson solves';
      $all('.lesson-body h2').forEach(function (h) {
        if (h.textContent.indexOf('为什么') >= 0) h.textContent = 'Why it matters';
        else if (h.textContent.indexOf('边界') >= 0) h.textContent = 'Boundaries & attack surface';
      });
      var small = $('.lesson-body p.small'); if (small) small.textContent = 'This is a guide, not the full article. Definitions, sources, calculations and diagrams live on the main site.';
      $all('.lesson-actions a, .lesson-actions button').forEach(function (a) {
        if (a.tagName === 'BUTTON') return;
        var s = a.textContent || '';
        if (s.indexOf('去主站') >= 0) a.textContent = 'Read the full entry on the main site ↗';
        else if (s.indexOf('玩相关') >= 0) a.textContent = 'Play the related game →';
      });
      $all('.lesson-pager span').forEach(function (s) {
        if (s.textContent.indexOf('上一课') >= 0) s.textContent = '← Previous lesson';
        else if (s.textContent.indexOf('下一课') >= 0) s.textContent = 'Next lesson →';
      });
      $all('.side-card h3').forEach(function (h) {
        if (h.textContent.indexOf('课程坐标') >= 0) h.textContent = 'Course map';
        else if (h.textContent.indexOf('前置') >= 0) h.textContent = 'Prerequisites & links';
        else if (h.textContent.indexOf('换一种') >= 0) h.textContent = 'Other ways';
      });
      $all('.side-card p, .side-card li').forEach(function (p) {
        if (/\bd\d{2} · 第/.test(p.textContent || '')) {
          var idx = (p.textContent.match(/第\s*(\d+)/) || ['', ''])[1];
          var total = (p.textContent.match(/\/\s*(\d+)/) || ['', ''])[1];
          p.textContent = lcid.slice(0, 3) + ' · Lesson ' + idx + ' of ' + total;
        }
        if ((p.textContent || '').indexOf('无显式前置') >= 0) p.textContent = 'No explicit prerequisite; you can start here.';
      });
      $all('.side-link span').forEach(function (s) {
        if (s.textContent === '主站完整条目') s.textContent = 'Full entry on main site';
        else if (s.textContent === '相关游戏') s.textContent = 'Related game';
        else if (s.textContent === '回到课程') s.textContent = 'Back to course';
      });
    }

    $all('.breadcrumbs a, .breadcrumbs span').forEach(function (el) {
      var s = (el.textContent || '').trim();
      if (EN_MAP[s]) el.textContent = EN_MAP[s];
      if (s.indexOf('基础与古典') >= 0) el.textContent = 'Foundations & Classical';
      else if (s.indexOf('机器、密钥与流') >= 0) el.textContent = 'Machines, Keys & Streams';
      else if (s.indexOf('现代密码') >= 0) el.textContent = 'Modern Cryptography';
      else if (s.indexOf('应用、历史与理论') >= 0) el.textContent = 'Applications, History & Theory';
      else if (s.indexOf('量子与后量子') >= 0) el.textContent = 'Quantum & Post-Quantum';
    });
    if (cid && META[cid]) {
      var crumb = $('.breadcrumbs span:last-child');
      if (crumb && /[\u4e00-\u9fff]/.test(crumb.textContent || '')) crumb.textContent = META[cid].title_en || crumb.textContent;
    }
    if (isProgress()) {
      var ph = $('.course-head h1'); if (ph) ph.textContent = 'Learning record';
      var pp2 = $('.course-head p:not(.eyebrow)'); if (pp2) pp2.textContent = 'All marks stay on this device; under *.poyi.net a same-site cookie lets the main site, Learn and Play read the same record.';
      $all('a.course-card .course-foot a').forEach(function (a) { a.textContent = 'Continue →'; });
    }

    var footer = $('.site-footer');
    if (footer) {
      var fs = footer.querySelector('.brand small'); if (fs) fs.textContent = 'Knowledge is the text · Learning is the route · Play is practice';
      var fn = footer.querySelector('.footer-note');
      if (fn) fn.innerHTML = 'One site, three ways in: look it up in Knowledge, walk it in Learn, practise it in Play. <span aria-hidden="true">✦</span>';
    }
  }

  function annotateCourseMeta() {
    var trackMap = {
      'd01-foundations': 'foundations', 'd02-monoalphabetic': 'foundations', 'd03-polyalphabetic': 'foundations',
      'd04-transposition': 'foundations', 'd07-cryptanalysis': 'foundations',
      'd05-rotor-mechanical': 'machines', 'd06-otp-stream': 'machines', 'd13-key-management': 'machines', 'd19-randomness': 'machines',
      'd08-block-ciphers': 'modern', 'd09-hashes': 'modern', 'd10-auth-aead': 'modern', 'd11-asymmetric': 'modern',
      'd12-signatures': 'modern', 'd14-protocols-pki': 'modern', 'd15-zkp': 'modern', 'd16-secret-sharing-mpc': 'modern',
      'd17-side-channel': 'security', 'd18-steganography': 'security', 'd20-china-sm': 'security', 'd23-applied-security': 'security', 'd24-theory': 'security',
      'd21-quantum-crypto': 'quantum', 'd22-post-quantum': 'quantum'
    };
    for (var cid in META) if (trackMap[cid]) META[cid].track_key = trackMap[cid];
  }

  themeInit();
  var data = read();
  paintCoursePanels(data);
  paintProgressCards(data);
  markButtons(data);
  paintLessonCourse(data);
  localizeEnglish();

  ready(function () {
    Promise.all([getJSON('course-meta.json'), getJSON('quiz-data.json'), getJSON('capstones.json'), getJSON('course-games.json')]).then(function (res) {
      META = (res[0] && res[0].courses) || {};
      QDATA = res[1] || null;
      CAPDATA = res[2] || null;
      GDATA = res[3] || null;
      annotateCourseMeta();
      localizeEnglish();
      var cid = courseIdFromPath();
      renderSyllabus(cid);
      renderCapstones();
      renderQuiz(cid);
      renderCourseGames(cid);
      renderReview();
      localizeEnglish();
    }).catch(function () {});
  });
})();
