'use strict';
(() => {
  // ================= utilities =================
  const $ = (s) => document.querySelector(s);
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* blocked or full */ } },
  };
  const abortErr = () => new DOMException('Aborted', 'AbortError');
  const sleep = (ms, signal) => new Promise((res, rej) => {
    if (signal?.aborted) return rej(abortErr());
    const on = () => { clearTimeout(t); rej(abortErr()); };
    const t = setTimeout(() => { signal?.removeEventListener('abort', on); res(); }, ms);
    signal?.addEventListener('abort', on, { once: true });
  });
  const NEVER = new AbortController().signal;
  const pad2 = (n) => String(n).padStart(2, '0');
  const lc = (s) => String(s).toLowerCase();
  const num = (n) => n.toLocaleString('en-US');
  const byteLen = (s) => new TextEncoder().encode(s).length;
  const cmpName = (a, b) => lc(a).localeCompare(lc(b));
  const flat = (x) => (Array.isArray(x) ? x.map((s) => s[0]).join('') : String(x));
  const usDate = (d) => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
  const hm24 = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const hm12 = (d) => `${pad2(d.getHours() % 12 || 12)}:${pad2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  const fmtDur = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m ${s % 60}s`; };

  // ================= color schemes =================
  const CAMPBELL = ['#0C0C0C', '#C50F1F', '#13A10E', '#C19C00', '#0037DA', '#881798', '#3A96DD', '#CCCCCC', '#767676', '#E74856', '#16C60C', '#F9F1A5', '#3B78FF', '#B4009E', '#61D6D6', '#F2F2F2'];
  const SCHEMES = {
    'Campbell': { bg: '#0C0C0C', fg: '#CCCCCC', c: CAMPBELL },
    'Campbell Powershell': { bg: '#012456', fg: '#CCCCCC', c: CAMPBELL },
    'One Half Dark': { bg: '#282C34', fg: '#DCDFE4', c: ['#282C34', '#E06C75', '#98C379', '#E5C07B', '#61AFEF', '#C678DD', '#56B6C2', '#DCDFE4', '#5A6374', '#E06C75', '#98C379', '#E5C07B', '#61AFEF', '#C678DD', '#56B6C2', '#DCDFE4'] },
    'Solarized Dark': { bg: '#002B36', fg: '#839496', c: ['#002B36', '#DC322F', '#859900', '#B58900', '#268BD2', '#D33682', '#2AA198', '#EEE8D5', '#586E75', '#CB4B16', '#859900', '#B58900', '#839496', '#6C71C4', '#93A1A1', '#FDF6E3'] },
    'Tango Dark': { bg: '#000000', fg: '#D3D7CF', c: ['#000000', '#CC0000', '#4E9A06', '#C4A000', '#3465A4', '#75507B', '#06989A', '#D3D7CF', '#555753', '#EF2929', '#8AE234', '#FCE94F', '#729FCF', '#AD7FA8', '#34E2E2', '#EEEEEC'] },
    'Vintage': { bg: '#000000', fg: '#C0C0C0', c: ['#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#C0C0C0', '#808080', '#FF0000', '#00FF00', '#FFFF00', '#0000FF', '#FF00FF', '#00FFFF', '#FFFFFF'] },
  };
  // Windows console color index -> ANSI palette index
  const CON = [0, 4, 2, 6, 1, 5, 3, 7, 8, 12, 10, 14, 9, 13, 11, 15];
  const CON_NAMES = ['Black', 'DarkBlue', 'DarkGreen', 'DarkCyan', 'DarkRed', 'DarkMagenta', 'DarkYellow', 'Gray', 'DarkGray', 'Blue', 'Green', 'Cyan', 'Red', 'Magenta', 'Yellow', 'White'];
  const ERR = 'k12', WARN = 'k14', DIR = 'k9 b', ACC = 'k11', DIM = 'k8', GOOD = 'k10';

  const ICONS = {
    pwsh: '<svg viewBox="0 0 16 16"><rect x=".5" y="1.5" width="15" height="13" rx="2.5" fill="#2f6fd0"/><path d="M4.2 5l3.3 3-3.3 3" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.6 11h3.4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>',
    cmd: '<svg viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="12" rx="2" fill="#111" stroke="#8a8a8a"/><path d="M4.2 5.2l3 2.8-3 2.8" fill="none" stroke="#d6d6d6" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.6 11h3.2" stroke="#d6d6d6" stroke-width="1.4" stroke-linecap="round"/></svg>',
  };

  // ================= settings =================
  const settings = Object.assign({ scheme: 'Campbell', fontSize: 13, profile: 'pwsh', keys: true }, store.get('wt.settings', {}));
  if (!SCHEMES[settings.scheme]) settings.scheme = 'Campbell';
  const saveSettings = () => store.set('wt.settings', settings);

  // ================= virtual file system =================
  const HOME = ['Users', 'user'];
  const mkdir = (c = {}) => ({ t: 'd', c, m: Date.now() });
  const mkfile = (s = '') => ({ t: 'f', s, m: Date.now() });
  const defaultFS = () => mkdir({
    'Program Files': mkdir({ PowerShell: mkdir({ 7: mkdir({ 'pwsh.exe': mkfile('MZ') }) }) }),
    'Program Files (x86)': mkdir(),
    Users: mkdir({
      Public: mkdir(),
      user: mkdir({
        Desktop: mkdir({
          'readme.txt': mkfile('Welcome to WinTerm for iPhone.\nType "help" to list commands.\nFiles you create are saved on this device.\n'),
          'hello.bat': mkfile('@echo off\necho Hello from a batch file!\necho Today is %DATE%\n'),
        }),
        Documents: mkdir({ 'notes.txt': mkfile('Things to try:\n- winfetch\n- ping github.com\n- dir | findstr txt\n- echo hi > test.txt\n- notepad test.txt\n- theme "One Half Dark"\n') }),
        Downloads: mkdir(),
        Pictures: mkdir(),
      }),
    }),
    Windows: mkdir({
      System32: mkdir({ drivers: mkdir({ etc: mkdir({ hosts: mkfile('127.0.0.1       localhost\n::1             localhost\n') }) }) }),
      Temp: mkdir(),
    }),
  });
  let root = store.get('wt.fs', null);
  if (!root || root.t !== 'd') root = defaultFS();
  let saveTimer = 0;
  const flushFS = () => { clearTimeout(saveTimer); saveTimer = 0; store.set('wt.fs', root); };
  const saveFS = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flushFS, 250); };

  class ShellErr extends Error { constructor(ps, cmd) { super(ps); this.cmdMsg = cmd ?? ps; } }

  const fmt = (segs) => 'C:\\' + segs.join('\\');
  const child = (node, name) => {
    if (!node || node.t !== 'd') return null;
    const k = Object.keys(node.c).find((x) => lc(x) === lc(name));
    return k === undefined ? null : [k, node.c[k]];
  };
  const getNode = (segs) => { let n = root; for (const s of segs) { const c = child(n, s); if (!c) return null; n = c[1]; } return n; };
  function resolve(cwd, p) {
    p = String(p ?? '').trim().replace(/\//g, '\\');
    if (p === '' || p === '.') return [...cwd];
    let segs;
    if (/^~(\\|$)/.test(p)) { segs = [...HOME]; p = p.slice(1); }
    else if (/^[a-z]:/i.test(p)) {
      if (lc(p[0]) !== 'c') throw new ShellErr(`Cannot find drive. A drive with the name '${p[0].toUpperCase()}' does not exist.`, 'The system cannot find the drive specified.');
      segs = /^c:\\/i.test(p) ? [] : [...cwd]; p = p.slice(2);
    } else if (p.startsWith('\\')) segs = [];
    else segs = [...cwd];
    for (const s of p.split('\\')) {
      if (!s || s === '.') continue;
      if (s === '..') { segs.pop(); continue; }
      const c = child(getNode(segs), s);
      segs.push(c ? c[0] : s);
    }
    return segs;
  }
  const isPrefix = (a, b) => a.length <= b.length && a.every((s, i) => lc(s) === lc(b[i]));
  const fullPath = (tab, p) => { try { return fmt(resolve(tab.cwd, p)); } catch { return p; } };
  const notFound = (tab, p) => new ShellErr(`Cannot find path '${fullPath(tab, p)}' because it does not exist.`, 'The system cannot find the path specified.');
  const syntax = (ps) => new ShellErr(ps || 'A positional parameter cannot be found that accepts the argument.', 'The syntax of the command is incorrect.');
  const sortItems = ([a, x], [b, y]) => (x.t === y.t ? cmpName(a, b) : x.t === 'd' ? -1 : 1);

  function glob(cwd, p) {
    p = String(p).replace(/\//g, '\\');
    const i = p.lastIndexOf('\\');
    let last = p.slice(i + 1);
    if (!/[*?]/.test(last)) { const segs = resolve(cwd, p); const node = getNode(segs); return node ? [{ segs, node }] : []; }
    const ps = resolve(cwd, i < 0 ? '.' : p.slice(0, i + 1));
    const pn = getNode(ps);
    if (!pn || pn.t !== 'd') return [];
    if (last === '*.*') last = '*';
    const re = new RegExp('^' + last.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return Object.keys(pn.c).filter((k) => re.test(k)).sort(cmpName).map((k) => ({ segs: [...ps, k], node: pn.c[k] }));
  }
  function mkdirp(segs) {
    let n = root;
    for (const s of segs) {
      const c = child(n, s);
      if (!c) { n.c[s] = mkdir(); n.m = Date.now(); n = n.c[s]; }
      else if (c[1].t !== 'd') throw new ShellErr(`An item with the specified name ${fmt(segs)} already exists.`, 'The system cannot find the path specified.');
      else n = c[1];
    }
    saveFS();
    return n;
  }
  function writeFile(tab, p, text, append) {
    const segs = resolve(tab.cwd, p);
    if (!segs.length) throw new ShellErr(`Access to the path '${fmt(segs)}' is denied.`, 'Access is denied.');
    const parent = getNode(segs.slice(0, -1));
    if (!parent || parent.t !== 'd') throw new ShellErr(`Could not find a part of the path '${fmt(segs)}'.`, 'The system cannot find the path specified.');
    const ex = child(parent, segs.at(-1));
    if (ex && ex[1].t === 'd') throw new ShellErr(`Access to the path '${fmt(segs)}' is denied.`, 'Access is denied.');
    if (ex) { ex[1].s = append ? ex[1].s + text : text; ex[1].m = Date.now(); }
    else parent.c[segs.at(-1)] = mkfile(text);
    parent.m = Date.now();
    saveFS();
  }
  const clone = (n) => (n.t === 'f' ? mkfile(n.s) : mkdir(Object.fromEntries(Object.entries(n.c).map(([k, v]) => [k, clone(v)]))));
  const inUse = (segs) => tabs.some((t) => isPrefix(segs, t.cwd));
  const inUseErr = (segs) => new ShellErr(`Cannot remove item ${fmt(segs)}: The process cannot access the file because it is being used by another process.`, 'The process cannot access the file because it is being used by another process.');

  // ================= environment & expansion =================
  const env = {
    USERNAME: 'user', USERDOMAIN: 'IPHONE-14', COMPUTERNAME: 'IPHONE-14', USERPROFILE: 'C:\\Users\\user',
    HOMEDRIVE: 'C:', HOMEPATH: '\\Users\\user', OS: 'Windows_NT', PROCESSOR_ARCHITECTURE: 'ARM64',
    NUMBER_OF_PROCESSORS: String(navigator.hardwareConcurrency || 6), SYSTEMDRIVE: 'C:', SYSTEMROOT: 'C:\\Windows',
    WINDIR: 'C:\\Windows', TEMP: 'C:\\Windows\\Temp', TMP: 'C:\\Windows\\Temp', COMSPEC: 'C:\\Windows\\system32\\cmd.exe',
    PATH: 'C:\\Windows\\system32;C:\\Windows;C:\\Program Files\\PowerShell\\7', PATHEXT: '.COM;.EXE;.BAT;.CMD;.PS1', PROMPT: '$P$G',
  };
  function envGet(tab, k) {
    const d = new Date();
    switch (k.toUpperCase()) {
      case 'CD': return fmt(tab.cwd);
      case 'DATE': return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${usDate(d)}`;
      case 'TIME': return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad2(Math.floor(d.getMilliseconds() / 10))}`;
      case 'RANDOM': return String(Math.floor(Math.random() * 32768));
      case 'ERRORLEVEL': return tab.ok ? '0' : '1';
      default: return env[k.toUpperCase()];
    }
  }
  const PS_AUTO = { home: () => env.USERPROFILE, pwd: (t) => fmt(t.cwd), true: () => 'True', false: () => 'False', null: () => '', pid: () => '4242' };
  function expand(tab, s) {
    if (!tab.ps) return s.replace(/%(\w+)%/g, (m, k) => envGet(tab, k) ?? m);
    return s.replace(/\$env:(\w+)|\$(\w+)/gi, (_, e, k) => {
      if (e) return envGet(tab, e) ?? '';
      const n = lc(k);
      if (n in tab.vars) return String(tab.vars[n]);
      return PS_AUTO[n] ? PS_AUTO[n](tab) : '';
    });
  }

  // ================= parsing =================
  function tokenize(src, tab) {
    const ps = tab.ps, toks = [];
    const isSep = (j) => /\s/.test(src[j]) || src[j] === '|' || src[j] === '>' || src[j] === '&' || (ps && src[j] === ';');
    const isQ = (ch) => ch === '"' || (ps && ch === "'");
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '|' || (ps && c === ';')) { toks.push({ op: c }); i++; continue; }
      if (c === '&') { const two = src[i + 1] === '&'; toks.push({ op: two ? '&&' : ps ? '&' : ';' }); i += two ? 2 : 1; continue; }
      if (c === '>') { const two = src[i + 1] === '>'; toks.push({ op: two ? '>>' : '>' }); i += two ? 2 : 1; continue; }
      let v = '', q = false;
      while (i < src.length && !isSep(i)) {
        const ch = src[i];
        if (isQ(ch)) {
          q = true;
          let e = src.indexOf(ch, i + 1); if (e < 0) e = src.length;
          const part = src.slice(i + 1, e);
          v += ch === "'" ? part : expand(tab, part);
          i = e + 1;
        } else {
          let j = i; while (j < src.length && !isSep(j) && !isQ(src[j])) j++;
          v += expand(tab, src.slice(i, j)); i = j;
        }
      }
      toks.push({ v, q });
    }
    return toks;
  }
  // Parses -Flag / /f style options. vf = flags that take a value.
  function opts(args, vf = []) {
    const o = { _: [] };
    for (let i = 0; i < args.length; i++) {
      const m = /^(?:--?([a-z][\w-]*)|\/([a-z?]))$/i.exec(args[i]);
      if (!m) { o._.push(args[i]); continue; }
      const k = lc(m[1] || m[2]);
      o[k] = vf.includes(k) && i + 1 < args.length ? args[++i] : true;
    }
    return o;
  }
  const has = (o, ...ks) => ks.some((k) => o[k]);

  // ================= execution =================
  async function execute(tab, line, depth = 0) {
    const src = line.trim();
    if (!src) return true;
    if (tab.ps) { const r = psExpression(tab, src); if (r) return (tab.ok = r === 'ok'); }
    const stmts = [[]], links = [];
    for (const t of tokenize(src, tab)) {
      if (t.op === ';' || t.op === '&&') { stmts.push([]); links.push(t.op); }
      else if (t.op === '&') continue; // PowerShell call operator: just run what follows
      else stmts.at(-1).push(t);
    }
    let ok = true;
    for (let i = 0; i < stmts.length; i++) {
      if (tab.closed || tab.ctrl?.signal.aborted) break;
      if (i > 0 && links[i - 1] === '&&' && !ok) break;
      if (stmts[i].length) ok = await runPipeline(tab, stmts[i], depth);
    }
    tab.ok = ok;
    return ok;
  }

  function psValue(tab, s) {
    s = s.trim(); let m;
    if ((m = /^"(.*)"$/.exec(s))) return expand(tab, m[1]);
    if ((m = /^'(.*)'$/.exec(s))) return m[1];
    if (/^[\d\s.+\-*/%()]+$/.test(s) && /\d/.test(s)) {
      let r;
      try { r = Function(`return (${s.replace(/(^|[^\d.])0+(\d)/g, '$1$2')})`)(); }
      catch { throw new Error(`ParserError: Unexpected token in expression '${s}'.`); }
      if (typeof r !== 'number' || !isFinite(r)) throw new Error('RuntimeException: Attempted to divide by zero.');
      return Number.isInteger(r) ? r : Number(r.toPrecision(15));
    }
    return expand(tab, s);
  }
  function psTable(tab, rows) {
    const w = Math.max(4, ...rows.map((r) => r[0].length)) + 2;
    tab.print('');
    tab.print('Name'.padEnd(w) + 'Value', 'b');
    tab.print('----'.padEnd(w) + '-----', 'b');
    for (const [k, v] of rows) tab.print(k.padEnd(w) + v);
    tab.print('');
  }
  // PowerShell expressions that are not commands: assignments, literals, arithmetic.
  function psExpression(tab, src) {
    let m;
    try {
      if ((m = /^\$(env:)?(\w+)\s*=\s*(.*)$/i.exec(src))) {
        const v = psValue(tab, m[3]);
        if (m[1]) env[m[2].toUpperCase()] = String(v); else tab.vars[lc(m[2])] = v;
        return 'ok';
      }
      if (/^\$psversiontable$/i.test(src)) {
        psTable(tab, [['PSVersion', '7.5.4'], ['PSEdition', 'Core'], ['OS', 'iOS (WinTerm virtual shell)'], ['Platform', 'Win32NT'], ['PSCompatibleVersions', '1.0, 2.0, 3.0, 4.0, 5.0, 5.1, 6.0, 7.0'], ['SerializationVersion', '1.1.0.1'], ['WSManStackVersion', '3.0']]);
        return 'ok';
      }
      if (/^(\$(env:)?\w+|"[^"]*"|'[^']*')$/i.test(src) || (/^[\d\s.+\-*/%()]+$/.test(src) && /\d/.test(src))) {
        const v = String(psValue(tab, src));
        if (v !== '') tab.print(v);
        return 'ok';
      }
    } catch (e) { tab.print(e.message, ERR); return 'err'; }
    return null;
  }

  async function runPipeline(tab, toks, depth) {
    let redir = null;
    const ri = toks.findIndex((t) => t.op === '>' || t.op === '>>');
    if (ri >= 0) {
      const f = toks[ri + 1];
      if (!f || f.op) { printErr(tab, '', new ShellErr('Missing file specification after redirection operator.', 'The syntax of the command is incorrect.')); return false; }
      redir = { append: toks[ri].op === '>>', path: f.v };
      toks = [...toks.slice(0, ri), ...toks.slice(ri + 2)];
    }
    const segs = [[]];
    for (const t of toks) { if (t.op === '|') segs.push([]); else if (!t.op) segs.at(-1).push(t.v); }
    if (segs.some((s) => !s.length)) { printErr(tab, '', new ShellErr('An empty pipe element is not allowed.', 'The syntax of the command is incorrect.')); return false; }
    const capture = segs.length > 1 || !!redir;
    const buf = [];
    const out = capture ? (x) => buf.push(flat(x)) : (x, cls) => tab.print(x, cls);
    const ok = await runCommand(tab, segs[0], out, depth);
    if (!capture) return ok;
    try {
      let lines = buf.length ? buf.join('\n').split('\n') : [];
      for (const f of segs.slice(1)) lines = applyFilter(tab, f, lines);
      if (redir) writeFile(tab, redir.path, lines.length ? lines.join('\n') + '\n' : '', redir.append);
      else lines.forEach((l) => tab.print(l));
    } catch (e) { printErr(tab, segs.at(-1)[0], e); return false; }
    return ok;
  }

  function printErr(tab, name, e) {
    if (e?.name === 'AbortError') throw e;
    if (tab.ps) {
      const canon = name ? COMMANDS.get(lc(name))?.canon || name : '';
      const msg = e.message || e.cmdMsg;
      tab.print(canon ? `${canon}: ${msg}` : msg, ERR);
    } else tab.print(e.cmdMsg || e.message);
  }

  async function runCommand(tab, argv, out, depth) {
    let [name, ...args] = argv, m;
    if ((m = /^(cd|chdir)([\\.].*)$/i.exec(name))) { name = m[1]; args = [m[2], ...args]; }
    if ((m = /^echo[.:](.*)$/i.exec(name))) { out([m[1], ...args].join(' ').trim()); return true; }
    if (/^[a-z]:$/i.test(name) && !args.length) {
      if (lc(name) === 'c:') return true;
      printErr(tab, '', new ShellErr(`Cannot find drive. A drive with the name '${name[0].toUpperCase()}' does not exist.`, 'The system cannot find the drive specified.'));
      return false;
    }
    const d = COMMANDS.get(lc(name));
    if (!d) {
      const script = findScript(tab, name);
      if (script) return runScript(tab, script.node, depth, /\.(bat|cmd)$/i.test(script.n));
      printErr(tab, '', new ShellErr(
        `${name}: The term '${name}' is not recognized as a name of a cmdlet, function, script file, or executable program.\nCheck the spelling of the name, or if a path was included, verify that the path is correct and try again.`,
        `'${name}' is not recognized as an internal or external command,\noperable program or batch file.`));
      return false;
    }
    if (args[0] === '/?' || args[0] === '-?') { out([[d.canon, ACC], [`  ${d.desc || ''}`, '']]); out(`Aliases: ${d.names.join(', ')}`); return true; }
    try { await d.fn({ tab, args, out, ps: tab.ps, name: lc(name), signal: tab.ctrl?.signal ?? NEVER, depth }); return true; }
    catch (e) { printErr(tab, name, e); return false; }
  }
  function findScript(tab, name) {
    for (const n of [name, name + '.bat', name + '.cmd', name + '.ps1']) {
      if (!/\.(bat|cmd|ps1)$/i.test(n)) continue;
      try { const segs = resolve(tab.cwd, n); const node = getNode(segs); if (node?.t === 'f') return { node, n }; } catch { /* bad drive */ }
    }
    return null;
  }
  async function runScript(tab, node, depth, batch) {
    if (depth > 8) { tab.print('Script nesting too deep.', ERR); return false; }
    const prev = tab.profile;
    if (batch) tab.profile = 'cmd'; // batch files always run under cmd semantics
    try { return await runLines(tab, node, depth); } finally { if (tab.profile === 'cmd' && batch) tab.profile = prev; }
  }
  async function runLines(tab, node, depth) {
    let ok = true;
    for (const raw of node.s.split(/\r?\n/)) {
      const l = raw.trim();
      if (!l || /^(@?echo\s+off$|rem(\s|$)|::|#)/i.test(l)) continue;
      if (tab.closed || tab.ctrl?.signal.aborted) break;
      ok = await execute(tab, l.replace(/^@/, ''), depth + 1);
    }
    return ok;
  }

  function applyFilter(tab, argv, lines) {
    const [n, ...a] = argv, name = lc(n);
    const o = opts(a, ['first', 'last', 'n', 'pattern', 'filepath', 'path', 'skip']);
    switch (name) {
      case 'findstr': case 'find': case 'grep': case 'select-string': case 'sls': {
        const pat = o.pattern ?? o._[0];
        if (pat == null || pat === true) throw syntax("Missing an argument for parameter 'Pattern'.");
        const ci = name === 'select-string' || name === 'sls' || o.i;
        const P = ci ? lc(pat) : pat;
        return lines.filter((l) => (ci ? lc(l) : l).includes(P) !== !!o.v);
      }
      case 'sort': case 'sort-object': {
        let r = lines.filter((l) => l.trim()).sort(cmpName);
        if (has(o, 'r', 'descending')) r.reverse();
        if (o.unique) r = r.filter((l, i) => i === 0 || lc(l) !== lc(r[i - 1]));
        return r;
      }
      case 'more': case 'less': case 'out-host': case 'out-string': case 'out-default': return lines;
      case 'select-object': case 'select': case 'head': case 'tail': {
        const first = +(o.first ?? (name === 'head' ? o.n ?? 10 : NaN));
        const last = +(o.last ?? (name === 'tail' ? o.n ?? 10 : NaN));
        // Keep a table header (rows up to a '----' rule) and select from the data rows.
        const rule = lines.slice(0, 6).findIndex((l) => /^[\s-]*-{2,}[\s-]*$/.test(l));
        const head = rule >= 0 ? lines.slice(0, rule + 1) : [];
        let r = lines.slice(head.length).filter((l, i, a) => l !== '' || (i > 0 && i < a.length - 1)).slice(+o.skip || 0);
        if (!isNaN(first)) r = r.slice(0, first);
        if (!isNaN(last)) r = r.slice(-last);
        return [...head, ...r];
      }
      case 'measure-object': case 'measure': case 'wc': {
        const c = lines.filter((l) => l !== '').length;
        return name === 'wc' ? [String(c)] : ['', `Count    : ${c}`, ''];
      }
      case 'out-file': case 'set-content': case 'add-content': case 'tee': case 'tee-object': {
        const p = o.filepath ?? o.path ?? o._[0];
        if (!p || p === true) throw syntax("Cannot bind argument to parameter 'FilePath'.");
        writeFile(tab, p, lines.join('\n') + '\n', name === 'add-content' || has(o, 'append', 'a'));
        return name.startsWith('tee') ? lines : [];
      }
      default:
        throw new ShellErr(`'${n}' is not supported in a pipeline here. Use findstr, Select-String, sort, Select-Object, Measure-Object, Out-File or more.`,
          `'${n}' is not supported in a pipe here. Use findstr, find, sort or more.`);
    }
  }

  // ================= commands =================
  const COMMANDS = new Map(), DEFS = [];
  const def = (names, canon, desc, fn) => { const d = { names, canon, desc, fn }; DEFS.push(d); names.forEach((n) => COMMANDS.set(lc(n), d)); };

  def(['help', 'Get-Help', 'man', '?'], 'Get-Help', 'Show this help', ({ args, out, ps }) => {
    if (args[0]) {
      const d = COMMANDS.get(lc(args[0]));
      if (!d) throw new ShellErr(`Get-Help cannot find help for '${args[0]}'.`, 'This command is not supported by the help utility.');
      out([[d.canon, ACC + ' b'], [`  ${d.desc}`, '']]); out(`Aliases: ${d.names.join(', ')}`); return;
    }
    out([['WinTerm', ACC + ' b'], [` — ${ps ? 'PowerShell' : 'Command Prompt'} for iPhone`, '']]);
    out('');
    for (const d of DEFS) {
      if (!d.desc) continue;
      let n = d.names.slice(0, 3);
      while (n.length > 1 && n.join(', ').length > 21) n = n.slice(0, -1);
      out([[n.join(', ').padEnd(22), ACC], [d.desc, '']]);
    }
    out('');
    out([['Pipe     ', DIM], ['dir | findstr txt · | sort · | select -First 3', '']]);
    out([['Redirect ', DIM], ['echo hi > a.txt · >> appends', '']]);
    out([['Chain    ', DIM], [ps ? 'mkdir x; cd x · a && b' : 'mkdir x && cd x · a & b', '']]);
    out([['Vars     ', DIM], [ps ? '$x = 5 · $env:USERNAME · 2+2' : 'set X=5 · echo %X%', '']]);
    out([['Keys     ', DIM], ['Tab complete · ↑↓ history · ^C cancel', '']]);
  });
  def(['Get-Command', 'gcm'], 'Get-Command', '', ({ out }) => {
    [...new Set(DEFS.map((d) => d.canon))].sort(cmpName).forEach((n) => out(n));
  });
  def(['cls', 'clear', 'Clear-Host'], 'Clear-Host', 'Clear the screen', ({ tab }) => tab.clear());
  def(['echo', 'Write-Output', 'write'], 'Write-Output', 'Print text', ({ args, out, ps }) => {
    if (ps) args.forEach((a) => out(a)); else out(args.length ? args.join(' ') : 'ECHO is on.');
  });
  def(['Write-Host'], 'Write-Host', '', ({ args, out }) => {
    let fg = -1; const parts = [];
    for (let i = 0; i < args.length; i++) {
      const a = lc(args[i]);
      if (a === '-foregroundcolor' || a === '-f' || a === '-fore') fg = CON_NAMES.findIndex((c) => lc(c) === lc(args[++i] ?? ''));
      else if (a !== '-nonewline') parts.push(args[i]);
    }
    out(fg >= 0 ? [[parts.join(' '), 'k' + fg]] : parts.join(' '));
  });

  def(['cd', 'chdir', 'sl', 'Set-Location'], 'Set-Location', 'Change directory', ({ tab, args, out, ps }) => {
    const o = opts(args, ['path']);
    const p = o.path ?? o._.join(' ');
    if (!p) { if (ps) tab.cwd = [...HOME]; else out(fmt(tab.cwd)); return; }
    const segs = resolve(tab.cwd, p), n = getNode(segs);
    if (!n) throw new ShellErr(`Cannot find path '${fmt(segs)}' because it does not exist.`, 'The system cannot find the path specified.');
    if (n.t !== 'd') throw new ShellErr(`Cannot find path '${fmt(segs)}' because it does not exist.`, 'The directory name is invalid.');
    tab.cwd = segs;
  });
  def(['pwd', 'gl', 'Get-Location'], 'Get-Location', 'Show current directory', ({ tab, out, ps }) => {
    if (ps) { out(''); out('Path'); out('----'); out(fmt(tab.cwd)); out(''); } else out(fmt(tab.cwd));
  });

  def(['dir', 'ls', 'gci', 'Get-ChildItem'], 'Get-ChildItem', 'List files', async ({ tab, args, out, ps }) => {
    const o = opts(args, ['path', 'filter']);
    let targets = o.path ? [o.path] : o._;
    if (!targets.length) targets = ['.'];
    if (/^env:\\?$/i.test(targets[0])) { listEnv(tab, out); return; }
    for (const t of targets) {
      const ms = glob(tab.cwd, t);
      if (!ms.length) throw ps ? notFound(tab, t) : new ShellErr('', 'File Not Found');
      let dirSegs, items, whole = false;
      if (ms.length === 1 && ms[0].node.t === 'd' && !/[*?]/.test(t)) { dirSegs = ms[0].segs; items = Object.entries(ms[0].node.c); whole = true; }
      else { dirSegs = ms[0].segs.slice(0, -1); items = ms.map((m) => [m.segs.at(-1), m.node]); }
      items.sort(sortItems);
      if (has(o, 'b', 'name')) { items.forEach(([k]) => out(k)); continue; }
      if (ps) {
        out(''); out(`    Directory: ${fmt(dirSegs)}`); out('');
        out([['Mode'.padEnd(7) + 'LastWriteTime'.padEnd(17) + 'Length'.padStart(6) + ' Name', 'b']]);
        out([['----'.padEnd(7) + '-------------'.padEnd(17) + '------'.padStart(6) + ' ----', 'b']]);
        for (const [k, n] of items) {
          const d = new Date(n.m);
          out([[`${n.t === 'd' ? 'd----' : '-a---'}  ${usDate(d)} ${hm24(d)} ${(n.t === 'd' ? '' : String(byteLen(n.s))).padStart(6)} `, ''], [k, n.t === 'd' ? DIR : '']]);
        }
        out('');
      } else {
        out(' Volume in drive C has no label.'); out(' Volume Serial Number is 1A2B-3C4D'); out('');
        out(` Directory of ${fmt(dirSegs)}`); out('');
        const self = getNode(dirSegs);
        const rows = whole && dirSegs.length ? [['.', self], ['..', getNode(dirSegs.slice(0, -1))], ...items] : items;
        let nf = 0, nd = 0, total = 0;
        for (const [k, n] of rows) {
          const d = new Date(n.m), dt = `${usDate(d)}  ${hm12(d)}`;
          if (n.t === 'd') { nd++; out(`${dt}  <DIR>     ${k}`); }
          else { nf++; const b = byteLen(n.s); total += b; out(`${dt} ${num(b).padStart(10)} ${k}`); }
        }
        let free = 64e9;
        try { const e = await navigator.storage?.estimate?.(); if (e?.quota) free = Math.max(0, e.quota - (e.usage || 0)); } catch { /* unsupported */ }
        out(`${String(nf).padStart(6)} File(s) ${num(total).padStart(13)} bytes`);
        out(`${String(nd).padStart(6)} Dir(s)  ${num(Math.floor(free)).padStart(13)} bytes free`);
      }
    }
  });
  function listEnv(tab, out) {
    const keys = Object.keys(env).sort(cmpName);
    if (tab.ps) { const w = Math.max(...keys.map((k) => k.length)) + 2; out(''); out('Name'.padEnd(w) + 'Value'); out('----'.padEnd(w) + '-----'); keys.forEach((k) => out(k.padEnd(w) + env[k])); out(''); }
    else keys.forEach((k) => out(`${k}=${env[k]}`));
  }

  def(['type', 'cat', 'gc', 'Get-Content'], 'Get-Content', 'Show file contents', ({ tab, args, out, ps }) => {
    const o = opts(args, ['path', 'tail', 'head', 'totalcount', 'first', 'last']);
    const targets = o.path ? [o.path] : o._;
    if (!targets.length) throw syntax("Cannot bind argument to parameter 'Path' because it is null.");
    for (const t of targets) {
      const ms = glob(tab.cwd, t);
      if (!ms.length) throw ps ? notFound(tab, t) : new ShellErr('', 'The system cannot find the file specified.');
      for (const { segs, node } of ms) {
        if (node.t === 'd') throw new ShellErr(`Unable to get content because it is a directory: '${fmt(segs)}'. Please use 'Get-ChildItem' instead.`, 'Access is denied.');
        if (!node.s) continue;
        let lines = node.s.replace(/\n$/, '').split('\n');
        const head = +(o.head ?? o.totalcount ?? o.first), tail = +(o.tail ?? o.last);
        if (head >= 0) lines = lines.slice(0, head);
        if (tail >= 0) lines = lines.slice(-tail || lines.length);
        out(lines.join('\n'));
      }
    }
  });

  def(['mkdir', 'md'], 'New-Item', 'Create a directory', ({ tab, args }) => {
    const o = opts(args, ['path']);
    const list = o.path ? [o.path] : o._;
    if (!list.length) throw syntax("Cannot bind argument to parameter 'Path' because it is null.");
    for (const p of list) {
      const segs = resolve(tab.cwd, p);
      if (getNode(segs)) throw new ShellErr(`An item with the specified name ${fmt(segs)} already exists.`, `A subdirectory or file ${p} already exists.`);
      mkdirp(segs);
    }
  });
  def(['ni', 'New-Item', 'touch'], 'New-Item', 'Create a file (-ItemType Directory)', ({ tab, args, name }) => {
    const o = opts(args, ['path', 'itemtype', 'type', 'value', 'name']);
    let p = o.path ?? o._[0];
    if (o.name && o.name !== true) p = p ? `${p}\\${o.name}` : o.name;
    if (!p || p === true) throw syntax("Cannot bind argument to parameter 'Path' because it is an empty string.");
    const segs = resolve(tab.cwd, p), ex = getNode(segs);
    if (name === 'touch' && ex) { ex.m = Date.now(); saveFS(); return; }
    if (lc(o.itemtype ?? o.type ?? 'file').startsWith('d')) {
      if (ex && !o.force) throw new ShellErr(`An item with the specified name ${fmt(segs)} already exists.`);
      mkdirp(segs); return;
    }
    if (ex && !o.force) throw new ShellErr(`The file '${fmt(segs)}' already exists.`);
    writeFile(tab, p, o.value == null || o.value === true ? '' : String(o.value), false);
  });
  def(['Set-Content', 'sc'], 'Set-Content', '', ({ tab, args }) => {
    const o = opts(args, ['path', 'value']); const p = o.path ?? o._[0];
    if (!p || p === true) throw syntax("Cannot bind argument to parameter 'Path'.");
    writeFile(tab, p, String(o.value === true ? '' : o.value ?? o._.slice(1).join(' ')) + '\n', false);
  });
  def(['Add-Content', 'ac'], 'Add-Content', '', ({ tab, args }) => {
    const o = opts(args, ['path', 'value']); const p = o.path ?? o._[0];
    if (!p || p === true) throw syntax("Cannot bind argument to parameter 'Path'.");
    writeFile(tab, p, String(o.value === true ? '' : o.value ?? o._.slice(1).join(' ')) + '\n', true);
  });

  def(['del', 'erase', 'rm', 'rd', 'rmdir', 'ri', 'Remove-Item'], 'Remove-Item', 'Delete files/folders (-r)', ({ tab, args, ps, name }) => {
    const o = opts(args, ['path']);
    const targets = o.path ? [o.path] : o._;
    if (!targets.length) throw syntax("Cannot bind argument to parameter 'Path' because it is null.");
    const rec = has(o, 'r', 'recurse', 's', 'rf', 'fr');
    const isDel = name === 'del' || name === 'erase', isRd = name === 'rd' || name === 'rmdir';
    for (const t of targets) {
      const ms = glob(tab.cwd, t);
      if (!ms.length) throw ps ? notFound(tab, t) : new ShellErr('', isDel ? `Could Not Find ${fullPath(tab, t)}` : 'The system cannot find the file specified.');
      for (const { segs, node } of ms) {
        if (!segs.length) throw new ShellErr('Cannot remove the root of a drive.', 'Access is denied.');
        if (inUse(segs)) throw inUseErr(segs);
        if (node.t === 'd') {
          if (!ps && isDel) throw new ShellErr('', 'Access is denied.');
          if (Object.keys(node.c).length && !rec) throw new ShellErr(`The item at ${fmt(segs)} has children and the Recurse parameter was not specified.`, 'The directory is not empty.');
        } else if (!ps && isRd) throw new ShellErr('', 'The directory name is invalid.');
        const parent = getNode(segs.slice(0, -1));
        delete parent.c[segs.at(-1)];
        parent.m = Date.now();
      }
    }
    saveFS();
  });

  function transfer({ tab, args, out, ps }, move) {
    const o = opts(args, ['path', 'destination']);
    const src = o.path ?? o._[0], dst = o.destination ?? o._[1] ?? '.';
    if (!src || src === true) throw syntax("Cannot bind argument to parameter 'Path'.");
    const ms = glob(tab.cwd, src);
    if (!ms.length) throw ps ? notFound(tab, src) : new ShellErr('', 'The system cannot find the file specified.');
    const dSegs = resolve(tab.cwd, dst), dNode = getNode(dSegs), rec = has(o, 'r', 'recurse', 's');
    let count = 0;
    for (const m of ms) {
      let tSegs;
      if (dNode?.t === 'd') tSegs = [...dSegs, m.segs.at(-1)];
      else if (ms.length > 1) throw new ShellErr(`Container '${fmt(dSegs)}' does not exist.`, 'The system cannot find the path specified.');
      else tSegs = dSegs;
      if (!tSegs.length || !m.segs.length) throw new ShellErr('Access is denied.', 'Access is denied.');
      const parent = getNode(tSegs.slice(0, -1));
      if (!parent || parent.t !== 'd') throw new ShellErr(`Could not find a part of the path '${fmt(tSegs)}'.`, 'The system cannot find the path specified.');
      if (isPrefix(m.segs, tSegs)) throw new ShellErr(`Cannot ${move ? 'move' : 'copy'} item '${fmt(m.segs)}' onto or into itself.`, 'The file cannot be copied onto itself.');
      const ex = child(parent, tSegs.at(-1));
      if (ex) { if (ex[1].t === 'd') throw new ShellErr(`An item with the specified name ${fmt(tSegs)} already exists.`, 'Access is denied.'); delete parent.c[ex[0]]; }
      if (move) {
        if (inUse(m.segs)) throw inUseErr(m.segs);
        const sp = getNode(m.segs.slice(0, -1)); delete sp.c[m.segs.at(-1)]; sp.m = Date.now();
        parent.c[tSegs.at(-1)] = m.node;
      } else parent.c[tSegs.at(-1)] = m.node.t === 'd' ? (rec ? clone(m.node) : mkdir()) : mkfile(m.node.s);
      parent.m = Date.now();
      count++;
    }
    saveFS();
    if (!ps) out(`        ${count} file(s) ${move ? 'moved' : 'copied'}.`);
  }
  def(['copy', 'cp', 'cpi', 'Copy-Item'], 'Copy-Item', 'Copy files (-r for folders)', (c) => transfer(c, false));
  def(['move', 'mv', 'mi', 'Move-Item'], 'Move-Item', 'Move files/folders', (c) => transfer(c, true));
  def(['ren', 'rename', 'rni', 'Rename-Item'], 'Rename-Item', 'Rename a file or folder', ({ tab, args, ps }) => {
    const o = opts(args, ['path', 'newname']);
    const src = o.path ?? o._[0], nn = o.newname ?? o._[1];
    if (!src || !nn || src === true || nn === true) throw syntax("Cannot bind argument to parameter 'NewName'.");
    if (/[\\/]/.test(nn)) throw new ShellErr('Cannot rename because the target specified represents a path or device name.', 'The syntax of the command is incorrect.');
    const segs = resolve(tab.cwd, src), node = getNode(segs);
    if (!node || !segs.length) throw ps ? notFound(tab, src) : new ShellErr('', 'The system cannot find the file specified.');
    const parent = getNode(segs.slice(0, -1)), ex = child(parent, nn);
    if (ex && ex[1] !== node) throw new ShellErr('Cannot create a file when that file already exists.', 'A duplicate file name exists, or the file cannot be found.');
    if (inUse(segs)) throw inUseErr(segs);
    delete parent.c[segs.at(-1)];
    parent.c[nn] = node;
    saveFS();
  });

  def(['tree'], 'tree', 'Show folder tree (/f for files)', ({ tab, args, out }) => {
    const o = opts(args), p = o._[0] || '.';
    const segs = resolve(tab.cwd, p), node = getNode(segs);
    if (!node || node.t !== 'd') throw new ShellErr(`Invalid path - ${p.toUpperCase()}`);
    const files = has(o, 'f');
    out('Folder PATH listing'); out('Volume serial number is 1A2B-3C4D'); out(fmt(segs).toUpperCase());
    let any = false;
    const walk = (n, pre) => {
      const ents = Object.entries(n.c).sort(sortItems);
      const ds = ents.filter((e) => e[1].t === 'd');
      if (files) {
        const fs = ents.filter((e) => e[1].t === 'f');
        fs.forEach(([k]) => out(pre + (ds.length ? '│   ' : '    ') + k));
        if (fs.length) out(pre + (ds.length ? '│' : ''));
        any ||= fs.length > 0;
      }
      ds.forEach(([k, c], i) => { const last = i === ds.length - 1; any = true; out(pre + (last ? '└───' : '├───') + k); walk(c, pre + (last ? '    ' : '│   ')); });
    };
    walk(node, '');
    if (!any) out('No subfolders exist');
  });

  def(['notepad', 'edit', 'nano', 'vim', 'vi', 'code'], 'notepad', 'Edit a text file', ({ tab, args }) => {
    const p = args.join(' ');
    if (!p) throw new ShellErr('Usage: notepad <file>');
    const segs = resolve(tab.cwd, p), n = getNode(segs);
    if (!segs.length || n?.t === 'd') throw new ShellErr(`'${fmt(segs)}' is a directory.`, 'Access is denied.');
    const parent = getNode(segs.slice(0, -1));
    if (!parent || parent.t !== 'd') throw new ShellErr(`Could not find a part of the path '${fmt(segs)}'.`, 'The system cannot find the path specified.');
    openEditor(segs);
  });
  def(['start', 'Start-Process', 'saps', 'open'], 'Start-Process', 'Open a URL or file', ({ tab, args }) => {
    const t = args.filter((a) => !/^[-/]/.test(a))[0];
    if (!t) throw syntax("Cannot bind argument to parameter 'FilePath'.");
    if (/^https?:\/\//i.test(t) || /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(t) && !getNode(resolve(tab.cwd, t))) { window.open(/^https?:/i.test(t) ? t : 'https://' + t, '_blank', 'noopener'); return; }
    const segs = resolve(tab.cwd, t), n = getNode(segs);
    if (!n) throw notFound(tab, t);
    if (n.t === 'f') openEditor(segs); else tab.cwd = segs;
  });

  def(['history', 'h', 'Get-History', 'doskey'], 'Get-History', 'Command history', ({ tab, out, ps }) => {
    const list = tab.hist.slice(-50), base = tab.hist.length - list.length;
    if (ps) { out(''); out([['  Id CommandLine', 'b']]); out([['  -- -----------', 'b']]); list.forEach((c, i) => out(`${String(base + i + 1).padStart(4)} ${c}`)); out(''); }
    else list.forEach((c) => out(c));
  });

  const longDate = (d) => `${d.toLocaleDateString('en-US', { weekday: 'long' })}, ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getDate()}, ${d.getFullYear()} ${d.toLocaleTimeString('en-US')}`;
  def(['date', 'Get-Date'], 'Get-Date', 'Show date and time', ({ tab, args, out, ps }) => {
    const d = new Date(), o = opts(args, ['format']);
    if (o.format && o.format !== true) {
      const map = { yyyy: d.getFullYear(), MM: pad2(d.getMonth() + 1), dd: pad2(d.getDate()), HH: pad2(d.getHours()), mm: pad2(d.getMinutes()), ss: pad2(d.getSeconds()) };
      out(o.format.replace(/yyyy|MM|dd|HH|mm|ss/g, (k) => map[k])); return;
    }
    if (ps) { out(''); out(longDate(d)); out(''); } else out(`The current date is: ${envGet(tab, 'DATE')}`);
  });
  def(['time'], 'time', 'Show current time', ({ tab, out }) => out(`The current time is: ${envGet(tab, 'TIME')}`));
  def(['whoami'], 'whoami', 'Current user', ({ out }) => out(`${lc(env.COMPUTERNAME)}\\${env.USERNAME}`));
  def(['hostname'], 'hostname', 'Computer name', ({ out }) => out(env.COMPUTERNAME));
  def(['ver', 'winver'], 'ver', 'Version', ({ out }) => { out(''); out('WinTerm for iOS [Version 1.0.0] — virtual Windows-style shell'); });
  def(['about'], 'about', 'About this app', ({ out }) => {
    out([['WinTerm 1.0', ACC + ' b'], [' — a Windows Terminal-style shell for iPhone', '']]);
    out('Runs entirely in Safari. The C: drive is virtual and');
    out('saved on this device. Network tools use HTTPS from');
    out('the browser sandbox (no raw sockets).');
    out([['Install: ', DIM], ['Share ▸ Add to Home Screen', '']]);
  });

  async function sysInfo() {
    const ua = navigator.userAgent;
    const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(ua) ? 'Android' : navigator.platform || 'Unknown';
    const sv = /Version\/([\d.]+)/.exec(ua)?.[1], iosUA = /OS (\d+)_(\d+)/.exec(ua);
    const ios = dev === 'iPhone' || dev === 'iPad';
    // Safari 26+ freezes the OS version in the UA; its own version matches iOS.
    const os = ios ? `iOS ${sv && +sv.split('.')[0] >= 26 ? sv : iosUA ? `${iosUA[1]}.${iosUA[2]}` : ''}`.trim() : navigator.platform || 'Unknown';
    const browser = /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : /EdgiOS/.test(ua) ? 'Edge' : sv ? `Safari ${sv}` : 'Browser';
    let storage = 'n/a';
    try { const e = await navigator.storage?.estimate?.(); if (e) storage = `${(e.usage / 1048576).toFixed(1)} MiB / ${(e.quota / 1073741824).toFixed(1)} GiB`; } catch { /* unsupported */ }
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    return {
      dev, os, browser, storage, mode: standalone ? 'Standalone (Home Screen)' : 'Browser tab',
      screen: `${screen.width}x${screen.height} @${devicePixelRatio}x`, viewport: `${innerWidth}x${innerHeight}`,
      cpu: `${navigator.hardwareConcurrency || '?'} logical cores`, lang: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone, online: navigator.onLine ? 'Online' : 'Offline', uptime: fmtDur(performance.now()),
    };
  }
  def(['systeminfo'], 'systeminfo', 'Device information', async ({ out }) => {
    const s = await sysInfo();
    out('');
    [['Host Name', env.COMPUTERNAME], ['OS Name', 'WinTerm virtual Windows shell'], ['OS Version', '1.0.0'], ['Device', `${s.dev} (${s.os})`],
      ['Browser', s.browser], ['Display Mode', s.mode], ['Screen', s.screen], ['Viewport', s.viewport], ['Processors', s.cpu],
      ['System Locale', s.lang], ['Time Zone', s.tz], ['Network', s.online], ['Storage', s.storage], ['Uptime', s.uptime]]
      .forEach(([k, v]) => out(`${(k + ':').padEnd(16)}${v}`));
  });
  def(['winfetch', 'neofetch', 'fastfetch'], 'winfetch', 'System summary', async ({ tab, out }) => {
    const s = await sysInfo();
    const P = '███████ ███████';
    const logo = [P, P, P, P, '', P, P, P, P, '', ''];
    const title = `${env.USERNAME}@${env.COMPUTERNAME}`;
    const info = [[title, ''], ['-'.repeat(title.length), ''], ['OS', s.os], ['Host', s.dev], ['Shell', tab.ps ? 'PowerShell 7.5.4' : 'cmd'],
      ['Terminal', 'WinTerm'], ['Display', s.screen], ['CPU', s.cpu], ['Browser', s.browser], ['Locale', s.lang], ['Uptime', s.uptime]];
    info.forEach(([k, v], i) => {
      const line = [[(logo[i] ?? '').padEnd(15) + '  ', 'k9']];
      if (i < 2) line.push([k, i ? '' : ACC + ' b']); else line.push([`${k}: `, ACC + ' b'], [v, '']);
      out(line);
    });
    out('');
    out([[' '.repeat(17), ''], ...[0, 4, 2, 6, 1, 5, 3, 7].map((c) => ['███', 'k' + c])]);
    out([[' '.repeat(17), ''], ...[8, 12, 10, 14, 9, 13, 11, 15].map((c) => ['███', 'k' + c])]);
  });

  def(['ipconfig'], 'ipconfig', 'Network configuration (simulated)', ({ out }) => {
    out(''); out('Windows IP Configuration'); out(''); out('');
    out('Wireless LAN adapter Wi-Fi:'); out('');
    if (!navigator.onLine) { out('   Media State . . . . . . . . . . . : Media disconnected'); return; }
    out('   Connection-specific DNS Suffix  . : home');
    out('   IPv4 Address. . . . . . . . . . . : 192.168.1.42');
    out('   Subnet Mask . . . . . . . . . . . : 255.255.255.0');
    out('   Default Gateway . . . . . . . . . : 192.168.1.1');
    out(''); out([['(Simulated: browsers cannot read network settings.)', DIM]]);
  });
  async function probe(host, signal) {
    const c = new AbortController(), on = () => c.abort();
    signal.addEventListener('abort', on);
    const to = setTimeout(() => c.abort(), 4000), t0 = performance.now();
    try { await fetch(`https://${host}/favicon.ico?wt=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: c.signal }); return performance.now() - t0; }
    catch { if (signal.aborted) throw abortErr(); return null; }
    finally { clearTimeout(to); signal.removeEventListener('abort', on); }
  }
  def(['ping', 'Test-Connection'], 'Test-Connection', 'Ping a host over HTTPS', async ({ args, out, signal }) => {
    const o = opts(args, ['n', 'count', 'c']);
    const host = String(o._[0] || '').replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '');
    if (!host) throw new ShellErr("Cannot validate argument on parameter 'TargetName'. The argument is null or empty.", 'Usage: ping [-t] [-n count] target_name');
    const forever = !!o.t, n = Math.max(1, Math.min(1000, parseInt(o.n ?? o.count ?? o.c, 10) || 4));
    out(''); out(`Pinging ${host} over HTTPS:`);
    const times = []; let sent = 0;
    try {
      for (let i = 0; forever || i < n; i++) {
        sent++;
        const t = await probe(host, signal);
        if (t == null) out('Request timed out.'); else { times.push(t); out(`Reply from ${host}: time=${Math.round(t)}ms`); }
        if (forever || i < n - 1) await sleep(Math.max(0, 1000 - (t ?? 1000)), signal);
      }
    } catch (e) { if (e.name !== 'AbortError') throw e; }
    const lost = sent - times.length;
    out(''); out(`Ping statistics for ${host}:`);
    out(`    Packets: Sent = ${sent}, Received = ${times.length}, Lost = ${lost} (${Math.round((lost / sent) * 100)}% loss),`);
    if (times.length) {
      const r = times.map(Math.round);
      out('Approximate round trip times in milli-seconds:');
      out(`    Minimum = ${Math.min(...r)}ms, Maximum = ${Math.max(...r)}ms, Average = ${Math.round(r.reduce((a, b) => a + b, 0) / r.length)}ms`);
    }
  });
  def(['curl', 'wget', 'iwr', 'Invoke-WebRequest', 'irm', 'Invoke-RestMethod'], 'Invoke-WebRequest', 'Fetch a URL (CORS permitting)', async ({ tab, args, out, signal, name }) => {
    const o = opts(args, ['uri', 'method', 'x', 'o', 'outfile']);
    let url = o.uri ?? o._[0];
    if (!url || url === true) throw new ShellErr("Cannot validate argument on parameter 'Uri'.", 'curl: try \'curl <url>\'');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let r, text;
    try { r = await fetch(url, { signal, method: String(o.method ?? o.x ?? 'GET').toUpperCase() }); text = await r.text(); }
    catch (e) {
      if (signal.aborted) throw abortErr();
      throw new ShellErr(`Unable to reach '${url}'. The site may block cross-origin requests (CORS) or be offline.`, `curl: (7) Failed to fetch ${url} — the site may block cross-origin requests (CORS).`);
    }
    const dest = o.o ?? o.outfile;
    if (dest && dest !== true) { writeFile(tab, dest, text, false); out(`Saved ${num(byteLen(text))} bytes to ${fullPath(tab, dest)}`); return; }
    if (name === 'iwr' || name === 'invoke-webrequest') {
      out(''); out(`StatusCode        : ${r.status}`); out(`StatusDescription : ${r.statusText || (r.ok ? 'OK' : '')}`);
      out(`Content           : ${text.slice(0, 200).replace(/\s+/g, ' ')}${text.length > 200 ? '...' : ''}`);
      out(`RawContentLength  : ${byteLen(text)}`); out(''); return;
    }
    out(text.length > 20000 ? text.slice(0, 20000) + '\n[output truncated]' : text.replace(/\n$/, ''));
  });
  def(['tasklist', 'ps', 'gps', 'Get-Process'], 'Get-Process', 'Running processes', ({ tab, out }) => {
    const procs = [['Idle', 0, 0.01], ['System', 4, 0.15], ['smss', 412, 1.2], ['csrss', 604, 6.1], ['wininit', 688, 7.0], ['services', 812, 12.4], ['lsass', 828, 22.9], ['svchost', 948, 38.6], ['explorer', 3120, 164.2], ['WindowsTerminal', 5824, 96.3], ['OpenConsole', 5900, 12.8],
      ...tabs.map((t) => [t.ps ? 'pwsh' : 'cmd', 6000 + t.id * 4, t.ps ? 84.5 : 5.9])].sort((a, b) => cmpName(a[0], b[0]));
    if (tab.ps) {
      out(''); out([['   WS(M)   CPU(s)     Id ProcessName', 'b']]); out([['   -----   ------     -- -----------', 'b']]);
      procs.forEach(([n, id, ws]) => out(`${ws.toFixed(2).padStart(8)} ${((id % 97) / 7).toFixed(2).padStart(8)} ${String(id).padStart(6)} ${n}`)); out('');
    } else {
      out(''); out('Image Name                PID    Mem Usage'); out('==================== ======== ============');
      procs.forEach(([n, id, ws]) => out(`${(n + '.exe').slice(0, 20).padEnd(20)} ${String(id).padStart(8)} ${(num(Math.round(ws * 1024)) + ' K').padStart(12)}`));
    }
  });

  def(['set', 'env', 'printenv'], 'Set-Variable', 'Show/set variables (set X=1)', ({ tab, args, out, ps }) => {
    const a = args.join(' ');
    if (!a) { listEnv(tab, out); return; }
    if (ps && !a.includes('=') && args.length >= 2) { tab.vars[lc(args[0])] = args.slice(1).join(' '); return; }
    const eq = a.indexOf('=');
    if (eq > 0) { const k = a.slice(0, eq).trim().toUpperCase(), v = a.slice(eq + 1); if (v) env[k] = v; else delete env[k]; return; }
    const m = Object.keys(env).filter((k) => k.startsWith(a.toUpperCase())).sort(cmpName);
    if (!m.length) throw new ShellErr(`Cannot find a variable with the name '${a}'.`, `Environment variable ${a} not defined`);
    m.forEach((k) => out(`${k}=${env[k]}`));
  });
  def(['color'], 'color', 'Console colors, e.g. color 0A', ({ tab, args, out }) => {
    const a = args[0], st = tab.screen.style;
    if (!a) { st.removeProperty('--bg'); st.removeProperty('--fg'); return; }
    if (!/^[0-9a-f]{1,2}$/i.test(a)) { out('Usage: color [bg][fg] — hex digits 0-F, e.g. color 0A'); tab.ok = false; return; }
    const [b, f] = a.length === 2 ? [a[0], a[1]] : ['0', a[0]];
    if (lc(b) === lc(f)) return;
    st.setProperty('--bg', `var(--c${CON[parseInt(b, 16)]})`);
    st.setProperty('--fg', `var(--c${CON[parseInt(f, 16)]})`);
  });
  def(['theme'], 'theme', 'List/set color scheme', ({ args, out }) => {
    const n = args.join(' ').trim(), names = Object.keys(SCHEMES);
    if (!n) { names.forEach((k) => out([[k === settings.scheme ? ' * ' : '   ', ACC], [k, '']])); out([['Usage: theme <name>', DIM]]); return; }
    const k = names.find((x) => lc(x) === lc(n)) || names.find((x) => lc(x).startsWith(lc(n)));
    if (!k) throw new ShellErr(`Unknown color scheme '${n}'. Type 'theme' to list them.`);
    settings.scheme = k; saveSettings(); applySettings();
    out(`Color scheme: ${k}`);
  });
  def(['font'], 'font', 'Font size, e.g. font 14', ({ args, out }) => {
    const n = parseInt(args[0], 10);
    if (!n) { out(`Font size: ${settings.fontSize}px (9-24)`); return; }
    settings.fontSize = Math.max(9, Math.min(24, n)); saveSettings(); applySettings();
  });
  def(['title'], 'title', 'Set tab title', ({ tab, args }) => { tab.customTitle = args.join(' ') || null; tab.updateTitle(); });
  def(['powershell', 'pwsh'], 'pwsh', 'Switch this tab to PowerShell', ({ tab }) => tab.switchProfile('pwsh'));
  def(['cmd'], 'cmd', 'Switch this tab to Command Prompt', ({ tab }) => tab.switchProfile('cmd'));
  def(['exit'], 'exit', 'Exit shell / close tab', ({ tab }) => {
    if (tab.stack.length) { tab.profile = tab.stack.pop(); tab.updateTitle(); } else tab.close();
  });
  def(['Start-Sleep', 'sleep', 'timeout'], 'Start-Sleep', 'Wait N seconds', async ({ args, out, signal, name }) => {
    const o = opts(args, ['seconds', 's', 'milliseconds', 'm', 't']);
    const ms = o.milliseconds ?? o.m ? +(o.milliseconds ?? o.m) : 1000 * +(o.seconds ?? o.s ?? o.t ?? o._[0] ?? 0);
    if (!isFinite(ms) || ms < 0) throw syntax('Cannot validate argument on parameter \'Seconds\'.');
    if (name === 'timeout') out(`Waiting for ${Math.round(ms / 1000)} seconds, press CTRL+C to quit ...`);
    await sleep(ms, signal);
  });

  // ================= UI =================
  const app = $('#app'), tabsEl = $('#tabs'), stage = $('#stage'), input = $('#cmd'), keybar = $('#keybar');
  const menu = $('#menu'), sheet = $('#sheet'), editor = $('#editor'), edText = $('#ed-text'), edTitle = $('#ed-title');
  const tabs = [];
  let active = null, tabSeq = 0, comp = null;
  const MAX_LINES = 3000;

  function applySettings() {
    const s = SCHEMES[settings.scheme], r = document.documentElement.style;
    r.setProperty('--bg', s.bg); r.setProperty('--fg', s.fg);
    s.c.forEach((c, i) => r.setProperty('--c' + i, c));
    r.setProperty('--fs', settings.fontSize + 'px');
    keybar.hidden = !settings.keys;
  }

  class Tab {
    constructor(profile) {
      Object.assign(this, { id: ++tabSeq, profile, stack: [], cwd: [...HOME], vars: {}, ok: true, ctrl: null, customTitle: null, closed: false, pending: '' });
      this.hist = store.get('wt.hist', []); this.hIdx = this.hist.length; this.draft = '';
      this.screen = h('div', 'screen'); this.screen.setAttribute('role', 'log');
      this.out = h('div', 'out'); this.row = h('div', 'promptrow'); this.pr = h('span', 'prompt');
      this.row.append(this.pr); this.screen.append(this.out, this.row); stage.append(this.screen);
      this.btn = h('div', 'tab'); this.btn.setAttribute('role', 'tab');
      this.icon = h('span', 'ticon'); this.ttl = h('span', 'ttl');
      const x = h('button', 'tclose'); x.setAttribute('aria-label', 'Close tab');
      x.innerHTML = '<svg viewBox="0 0 10 10"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/></svg>';
      this.btn.append(this.icon, this.ttl, x); tabsEl.append(this.btn);
      this.btn.addEventListener('click', () => { activate(this); focusInput(); });
      x.addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
      tabs.push(this);
      this.banner(); this.updateTitle(); this.updatePrompt();
    }
    get ps() { return this.profile === 'pwsh'; }
    promptText() { return this.ps ? `PS ${fmt(this.cwd)}> ` : `${fmt(this.cwd)}>`; }
    updatePrompt() { this.pr.textContent = this.ctrl ? '' : this.promptText(); }
    updateTitle() {
      this.ttl.textContent = this.customTitle || (this.ps ? 'PowerShell' : 'Command Prompt');
      this.icon.innerHTML = ICONS[this.profile];
    }
    banner() {
      if (this.ps) { this.print('PowerShell 7.5.4'); this.print([['Type ', ''], ['help', ACC], [' for commands.', '']]); }
      else { this.print('Command Prompt [Version 10.0.26100]'); this.print('Type "help" for commands.'); }
      const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
      if (!standalone && !store.get('wt.tip', false)) { this.print([['Tip: Share ▸ Add to Home Screen for full-screen mode.', DIM]]); store.set('wt.tip', true); }
      this.print('');
    }
    print(x, cls) {
      const s = this.screen, atBottom = s.scrollHeight - s.scrollTop - s.clientHeight < 80;
      const d = h('div', 'line' + (cls ? ' ' + cls : ''));
      if (Array.isArray(x)) for (const [t, c] of x) d.append(c ? h('span', c, t) : document.createTextNode(t));
      else d.textContent = x;
      this.out.append(d);
      while (this.out.childElementCount > MAX_LINES) this.out.firstChild.remove();
      if (atBottom) this.scroll();
    }
    scroll() {
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => { this.raf = 0; this.screen.scrollTop = this.screen.scrollHeight; });
    }
    clear() { this.out.textContent = ''; this.cleared = true; }
    switchProfile(p) { this.stack.push(this.profile); this.profile = p; this.print(''); this.banner(); this.updateTitle(); }
    close() {
      if (this.closed) return;
      this.closed = true; this.ctrl?.abort();
      const i = tabs.indexOf(this);
      tabs.splice(i, 1); this.screen.remove(); this.btn.remove();
      if (active === this) { active = null; activate(tabs.length ? tabs[Math.min(i, tabs.length - 1)] : new Tab(settings.profile)); }
    }
    async submit(raw) {
      const line = raw.replace(/[\u201C\u201D\u201E\u2033]/g, '"').replace(/[\u2018\u2019\u201A\u2032]/g, "'")
        .replace(/\u2014/g, '--').replace(/\u2013/g, '-').replace(/\u00A0/g, ' ');
      this.print([[this.promptText(), ''], [line, '']]);
      this.scroll();
      if (line.trim() && this.hist.at(-1) !== line) {
        this.hist.push(line); this.hist = this.hist.slice(-200);
        const g = store.get('wt.hist', []); g.push(line); store.set('wt.hist', g.slice(-200));
      }
      this.hIdx = this.hist.length; this.draft = ''; this.cleared = false;
      this.ctrl = new AbortController(); this.updatePrompt(); this.row.classList.add('busy');
      try { await execute(this, line); }
      catch (e) { if (e?.name !== 'AbortError') this.print(String(e?.message || e), ERR); }
      finally {
        this.ctrl = null; this.row.classList.remove('busy');
        if (!this.closed) {
          if (!this.ps && line.trim() && !this.cleared) this.print('');
          this.updatePrompt(); this.scroll();
        }
      }
    }
    interrupt() {
      if (this.ctrl) { this.ctrl.abort(); this.print('^C', DIM); }
      else { this.print([[this.promptText(), ''], [input.value, ''], ['^C', DIM]]); input.value = ''; this.hIdx = this.hist.length; }
      comp = null; this.scroll();
    }
  }

  function activate(tab) {
    if (active === tab) return;
    const hadFocus = document.activeElement === input;
    if (active) { active.pending = input.value; active.screen.classList.remove('active'); active.btn.classList.remove('active'); active.btn.setAttribute('aria-selected', 'false'); }
    active = tab; comp = null;
    tab.screen.classList.add('active'); tab.btn.classList.add('active'); tab.btn.setAttribute('aria-selected', 'true');
    tab.row.append(input); input.value = tab.pending;
    tab.btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    tab.scroll();
    if (hadFocus) input.focus({ preventScroll: true });
  }
  function focusInput() { if (editor.hidden && sheet.hidden) input.focus({ preventScroll: true }); }

  function histNav(dir) {
    const t = active;
    if (!t.hist.length) return;
    if (t.hIdx === t.hist.length) t.draft = input.value;
    t.hIdx = Math.max(0, Math.min(t.hist.length, t.hIdx + dir));
    input.value = t.hIdx === t.hist.length ? t.draft : t.hist[t.hIdx];
    const n = input.value.length; input.setSelectionRange(n, n); comp = null;
  }
  function complete(dir = 1) {
    const t = active, v = input.value, pos = input.selectionStart ?? v.length;
    if (!comp || comp.value !== v) {
      const before = v.slice(0, pos);
      const m = /(?:"([^"]*)|([^\s"|;>&]*))$/.exec(before);
      const quoted = m[1] != null, word = quoted ? m[1] : m[2];
      const start = pos - word.length - (quoted ? 1 : 0);
      const isCmd = /^\s*$|[|;&]\s*$/.test(before.slice(0, start));
      const cut = Math.max(word.lastIndexOf('\\'), word.lastIndexOf('/'));
      const dirPart = word.slice(0, cut + 1), base = lc(word.slice(cut + 1));
      let cands = [];
      try {
        const dn = getNode(resolve(t.cwd, dirPart || '.'));
        if (dn?.t === 'd') cands = Object.keys(dn.c).filter((k) => lc(k).startsWith(base)).sort(cmpName).map((k) => dirPart + k + (dn.c[k].t === 'd' && t.ps ? '\\' : ''));
      } catch { /* bad drive */ }
      if (isCmd && !dirPart) cands = [...new Set(DEFS.flatMap((d) => d.names))].filter((n) => lc(n).startsWith(base)).sort(cmpName).concat(cands);
      if (!cands.length) return;
      comp = { prefix: v.slice(0, start), after: v.slice(pos), cands, i: dir > 0 ? -1 : 0 };
    }
    comp.i = (comp.i + dir + comp.cands.length) % comp.cands.length;
    let c = comp.cands[comp.i];
    if (/\s/.test(c)) c = `"${c}"`;
    input.value = comp.prefix + c + comp.after;
    const caret = comp.prefix.length + c.length;
    input.setSelectionRange(caret, caret);
    comp.value = input.value;
  }

  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    const t = active, k = e.key;
    if (k === 'Enter') { e.preventDefault(); if (t.ctrl) return; const v = input.value; input.value = ''; comp = null; t.submit(v); }
    else if (k === 'ArrowUp') { e.preventDefault(); histNav(-1); }
    else if (k === 'ArrowDown') { e.preventDefault(); histNav(1); }
    else if (k === 'Tab') { e.preventDefault(); complete(e.shiftKey ? -1 : 1); }
    else if (k === 'Escape') { e.preventDefault(); input.value = ''; comp = null; }
    else if (e.ctrlKey && lc(k) === 'c' && input.selectionStart === input.selectionEnd) { e.preventDefault(); t.interrupt(); }
    else if (e.ctrlKey && lc(k) === 'l') { e.preventDefault(); t.clear(); }
  });
  input.addEventListener('input', () => { comp = null; });

  function keyAction(k) {
    switch (k) {
      case 'Tab': complete(1); break;
      case 'Esc': input.value = ''; comp = null; break;
      case '^C': active.interrupt(); break;
      case 'Up': histNav(-1); break;
      case 'Down': histNav(1); break;
      case 'Left': case 'Right': {
        const p = Math.max(0, Math.min(input.value.length, (input.selectionStart ?? 0) + (k === 'Left' ? -1 : 1)));
        input.setSelectionRange(p, p); break;
      }
      default: input.setRangeText(k, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length, 'end'); comp = null;
    }
  }
  // Act on touchend (not touchstart) so the bar can still be scrolled; preventDefault keeps the keyboard open.
  let touch = null;
  const pressKey = (b) => { keyAction(b.dataset.k); if (document.activeElement !== input) focusInput(); b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 110); };
  keybar.addEventListener('touchstart', (e) => { const b = e.target.closest('button[data-k]'); touch = b ? { b, x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  keybar.addEventListener('touchmove', (e) => { if (touch && Math.hypot(e.touches[0].clientX - touch.x, e.touches[0].clientY - touch.y) > 10) touch = null; }, { passive: true });
  keybar.addEventListener('touchend', (e) => { if (!touch) return; e.preventDefault(); pressKey(touch.b); touch = null; });
  keybar.addEventListener('mousedown', (e) => { const b = e.target.closest('button[data-k]'); if (b) { e.preventDefault(); pressKey(b); } });

  stage.addEventListener('click', (e) => {
    if (e.target.closest('a,button')) return;
    const sel = getSelection();
    if (sel && !sel.isCollapsed) return;
    focusInput();
  });

  // ---- titlebar & menu ----
  $('#newtab').addEventListener('click', () => { activate(new Tab(settings.profile)); focusInput(); });
  menu.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
  $('#menubtn').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true; });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    menu.hidden = true;
    const a = b.dataset.act;
    if (a === 'pwsh' || a === 'cmd') { activate(new Tab(a)); focusInput(); }
    else if (a === 'settings') openSettings();
    else if (a === 'about' && !active.ctrl) active.submit('about');
  });

  // ---- settings sheet ----
  const selScheme = $('#set-scheme'), selProfile = $('#set-profile'), chkKeys = $('#set-keys'), fsOut = $('#set-fs');
  Object.keys(SCHEMES).forEach((k) => selScheme.append(new Option(k, k)));
  function openSettings() {
    selScheme.value = settings.scheme; selProfile.value = settings.profile; chkKeys.checked = settings.keys; fsOut.textContent = settings.fontSize;
    input.blur(); sheet.hidden = false;
  }
  const commit = () => { saveSettings(); applySettings(); fsOut.textContent = settings.fontSize; };
  selScheme.addEventListener('change', () => { settings.scheme = selScheme.value; commit(); });
  selProfile.addEventListener('change', () => { settings.profile = selProfile.value; commit(); });
  chkKeys.addEventListener('change', () => { settings.keys = chkKeys.checked; commit(); });
  sheet.querySelectorAll('[data-fs]').forEach((b) => b.addEventListener('click', () => { settings.fontSize = Math.max(9, Math.min(24, settings.fontSize + +b.dataset.fs)); commit(); }));
  $('#set-reset').addEventListener('click', () => {
    if (!confirm('Erase all files on the virtual C: drive and restore defaults?')) return;
    root = defaultFS(); flushFS();
    tabs.forEach((t) => { t.cwd = [...HOME]; t.updatePrompt(); });
  });
  $('#set-close').addEventListener('click', () => { sheet.hidden = true; });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });

  // ---- notepad ----
  let edSegs = null, edDirty = false;
  const edLabel = () => { edTitle.textContent = `${edDirty ? '● ' : ''}${edSegs.at(-1)} — Notepad`; };
  function openEditor(segs) {
    const n = getNode(segs);
    edSegs = segs; edText.value = n?.t === 'f' ? n.s : ''; edDirty = false; edLabel();
    input.blur(); editor.hidden = false;
    setTimeout(() => edText.focus(), 0);
  }
  edText.addEventListener('input', () => { if (!edDirty) { edDirty = true; edLabel(); } });
  $('#ed-save').addEventListener('click', () => {
    try { writeFile(active, fmt(edSegs), edText.value, false); flushFS(); edDirty = false; edLabel(); }
    catch (e) { alert(e.message); }
  });
  $('#ed-close').addEventListener('click', () => {
    if (edDirty && !confirm('Discard unsaved changes?')) return;
    editor.hidden = true; edText.blur(); focusInput();
  });

  // ---- iOS viewport / on-screen keyboard ----
  const vv = window.visualViewport;
  function fit() {
    const hgt = vv ? vv.height : innerHeight;
    app.style.height = `${hgt}px`;
    app.style.top = `${vv ? vv.offsetTop : 0}px`;
    app.classList.toggle('kb', innerHeight - hgt > 120);
    active?.scroll();
  }
  vv?.addEventListener('resize', fit);
  vv?.addEventListener('scroll', fit);
  addEventListener('resize', fit);
  addEventListener('orientationchange', () => setTimeout(fit, 300));
  document.addEventListener('focusout', () => setTimeout(fit, 50));

  addEventListener('pagehide', flushFS);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushFS(); });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---- boot ----
  applySettings();
  activate(new Tab(settings.profile));
  fit();
})();
