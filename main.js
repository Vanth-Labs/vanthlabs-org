/* vanthlabs.org — option 3. One hand-written script, no dependencies (the lab's 3D figure lives in lab.js).
   1. The sky: a WebGL weather engine (domain-warped noise, four colour stops) fixed behind the page.
      Each section declares data-weather; the sky eases into that palette while the section is in view.
      Without WebGL the CSS sky in styles.css does the same with registered custom properties.
   2. Small behaviours: header state, Hannah's recording (plays only while visible), Complia's review
      sequence, Kbit Slot's relocation tasks, copy buttons, and loading lab.js when the lab gets close. */
(function () {
  'use strict';
  var root = document.documentElement;
  /* the page's language picks the few strings this script writes (the Spanish page is the default) */
  var EN = (root.lang || '').slice(0, 2) === 'en';
  var TX = EN
    ? { lab: 'Lab', contact: 'Contact', pending: 'Evidence pending', approved: 'Reviewed and approved', docPending: 'pending review', docReview: 'under review by the responsible person', docSigned: 'reviewed and signed', task: function (n, p, a, b) { return 'Task ' + n + ' · move ' + p + ' from ' + a + ' to ' + b; }, copied: 'Copied', copyFail: 'Select and copy' }
    : { lab: 'Laboratorio', contact: 'Contacto', pending: 'Evidencia pendiente', approved: 'Revisado y aprobado', docPending: 'pendiente de revisión', docReview: 'en revisión por la persona responsable', docSigned: 'revisado y firmado', task: function (n, p, a, b) { return 'Tarea ' + n + ' · mover ' + p + ' de ' + a + ' a ' + b; }, copied: 'Copiado', copyFail: 'Selecciona y copia' };
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return mq.matches; }

  /* Each product keeps its own colours. Stops: ground, body, light, highlight.
     side: which half of the screen the light leans to (1 right, 0 left), away from the text column.
     dim: how much the field is pulled back toward its ground so text keeps its contrast. */
  var W = {
    vanth:    { name: 'Vanth Labs',  s: ['#120D10', '#2A1220', '#7A2A3A', '#FF6A4D'], side: 1, dim: 0.05 },
    complia:  { name: 'Complia',     s: ['#0E1417', '#202B33', '#286C67', '#D9B779'], side: 1, dim: 0.16 },
    hannah:   { name: 'Hannah',      s: ['#140D13', '#3B2433', '#765569', '#EAE3ED'], side: 0, dim: 0.16 },
    kbit:     { name: 'Kbit Slot',   s: ['#12100D', '#2A241E', '#B8471A', '#F2EEE4'], side: 1, dim: 0.2 },
    cofinder: { name: 'CoFinder',    s: ['#0C0C0C', '#202020', '#575757', '#D9D9D9'], side: 0, dim: 0.3 },
    lab:      { name: TX.lab, s: ['#140A1E', '#4A1A6E', '#B266FF', '#FFC2D1'], side: 1, dim: 0.14 },
    bloom:    { name: TX.contact,    s: ['#1A0B0E', '#B23A48', '#FF6A4D', '#FFB466'], side: 1, dim: 0.2 }
  };
  function rgb(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255]; }

  var current = 'vanth';
  var cur = { s: W.vanth.s.map(rgb), side: 1, dim: W.vanth.dim };
  var tgt = { s: W.vanth.s.map(rgb), side: 1, dim: W.vanth.dim };
  var hudName = document.getElementById('hudName');
  var sky = null;

  function setWeather(key) {
    if (!W[key] || key === current) return;
    current = key;
    var w = W[key];
    tgt = { s: w.s.map(rgb), side: w.side, dim: w.dim };
    for (var i = 0; i < 4; i++) root.style.setProperty('--s' + i, w.s[i]);
    root.style.setProperty('--sx', w.side ? '80%' : '20%');
    if (hudName) hudName.textContent = w.name;
    if (sky && sky.still) sky.kick();
  }

  /* which room is the reader in: the section under 45% of the viewport height */
  var rooms = [].slice.call(document.querySelectorAll('[data-weather]'));
  var bar = document.querySelector('.bar');
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = innerHeight * 0.45;
      for (var i = 0; i < rooms.length; i++) {
        var r = rooms[i].getBoundingClientRect();
        if (r.top <= y && r.bottom > y) { setWeather(rooms[i].getAttribute('data-weather')); break; }
      }
      if (bar) bar.classList.toggle('scrolled', scrollY > 12);
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* ---------- the sky ---------- */
  sky = (function () {
    var cv = document.getElementById('sky');
    if (!cv) return null;
    var gl = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    var NOISE = [
      'vec3 m289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 m289(vec4 x){return x-floor(x*(1./289.))*289.;}',
      'vec4 perm(vec4 x){return m289(((x*34.)+1.)*x);}vec4 tis(vec4 r){return 1.79284291400159-.85373472095314*r;}',
      'float sn(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);',
      'vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=m289(i);',
      'vec4 p=perm(perm(perm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;',
      'vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);',
      'vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));',
      'vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);',
      'vec4 nm=tis(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=nm.x;p1*=nm.y;p2*=nm.z;p3*=nm.w;',
      'vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}',
      'float f3(vec3 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*sn(p);p=p*2.03+vec3(11.7,-4.1,3.3);a*=.5;}return s;}'
    ].join('\n');
    var FRAG = 'precision mediump float;uniform vec2 u_res;uniform float u_time;uniform vec2 u_mouse;' +
      'uniform vec3 u_c0;uniform vec3 u_c1;uniform vec3 u_c2;uniform vec3 u_c3;uniform float u_side;uniform float u_dim;\n' + NOISE + '\n' +
      'void main(){vec2 uv=gl_FragCoord.xy/u_res;vec2 p=uv;p.x*=u_res.x/u_res.y;float t=u_time*.05;' +
      'vec2 q=vec2(f3(vec3(p*1.1,t)),f3(vec3(p*1.1+vec2(5.2,1.3),t*1.1)));' +
      'vec2 r=vec2(f3(vec3(p*1.3+1.6*q+vec2(1.7,9.2),t*.8)),f3(vec3(p*1.3+1.6*q+vec2(8.3,2.8),t*.9)));' +
      'float f=f3(vec3(p+1.6*r,t*.5));float side=mix(1.-uv.x,uv.x,u_side);' +
      'vec3 col=mix(u_c0,u_c1,smoothstep(-.6,.4,f+.2*q.y));' +
      'col=mix(col,u_c2,smoothstep(0.,.75,length(q)+.25*f)*(.5+.5*side));' +
      'col=mix(col,u_c3,smoothstep(.15,.8,r.x+.35*f+.1)*smoothstep(.2,1.,side));' +
      'vec2 m=u_mouse;m.x*=u_res.x/u_res.y;float d=length(p-m);col+=u_c3*exp(-d*d*7.)*.16;' +
      'col=mix(col,u_c0,u_dim);gl_FragColor=vec4(col,1.);}';
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var vs = sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ['u_res', 'u_time', 'u_mouse', 'u_c0', 'u_c1', 'u_c2', 'u_c3', 'u_side', 'u_dim'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });

    var mouse = [0.7, 0.6], mt = [0.7, 0.6], t0 = performance.now(), frozenAt = 9;
    addEventListener('pointermove', function (e) { mt = [e.clientX / innerWidth, 1 - e.clientY / innerHeight]; }, { passive: true });
    /* the field is soft, so it renders at 40% resolution and the browser scales it up */
    function size() {
      var w = Math.max(2, Math.round(innerWidth * 0.4)), h = Math.max(2, Math.round(innerHeight * 0.4));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
    }
    function ease() {
      var k = 0.045;
      for (var i = 0; i < 4; i++) for (var c = 0; c < 3; c++) {
        var d = tgt.s[i][c] - cur.s[i][c];
        if (Math.abs(d) > 0.002) cur.s[i][c] += d * k; else cur.s[i][c] = tgt.s[i][c];
      }
      var ds = tgt.side - cur.side, dd = tgt.dim - cur.dim;
      if (Math.abs(ds) > 0.002 || Math.abs(dd) > 0.002) { cur.side += ds * k; cur.dim += dd * k; } else { cur.side = tgt.side; cur.dim = tgt.dim; }
    }
    function draw(t) {
      size();
      mouse[0] += (mt[0] - mouse[0]) * 0.04; mouse[1] += (mt[1] - mouse[1]) * 0.04;
      gl.uniform2f(U.u_res, cv.width, cv.height); gl.uniform1f(U.u_time, t); gl.uniform2f(U.u_mouse, mouse[0], mouse[1]);
      gl.uniform3fv(U.u_c0, cur.s[0]); gl.uniform3fv(U.u_c1, cur.s[1]); gl.uniform3fv(U.u_c2, cur.s[2]); gl.uniform3fv(U.u_c3, cur.s[3]);
      gl.uniform1f(U.u_side, cur.side); gl.uniform1f(U.u_dim, Math.min(0.6, cur.dim + (innerWidth < 960 ? 0.22 : 0)));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    var api = { still: reduced(), running: false }, last = 0;
    function loop(now) {
      if (document.hidden) { api.running = false; return; }
      /* 30 fps is plenty for a field this slow, and it halves the cost on small machines */
      if (!api.still && now - last < 32) { requestAnimationFrame(loop); return; }
      last = now;
      ease();
      if (api.still) {
        /* reduced motion: no drift; the palette still changes, at once */
        cur.s = tgt.s.map(function (c) { return c.slice(); }); cur.side = tgt.side; cur.dim = tgt.dim;
        draw(frozenAt); api.running = false; return;
      }
      draw((now - t0) / 1000);
      requestAnimationFrame(loop);
    }
    api.kick = function () { if (!api.running) { api.running = true; requestAnimationFrame(loop); } };
    document.addEventListener('visibilitychange', function () { if (!document.hidden) api.kick(); });
    addEventListener('resize', function () { if (api.still) api.kick(); });
    if (mq.addEventListener) mq.addEventListener('change', function () { api.still = reduced(); api.kick(); });
    api.kick();
    cv.classList.add('on');
    return api;
  })();

  onScroll();

  /* run fn while el is on screen (and motion is allowed); stop fn when it leaves */
  function whileVisible(el, threshold, onIn, onOut) {
    if (!el || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && !reduced()) onIn(); else onOut(); });
    }, { threshold: threshold }).observe(el);
  }

  /* ---------- Hannah's recording: plays only while on screen ---------- */
  var vid = document.getElementById('hannahVideo');
  if (vid && 'IntersectionObserver' in window && !reduced()) vid.removeAttribute('controls');
  whileVisible(vid, 0.35,
    function () { var p = vid.play(); if (p && p.catch) p.catch(function () { vid.setAttribute('controls', ''); }); },
    function () { vid.pause(); });

  /* ---------- Complia: evidence pending -> a person signs -> reviewed and approved ---------- */
  var card = document.getElementById('compliaCard');
  if (card) {
    var stateT = card.querySelector('.c-state-t'), doc = card.querySelector('.c-doc');
    var steps = [
      { d: 2600, state: TX.pending, doc: TX.docPending },
      { d: 1800, state: TX.pending, doc: TX.docReview },
      { d: 3200, state: TX.approved, doc: TX.docSigned }
    ];
    var step = 0, cTimer = null;
    var show = function (i) { step = i; card.setAttribute('data-step', String(i)); stateT.textContent = steps[i].state; doc.textContent = steps[i].doc; };
    var next = function () { cTimer = setTimeout(function () { show((step + 1) % steps.length); next(); }, steps[step].d); };
    whileVisible(card, 0.4, function () { clearTimeout(cTimer); next(); }, function () { clearTimeout(cTimer); show(0); });
  }

  /* ---------- Kbit Slot: one relocation task at a time, into an empty slot ---------- */
  var grid = document.getElementById('kbitGrid'), task = document.getElementById('kbitTask');
  if (grid && task) {
    var cells = [].slice.call(grid.querySelectorAll('.kc')), n = 1, kTimer = null;
    var famOf = function (c) { var m = c.className.match(/\bf(\d)\b/); return m ? m[1] : null; };
    var move = function () {
      var empties = cells.filter(function (c) { return c.classList.contains('empty'); });
      var full = cells.filter(function (c) { return !c.classList.contains('empty'); });
      var dst = empties[Math.floor(Math.random() * empties.length)], src = full[Math.floor(Math.random() * full.length)];
      var p = src.getAttribute('data-p');
      task.textContent = TX.task(n, p, src.getAttribute('data-slot'), dst.getAttribute('data-slot'));
      src.classList.add('src'); dst.classList.add('dst');
      kTimer = setTimeout(function () {
        var f = famOf(src);
        dst.classList.remove('empty', 'dst'); dst.classList.add('f' + f); dst.setAttribute('data-p', p);
        src.classList.remove('f' + f, 'src'); src.classList.add('empty'); src.removeAttribute('data-p');
        n = n % 14 + 1;
        kTimer = setTimeout(move, 1300);
      }, 900);
    };
    whileVisible(grid, 0.4, function () { clearTimeout(kTimer); move(); }, function () { clearTimeout(kTimer); });
  }

  /* ---------- the lab: load lab.js (and three.js) only when the section gets close ---------- */
  var lab = document.querySelector('section.lab'), stage = document.getElementById('labStage');
  if (lab && stage) {
    var fail = function () { var f = document.getElementById('labFallback'); if (f) f.hidden = false; };
    var load = function () {
      import('./lab.js').then(function (m) {
        var ok = m.start({
          canvas: document.getElementById('labCanvas'),
          chips: [].slice.call(document.querySelectorAll('[data-phrase]')),
          modes: [].slice.call(document.querySelectorAll('[data-mode]')),
          said: document.getElementById('said'),
          slider: document.getElementById('epoch'),
          out: document.getElementById('epochOut'),
          loss: document.getElementById('loss')
        });
        if (!ok) fail();
      }).catch(fail);
    };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '700px 0px' });
      io.observe(lab);
    } else load();
  }

  /* ---------- copy buttons (the mailto links stay, for people with a mail app) ---------- */
  [].forEach.call(document.querySelectorAll('[data-copy]'), function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy'), label = b.textContent;
      function done(ok) { b.textContent = ok ? TX.copied : TX.copyFail; setTimeout(function () { b.textContent = label; }, 1600); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  });
})();
