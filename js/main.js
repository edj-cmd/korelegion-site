/* ===================================================================
   KORE LEGION — main.js
   3D hero scene (Three.js) + scroll choreography (GSAP) + UI
   =================================================================== */
(function () {
  "use strict";

  const hasThree = typeof THREE !== "undefined";
  const hasGSAP = typeof gsap !== "undefined";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------------
     1. NAV — solid background after scrolling past the hero fold
  ---------------------------------------------------------------- */
  const nav = document.getElementById("nav");
  const onScroll = () => {
    if (window.scrollY > 40) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ----------------------------------------------------------------
     2. AGENT CARDS — render from data
  ---------------------------------------------------------------- */
  const grid = document.getElementById("agentGrid");
  const agents = window.KORE_AGENTS || [];
  agents.forEach((a, i) => {
    const card = document.createElement("article");
    card.className = "agent-card";
    card.setAttribute("data-reveal", "");
    card.style.setProperty("--agent-color", a.color);
    card.style.setProperty("--agent-glow", a.glow);
    card.innerHTML = `
      <div class="agent-card__top">
        <span class="agent-card__dot"></span>
        <span class="agent-card__num">0${i + 1}</span>
      </div>
      <h3>${a.name}</h3>
      <p class="agent-card__role">${a.role}</p>
      <p class="agent-card__tag">${a.tag}</p>
      <span class="agent-card__more">Full breakdown <span>&rarr;</span></span>
    `;
    card.addEventListener("click", () => openDrawer(a));
    grid.appendChild(card);
  });

  /* ----------------------------------------------------------------
     3. DRAWER — agent detail panel
  ---------------------------------------------------------------- */
  const drawer = document.getElementById("drawer");
  const drawerContent = document.getElementById("drawerContent");

  function openDrawer(a) {
    drawerContent.innerHTML = `
      <div class="drawer__dot" style="background:${a.color};color:${a.color}"></div>
      <h2>${a.name}</h2>
      <p class="drawer__role" style="color:${a.color}">${a.role}</p>
      <p class="drawer__tagline">${a.intro}</p>
      <p class="drawer__list-label">What ${a.name} does</p>
      <ul class="drawer__list" style="color:${a.color}">
        ${a.does.map((d) => `<li><span style="color:${a.color}"></span>${d}</li>`).join("")}
      </ul>
      <p class="drawer__quote">${a.tagline}</p>
    `;
    drawerContent.querySelectorAll(".drawer__list li").forEach((li) => {
      li.style.color = "var(--text)";
    });
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  drawer.querySelectorAll("[data-close]").forEach((el) =>
    el.addEventListener("click", closeDrawer)
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  /* ----------------------------------------------------------------
     3b. AGENTS IN ACTION — interactive scenario transcripts
  ---------------------------------------------------------------- */
  const scenarios = window.KORE_SCENARIOS || [];
  const actionMenu = document.getElementById("actionMenu");
  const device = document.getElementById("actionDevice");
  if (actionMenu && device && scenarios.length) {
    const deviceName = document.getElementById("deviceName");
    const deviceRole = document.getElementById("deviceRole");
    const deviceContext = document.getElementById("deviceContext");
    const deviceThread = document.getElementById("deviceThread");
    let activeIdx = -1;
    let playTimers = [];

    scenarios.forEach((s, i) => {
      const btn = document.createElement("button");
      btn.className = "action-tab";
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.style.setProperty("--agent-color", s.color);
      btn.style.setProperty("--agent-glow", s.glow);
      btn.innerHTML = `
        <span class="action-tab__dot"></span>
        <span class="action-tab__text">
          <strong>${s.trigger}</strong>
          <em>${s.agent} · ${s.summary}</em>
        </span>`;
      btn.addEventListener("click", () => selectScenario(i));
      actionMenu.appendChild(btn);
    });

    function selectScenario(i) {
      if (i === activeIdx) return;
      activeIdx = i;
      const s = scenarios[i];

      Array.from(actionMenu.children).forEach((b, bi) =>
        b.classList.toggle("is-active", bi === i)
      );

      device.style.setProperty("--agent-color", s.color);
      device.style.setProperty("--agent-glow", s.glow);
      deviceName.textContent = s.agent;
      deviceRole.textContent = s.role;
      deviceContext.textContent = s.summary;

      playTimers.forEach(clearTimeout);
      playTimers = [];
      deviceThread.innerHTML = "";

      s.messages.forEach((m, mi) => {
        const row = document.createElement("div");
        row.className = "bubble bubble--" + m.from;
        row.innerHTML =
          `<div class="bubble__text">${m.text}</div>` +
          (m.meta ? `<div class="bubble__meta">${m.meta}</div>` : "");
        deviceThread.appendChild(row);
        if (reduced) {
          row.classList.add("is-in");
        } else {
          playTimers.push(
            setTimeout(() => row.classList.add("is-in"), 260 + mi * 520)
          );
        }
      });
    }

    // Play the first scenario when the section scrolls into view
    let played = false;
    const actionIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !played) {
            played = true;
            selectScenario(0);
            actionIO.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    actionIO.observe(device);
  }

  /* ----------------------------------------------------------------
     4. REVEAL ON SCROLL — IntersectionObserver
  ---------------------------------------------------------------- */
  const revealEls = () => document.querySelectorAll("[data-reveal]");
  if (reduced) {
    revealEls().forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, idx) => {
          if (entry.isIntersecting) {
            const siblings = Array.from(entry.target.parentElement.children).filter((c) =>
              c.hasAttribute("data-reveal")
            );
            const pos = siblings.indexOf(entry.target);
            entry.target.style.transitionDelay = (pos > 0 ? Math.min(pos * 70, 350) : 0) + "ms";
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls().forEach((el) => io.observe(el));
  }

  /* ----------------------------------------------------------------
     5. COUNT-UP — tier agent counts
  ---------------------------------------------------------------- */
  const counters = document.querySelectorAll("[data-count]");
  const countIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.getAttribute("data-count"), 10);
        let cur = 0;
        const step = Math.max(1, Math.round(target / 28));
        const tick = () => {
          cur = Math.min(target, cur + step);
          el.textContent = cur;
          if (cur < target) requestAnimationFrame(tick);
        };
        tick();
        countIO.unobserve(el);
      });
    },
    { threshold: 0.6 }
  );
  counters.forEach((c) => countIO.observe(c));

  /* ----------------------------------------------------------------
     6. GHOST TIMELINE — progress line scrubs with scroll
  ---------------------------------------------------------------- */
  const timeline = document.getElementById("timeline");
  const tlProgress = document.getElementById("tlProgress");
  if (timeline && tlProgress) {
    const updateTimeline = () => {
      const rect = timeline.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh * 0.5;
      const seen = Math.min(Math.max(vh * 0.75 - rect.top, 0), total);
      const pct = Math.min(100, (seen / rect.height) * 100);
      tlProgress.style.height = pct + "%";
    };
    window.addEventListener("scroll", updateTimeline, { passive: true });
    window.addEventListener("resize", updateTimeline);
    updateTimeline();
  }

  /* ----------------------------------------------------------------
     7. WAITLIST FORM
  ---------------------------------------------------------------- */
  const form = document.getElementById("waitlistForm");
  const note = document.getElementById("waitlistNote");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const tier = data.get("tier");
      note.textContent = `You're on the ${tier} list. We'll be in touch.`;
      note.hidden = false;
      form.reset();
    });
  }

  /* ----------------------------------------------------------------
     8. GSAP — parallax + section choreography (progressive enhancement)
  ---------------------------------------------------------------- */
  if (hasGSAP && !reduced) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.to(".hero__inner", {
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.5 },
      y: 90,
      opacity: 0.2,
      ease: "none",
    });
  }

  /* ================================================================
     9. THREE.JS — the formation, in 3D
  ================================================================ */
  if (!hasThree) return;

  const canvas = document.getElementById("scene");
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 13);

  const root = new THREE.Group();
  root.scale.setScalar(0.82);
  scene.add(root);

  const COLORS = { gold: 0xe0b53d, blue: 0x2d72e0, navy: 0x1d4ea8 };

  // --- glow sprite texture (soft radial) ---
  function glowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,0.6)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = glowTexture();

  // --- formation node positions ---
  const nodes = [
    { p: [0, 2.5, 0], c: COLORS.gold, r: 0.42 },
    { p: [-1.55, 0.5, 0.25], c: COLORS.blue, r: 0.3 },
    { p: [0, 0.5, 0.45], c: COLORS.blue, r: 0.3 },
    { p: [1.55, 0.5, 0.25], c: COLORS.blue, r: 0.3 },
    { p: [-2.6, -1.6, 0], c: COLORS.navy, r: 0.24 },
    { p: [-1.3, -1.6, 0.2], c: COLORS.navy, r: 0.24 },
    { p: [0, -1.6, 0.32], c: COLORS.navy, r: 0.24 },
    { p: [1.3, -1.6, 0.2], c: COLORS.navy, r: 0.24 },
    { p: [2.6, -1.6, 0], c: COLORS.navy, r: 0.24 },
  ];
  const edges = [
    [0, 1], [0, 2], [0, 3],
    [1, 4], [1, 5], [2, 5], [2, 6], [2, 7], [3, 7], [3, 8],
  ];

  const nodeMeshes = [];
  nodes.forEach((n) => {
    const geo = new THREE.SphereGeometry(n.r, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color: n.c });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(n.p[0], n.p[1], n.p[2]);
    root.add(mesh);
    nodeMeshes.push(mesh);

    const spriteMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: n.c,
      transparent: true,
      opacity: n.c === COLORS.gold ? 0.34 : 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    const s = n.r * 3.6;
    sprite.scale.set(s, s, 1);
    mesh.add(sprite);
  });

  // --- connecting lines ---
  const linePts = [];
  edges.forEach(([a, b]) => {
    linePts.push(...nodes[a].p, ...nodes[b].p);
  });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePts, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x2a5cab, transparent: true, opacity: 0.34 });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  root.add(lines);

  // --- ambient particle field ---
  const PCOUNT = 420;
  const pPos = new Float32Array(PCOUNT * 3);
  for (let i = 0; i < PCOUNT; i++) {
    const r = 10 + Math.random() * 16;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
    pPos[i * 3 + 2] = r * Math.cos(phi) - 6;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.Float32BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0x4a90d9,
    size: 0.05,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // --- pointer parallax ---
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // --- resize ---
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // --- scroll-driven scene fade (cheap) ---
  let heroVisible = true;
  const heroEl = document.querySelector(".hero");
  const heroIO = new IntersectionObserver(
    (entries) => entries.forEach((e) => (heroVisible = e.isIntersecting)),
    { threshold: 0.01 }
  );
  if (heroEl) heroIO.observe(heroEl);

  // --- animate loop ---
  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    if (!heroVisible) return;

    t += 0.005;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    root.rotation.y = Math.sin(t * 0.6) * 0.45 + pointer.x * 0.35;
    root.rotation.x = pointer.y * 0.18 + Math.sin(t * 0.4) * 0.04;
    root.position.y = Math.sin(t * 0.8) * 0.12;

    particles.rotation.y += 0.0006;
    particles.rotation.x = pointer.y * 0.05;

    const pulse = 1 + Math.sin(t * 2) * 0.04;
    nodeMeshes[0].scale.setScalar(pulse);

    renderer.render(scene, camera);
  }
  animate();
})();
