<<<<<<< HEAD
const audio = document.getElementById("audio"),
    playBtn = document.getElementById("play"),
    progress = document.getElementById("progress"),
    progressBar = document.getElementById("progress-bar"),
    timeDisplay = document.getElementById("time");
let isPlaying = !1;

function formatTime(e) {
  if (!isFinite(e)) return "0:00";
  return Math.floor(e / 60) + ":" + Math.floor(e % 60).toString().padStart(2, "0");
}

playBtn.addEventListener("click", (async () => {
  isPlaying
    ? (audio.pause(), playBtn.textContent = "▶️")
    : (await audio.play(), playBtn.textContent = "⏸️"),
    isPlaying = !isPlaying;
}));

audio.addEventListener("timeupdate", (() => {
  const e = audio.currentTime / audio.duration * 100;
  progressBar.style.width = (isFinite(e) ? e : 0) + "%";
  timeDisplay.textContent = formatTime(audio.currentTime) + " / " + formatTime(audio.duration);
}));

progress.addEventListener("click", (e => {
  const t = progress.getBoundingClientRect(),
      n = (e.clientX - t.left) / t.width;
  isFinite(audio.duration) && (audio.currentTime = n * audio.duration);
}));

const canvas = document.getElementById("c"),
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !0 });

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene,
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 5e3);

// Cargador para texturas y skybox de galaxia
const loader = new THREE.TextureLoader;

// Crear skybox de galaxia 360 grados con imagen similar a Andrómeda
const galaxyGeometry = new THREE.SphereGeometry(4000, 64, 64);
// Usamos una imagen de galaxia espiral similar a tu referencia
const galaxyTexture = loader.load("https://th.bing.com/th/id/R.f2a650a2644bdbe6442b49de4490d60f?rik=OJjxdLmh9cAdEg&riu=http%3a%2f%2fmisistemasolar.com%2fwp-content%2fuploads%2f2017%2f09%2fvia-lactea8.jpg&ehk=NbXkaG8pzKwlPsTUIgepL8gIJ9jAT%2boxGgD%2f%2fNa4xuY%3d&risl=&pid=ImgRaw&r=0");
// Imagen alternativa: https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=2048
const galaxyMaterial = new THREE.MeshBasicMaterial({ 
  map: galaxyTexture, 
  side: THREE.BackSide,
  transparent: true,
  opacity: 0
});
const galaxySphere = new THREE.Mesh(galaxyGeometry, galaxyMaterial);
scene.add(galaxySphere);

// Crear galaxias adicionales más pequeñas y lejanas para mayor realismo
const smallGalaxy1 = new THREE.Mesh(
  new THREE.SphereGeometry(800, 32, 32),
  new THREE.MeshBasicMaterial({ 
    map: galaxyTexture, 
    side: THREE.BackSide,
    transparent: true,
    opacity: 0
  })
);
smallGalaxy1.position.set(2000, 500, -1000);

const smallGalaxy2 = new THREE.Mesh(
  new THREE.SphereGeometry(600, 32, 32),
  new THREE.MeshBasicMaterial({ 
    map: galaxyTexture, 
    side: THREE.BackSide,
    transparent: true,
    opacity: 0
  })
);
smallGalaxy2.position.set(-1800, -800, 1500);

scene.add(smallGalaxy1);
scene.add(smallGalaxy2);

// --- START: galaxia tipo Vía Láctea simulada y posicionar tu galaxia en el "brazo de Orión" ---
function makeMilkyWayTexture(size = 2048) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  // fondo estelar
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 0.05; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = Math.random() * 1.6;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.9})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // centro galáctico
  const cx = size / 2, cy = size / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
  grd.addColorStop(0, "rgba(255,240,200,1)");
  grd.addColorStop(0.12, "rgba(255,200,140,0.9)");
  grd.addColorStop(0.30, "rgba(200,140,120,0.6)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  // brazos espirales simples (polar)
  const arms = 4;
  for (let a = 0; a < arms; a++) {
    const hue = 220 + Math.random() * 40;
    ctx.strokeStyle = `rgba(${255},${220},${200},0.08)`;
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath();
    for (let t = 0; t < 6 * Math.PI; t += 0.01) {
      const spread = (Math.random() - 0.5) * 20;
      const r = (size * 0.06) + (t * (size * 0.06));
      const angle = t + (a * (2 * Math.PI / arms)) + Math.sin(t * 0.5) * 0.4;
      const x = cx + (r * Math.cos(angle)) + Math.cos(t * 12) * spread;
      const y = cy + (r * Math.sin(angle)) + Math.sin(t * 12) * spread;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      // salpicar algunas estrellas sobre el brazo
      if (Math.random() < 0.06) {
        ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.5})`;
        ctx.fillRect(x, y, 1.2 + Math.random() * 2, 1.2 + Math.random() * 2);
      }
    }
    ctx.stroke();
  }

  // ligera textura de polvo
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3000; i++) {
    const x = cx + (Math.random() - 0.5) * size;
    const y = cy + (Math.random() - 0.5) * size;
    const r = Math.random() * 1.8;
    ctx.fillStyle = `rgba(255,${200 + Math.floor(Math.random() * 55)},${180 + Math.floor(Math.random() * 75)},${0.02 + Math.random() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

const milkyWayGroup = new THREE.Group();
let milkyTex = makeMilkyWayTexture(2048); // textura procedural por defecto
// reemplaza por una imagen tipo la que mostraste (alta resolución)
// si quieres usar tu propio archivo local coloca "textures/milky.jpg" o la URL que prefieras
const milkyImageURL = "https://cdn.eso.org/images/large/eso0932a.jpg";
loader.load(milkyImageURL,
  function (tex) {
    milkyTex = tex;
    if (milkyMat) { milkyMat.map = milkyTex; milkyMat.needsUpdate = true; }
  },
  undefined,
  function (err) { /* si falla, queda la procedural */ }
);

const milkyMat = new THREE.MeshBasicMaterial({ map: milkyTex, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
const milkyPlane = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000, 1, 1), milkyMat);
// inclinar ligeramente para efecto 3D y posicionar detrás
milkyPlane.rotation.x = Math.PI / 2 - 0.12;
milkyPlane.position.set(0, -200, -2200);
milkyWayGroup.add(milkyPlane);
scene.add(milkyWayGroup);

// Mover la "galaxySphere" original para que quede sobre un brazo (brazo de Orión simulado)
scene.remove(galaxySphere); // si ya estaba agregado
// calcular posición en coordenadas del plano (brazo de Orión aproximado)
const thetaOrion = -0.6; // ángulo del brazo
const rOrion = 2200; // distancia desde centro de la Vía Láctea simulada
// colocarlo como hijo para que gire con la Vía Láctea si quieres
galaxySphere.position.set(rOrion * Math.cos(thetaOrion), 40, rOrion * Math.sin(thetaOrion) - 2200);
galaxySphere.scale.set(1.2, 1.2, 1.2);
milkyWayGroup.add(galaxySphere);
// --- END: galaxia tipo Vía Láctea simulada y posicionar tu galaxia en el "brazo de Orión" ---

let targetDist = 300,
    currentDist = 300,
    rotX = .2,
    rotY = 0;

const nebulaTex = loader.load("https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/cube/space/px.jpg");

scene.background = nebulaTex,

function (e = 2e3, t = 3e3) {
  const n = new THREE.BufferGeometry,
      a = new Float32Array(3 * e);
  for (let n = 0; n < e; n++) {
    const e = t * (.3 + .7 * Math.random()),
        r = Math.random() * Math.PI * 2,
        i = Math.acos(2 * Math.random() - 1);
    a[3 * n + 0] = e * Math.sin(i) * Math.cos(r);
    a[3 * n + 1] = e * Math.cos(i);
    a[3 * n + 2] = e * Math.sin(i) * Math.sin(r);
  }
  n.setAttribute("position", new THREE.BufferAttribute(a, 3));
  scene.add(new THREE.Points(n, new THREE.PointsMaterial({ size: 1.5, color: 16777215, depthWrite: !1 })));
}();

const coreMat = new THREE.MeshPhongMaterial({ color: 1118481, transparent: !0, opacity: .6, shininess: 200 }),
    core = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 64), coreMat);

function makeCenterTextTexture(e) {
  const t = document.createElement("canvas");
  t.width = 512;
  t.height = 512;
  const n = t.getContext("2d");
  n.clearRect(0, 0, t.width, t.height);
  n.font = "bold 80px Arial";
  n.textAlign = "center";
  n.textBaseline = "middle";
  n.fillStyle = "#ff0033";
  n.shadowColor = "#ff67Aa";
  n.shadowBlur = 50;
  n.fillText(e, t.width / 2, t.height / 2);
  return new THREE.CanvasTexture(t);
}

scene.add(core);

const centerTex = makeCenterTextTexture("TE AMO ❤️"),
    centerMat = new THREE.SpriteMaterial({ map: centerTex, transparent: !0 }),
    centerSprite = new THREE.Sprite(centerMat);

function makeGlow(e = 768, t = "255,160,0", n = "255,60,0") {
  const a = document.createElement("canvas");
  a.width = a.height = e;
  const r = a.getContext("2d"),
      i = r.createRadialGradient(e / 2, e / 2, .05 * e, e / 2, e / 2, .5 * e);
  i.addColorStop(0, "rgba(" + t + ",0.9)");
  i.addColorStop(.5, "rgba(" + n + ",0.5)");
  i.addColorStop(1, "rgba(0,0,0,0)");
  r.fillStyle = i;
  r.fillRect(0, 0, e, e);
  return new THREE.CanvasTexture(a);
}

centerSprite.scale.set(60, 60, 1);
centerSprite.position.set(0, 0, 0);
centerSprite.renderOrder = 999;
scene.add(centerSprite);

const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlow(), transparent: !0, depthWrite: !1 }));

function ringTexture(e = 768) {
  const t = document.createElement("canvas");
  t.width = t.height = e;
  const n = t.getContext("2d");
  n.translate(e / 2, e / 2);
  const a = .34 * e,
      r = .49 * e,
      i = n.createRadialGradient(0, 0, .3 * a, 0, 0, r);
  i.addColorStop(0, "rgba(255,255,200,1)");
  i.addColorStop(.3, "rgba(255,160,60,0.9)");
  i.addColorStop(.65, "rgba(255,80,0,0.6)");
  i.addColorStop(1, "rgba(24, 40, 184, 0)");
  n.fillStyle = i;
  n.beginPath();
  n.arc(0, 0, r, 0, 2 * Math.PI);
  n.arc(0, 0, a, 0, 2 * Math.PI, !0);
  n.closePath();
  n.fill();
  return new THREE.CanvasTexture(t);
}

glow.scale.set(500, 500, 1);
scene.add(glow);

const ring1 = new THREE.Mesh(
  new THREE.RingGeometry(60, 80, 128),
  new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: !0, side: THREE.DoubleSide })
),
ring2 = new THREE.Mesh(
  new THREE.RingGeometry(85, 100, 128),
  new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: !0, side: THREE.DoubleSide, opacity: .6 })
);

ring1.rotation.x = ring2.rotation.x = Math.PI / 2;
scene.add(ring1);
scene.add(ring2);

const WORDS = [],
    baseWords = [
  "💖 Mi amor", "🌞 Mi sol", "🌎 Mi mundo", "✨ Brillas", "❤️ Te amo", "🌌 Universo", "👑 Reina", "🌠 Estrella",
  "💫 Mi cielo", "🔥 Siempre tú", "🎶 Tu risa", "🦋 Libertad", "💎 Eres todo", "🙏 Gracias", "💕 Cariño", "🌹 Amor eterno",
  "🤗 Abrazos", "🌸 Esperanza", "🌈 Alegría", "🌟 Contigo", "🧸 Ternura", "🎁 Mi razón", "🌙 Mi destino", "💌 Recuerdos",
  "🕊️ Mi paz", "🪐 Mi universo", "🌊 Mi calma", "💡 Mi luz", "🍒 Dulzura", "🥰 Mi vida", "🎇 Felicidad", "🌻 Alegría",
  "🌺 Mi flor", "💜 Eternidad", "🌟 Sueños", "✨ Magia", "🎵 Canción", "🔥 Pasión", "⭐ Mi estrella", "🌴 Mi paraíso",
  "🌄 Amanecer", "🌃 Noche contigo", "🎉 Mi fiesta", "💫 Inspiración", "🌷 Siempre juntos", "🎀 Mi ternura", "🍀 Mi fortuna", "🪞 Mi reflejo"
];

for (let e = 0; e < 6; e++) WORDS.push(...baseWords);

function makeTextTexture(e, t) {
  const n = document.createElement("canvas");
  n.width = 512;
  n.height = 128;
  const a = n.getContext("2d");
  a.clearRect(0, 0, n.width, n.height);
  a.font = "bold 60px Arial";
  a.textAlign = "center";
  a.textBaseline = "middle";
  a.fillStyle = "#fff";
  a.shadowColor = t;
  a.shadowBlur = 30;
  a.fillText(e, n.width / 2, n.height / 2);
  return new THREE.CanvasTexture(n);
}

const COLORS = ["#ff66ff", "#66ccff", "#ffd36b", "#ff9966", "#8df59a", "#ffa0f8", "#c7A7ff", "#ff4444", "#44ff99", "#99ccff"],
    textGroup = new THREE.Group();

scene.add(textGroup);

for (let e = 0; e < WORDS.length; e++) {
  const t = makeTextTexture(WORDS[e], COLORS[e % COLORS.length]),
      n = new THREE.SpriteMaterial({ map: t, transparent: !0 }),
      a = new THREE.Sprite(n);
  a.scale.set(50, 16, 1);
  const r = Math.acos(2 * Math.random() - 1),
      i = Math.random() * Math.PI * 2,
      o = 150 + 120 * Math.random();
  a.position.set(o * Math.sin(r) * Math.cos(i), o * Math.cos(r), o * Math.sin(r) * Math.sin(i));
  a.userData = { phi: r, theta: i, radius: o, speed: .001 + .001 * Math.random() };
  textGroup.add(a);
}

let dragging = !1,
    lastX = 0,
    lastY = 0;

function onDown(e) {
  dragging = !0;
  const t = e.touches ? e.touches[0] : e;
  lastX = t.clientX;
  lastY = t.clientY;
}

function onMove(e) {
  if (!dragging) return;
  const t = e.touches ? e.touches[0] : e,
      n = (t.clientX - lastX) / innerWidth,
      a = (t.clientY - lastY) / innerHeight;
  rotY -= 3 * n;
  rotX = Math.max(-1.2, Math.min(1.2, rotX - 2.2 * a));
  lastX = t.clientX;
  lastY = t.clientY;
}

function onUp() {
  dragging = !1;
}

addEventListener("mousedown", onDown);
addEventListener("mousemove", onMove);
addEventListener("mouseup", onUp);
addEventListener("touchstart", onDown, { passive: !0 });
addEventListener("touchmove", onMove, { passive: !0 });
addEventListener("touchend", onUp, { passive: !0 });

addEventListener("wheel", (e => {
  targetDist += .25 * e.deltaY;
  targetDist = Math.max(160, Math.min(1500, targetDist)); // Aumenté más el máximo para ver mejor las galaxias
}), { passive: !0 });

let pinch = 0;

addEventListener("touchmove", (e => {
  if (e.touches && 2 === e.touches.length) {
    e.preventDefault();
    const t = e.touches[0].clientX - e.touches[1].clientX,
        n = e.touches[0].clientY - e.touches[1].clientY,
        a = Math.hypot(t, n);
    pinch && (targetDist += .5 * (pinch - a), targetDist = Math.max(160, Math.min(1500, targetDist)));
    pinch = a;
  }
}), { passive: !1 });

addEventListener("touchend", (() => {
  pinch = 0;
}), { passive: !0 });

let t = 0;

function tick() {
  requestAnimationFrame(tick);
  t += .01;
  ring1.rotation.z += .002;
  ring2.rotation.z -= .0015;
  glow.scale.set(500 * (1 + .03 * Math.sin(.4 * t)), 500 * (1 + .03 * Math.sin(.4 * t)), 1);
  const e = 1 + .05 * Math.sin(3 * t);
  core.scale.set(e, e, e);
  
  // Calcular la opacidad de las galaxias basada en la distancia (aparecen más pronto)
  const galaxyOpacity = Math.max(0, Math.min(0.9, (currentDist - 500) / 300));
  galaxyMaterial.opacity = galaxyOpacity;
  smallGalaxy1.material.opacity = galaxyOpacity * 0.7;
  smallGalaxy2.material.opacity = galaxyOpacity * 0.6;
  
  // Rotar las galaxias lentamente
  galaxySphere.rotation.y += 0.0003;
  galaxySphere.rotation.x += 0.0001;
  smallGalaxy1.rotation.y -= 0.0002;
  smallGalaxy1.rotation.z += 0.0001;
  smallGalaxy2.rotation.y += 0.0001;
  smallGalaxy2.rotation.x -= 0.0001;
  
  // Hacer que los elementos principales se vean más pequeños cuando te alejas
  const scaleBasedOnDistance = Math.max(0.2, 1 - (currentDist - 300) / 1000);
  textGroup.scale.set(scaleBasedOnDistance, scaleBasedOnDistance, scaleBasedOnDistance);
  core.scale.set(e * scaleBasedOnDistance, e * scaleBasedOnDistance, e * scaleBasedOnDistance);
  ring1.scale.set(scaleBasedOnDistance, scaleBasedOnDistance, scaleBasedOnDistance);
  ring2.scale.set(scaleBasedOnDistance, scaleBasedOnDistance, scaleBasedOnDistance);
  glow.scale.set(500 * (1 + .03 * Math.sin(.4 * t)) * scaleBasedOnDistance, 500 * (1 + .03 * Math.sin(.4 * t)) * scaleBasedOnDistance, 1);
  centerSprite.scale.set(60 * scaleBasedOnDistance, 60 * scaleBasedOnDistance, 1);
  
  textGroup.children.forEach((e => {
    e.material.opacity = .8 + .2 * Math.sin(2 * t);
    e.userData.theta += e.userData.speed;
    e.position.x = e.userData.radius * Math.sin(e.userData.phi) * Math.cos(e.userData.theta);
    e.position.z = e.userData.radius * Math.sin(e.userData.phi) * Math.sin(e.userData.theta);
  }));
  
  currentDist += .06 * (targetDist - currentDist);
  const n = Math.cos(rotX),
        a = Math.sin(rotX),
        r = Math.cos(rotY),
        i = Math.sin(rotY);
  camera.position.set(currentDist * i * n, currentDist * a, currentDist * r * n);
  camera.lookAt(0, 0, 0);

  // aparición / animación de la Vía Láctea simulada al alejar
  const mwFadeStart = 450, mwFadeEnd = 1100;
  const mwOpacity = Math.max(0, Math.min(1, (currentDist - mwFadeStart) / (mwFadeEnd - mwFadeStart)));
  if (milkyMat) milkyMat.opacity = mwOpacity * 0.95;
  milkyPlane.rotation.z += 0.0001 + 0.00005 * Math.sin(t * 0.6);

  renderer.render(scene, camera);
}

tick();
=======
<<<<<<< HEAD
const audio = document.getElementById("audio"),
    playBtn = document.getElementById("play"),
    progress = document.getElementById("progress"),
    progressBar = document.getElementById("progress-bar"),
    timeDisplay = document.getElementById("time");
let isPlaying = !1;

function formatTime(e) {
  if (!isFinite(e)) return "0:00";
  return Math.floor(e / 60) + ":" + Math.floor(e % 60).toString().padStart(2, "0");
}

playBtn.addEventListener("click", (async () => {
  isPlaying
    ? (audio.pause(), playBtn.textContent = "▶️")
    : (await audio.play(), playBtn.textContent = "⏸️"),
    isPlaying = !isPlaying;
}));

audio.addEventListener("timeupdate", (() => {
  const e = audio.currentTime / audio.duration * 100;
  progressBar.style.width = (isFinite(e) ? e : 0) + "%";
  timeDisplay.textContent = formatTime(audio.currentTime) + " / " + formatTime(audio.duration);
}));

progress.addEventListener("click", (e => {
  const t = progress.getBoundingClientRect(),
      n = (e.clientX - t.left) / t.width;
  isFinite(audio.duration) && (audio.currentTime = n * audio.duration);
}));

const canvas = document.getElementById("c"),
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !0 });

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene,
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 5e3);

// Cargador para texturas y skybox de galaxia
const loader = new THREE.TextureLoader;

// Crear skybox de galaxia 360 grados con imagen similar a Andrómeda
const galaxyGeometry = new THREE.SphereGeometry(4000, 64, 64);
// Usamos una imagen de galaxia espiral similar a tu referencia
const galaxyTexture = loader.load("https://th.bing.com/th/id/R.f2a650a2644bdbe6442b49de4490d60f?rik=OJjxdLmh9cAdEg&riu=http%3a%2f%2fmisistemasolar.com%2fwp-content%2fuploads%2f2017%2f09%2fvia-lactea8.jpg&ehk=NbXkaG8pzKwlPsTUIgepL8gIJ9jAT%2boxGgD%2f%2fNa4xuY%3d&risl=&pid=ImgRaw&r=0");
// Imagen alternativa: https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=2048
const galaxyMaterial = new THREE.MeshBasicMaterial({ 
  map: galaxyTexture, 
  side: THREE.BackSide,
  transparent: true,
  opacity: 0
});
const galaxySphere = new THREE.Mesh(galaxyGeometry, galaxyMaterial);
scene.add(galaxySphere);

// Crear galaxias adicionales más pequeñas y lejanas para mayor realismo
const smallGalaxy1 = new THREE.Mesh(
  new THREE.SphereGeometry(800, 32, 32),
  new THREE.MeshBasicMaterial({ 
    map: galaxyTexture, 
    side: THREE.BackSide,
    transparent: true,
    opacity: 0
  })
);
smallGalaxy1.position.set(2000, 500, -1000);

const smallGalaxy2 = new THREE.Mesh(
  new THREE.SphereGeometry(600, 32, 32),
  new THREE.MeshBasicMaterial({ 
    map: galaxyTexture, 
    side: THREE.BackSide,
    transparent: true,
    opacity: 0
  })
);
smallGalaxy2.position.set(-1800, -800, 1500);

scene.add(smallGalaxy1);
scene.add(smallGalaxy2);

// --- START: galaxia tipo Vía Láctea simulada y posicionar tu galaxia en el "brazo de Orión" ---
function makeMilkyWayTexture(size = 2048) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  // fondo estelar
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 0.05; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = Math.random() * 1.6;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.9})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // centro galáctico
  const cx = size / 2, cy = size / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
  grd.addColorStop(0, "rgba(255,240,200,1)");
  grd.addColorStop(0.12, "rgba(255,200,140,0.9)");
  grd.addColorStop(0.30, "rgba(200,140,120,0.6)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  // brazos espirales simples (polar)
  const arms = 4;
  for (let a = 0; a < arms; a++) {
    const hue = 220 + Math.random() * 40;
    ctx.strokeStyle = `rgba(${255},${220},${200},0.08)`;
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath();
    for (let t = 0; t < 6 * Math.PI; t += 0.01) {
      const spread = (Math.random() - 0.5) * 20;
      const r = (size * 0.06) + (t * (size * 0.06));
      const angle = t + (a * (2 * Math.PI / arms)) + Math.sin(t * 0.5) * 0.4;
      const x = cx + (r * Math.cos(angle)) + Math.cos(t * 12) * spread;
      const y = cy + (r * Math.sin(angle)) + Math.sin(t * 12) * spread;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      // salpicar algunas estrellas sobre el brazo
      if (Math.random() < 0.06) {
        ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.5})`;
        ctx.fillRect(x, y, 1.2 + Math.random() * 2, 1.2 + Math.random() * 2);
      }
    }
    ctx.stroke();
  }

  // ligera textura de polvo
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3000; i++) {
    const x = cx + (Math.random() - 0.5) * size;
    const y = cy + (Math.random() - 0.5) * size;
    const r = Math.random() * 1.8;
    ctx.fillStyle = `rgba(255,${200 + Math.floor(Math.random() * 55)},${180 + Math.floor(Math.random() * 75)},${0.02 + Math.random() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

const milkyWayGroup = new THREE.Group();
let milkyTex = makeMilkyWayTexture(2048); // textura procedural por defecto
// reemplaza por una imagen tipo la que mostraste (alta resolución)
// si quieres usar tu propio archivo local coloca "textures/milky.jpg" o la URL que prefieras
const milkyImageURL = "https://cdn.eso.org/images/large/eso0932a.jpg";
loader.load(milkyImageURL,
  function (tex) {
    milkyTex = tex;
    if (milkyMat) { milkyMat.map = milkyTex; milkyMat.needsUpdate = true; }
  },
  undefined,
  function (err) { /* si falla, queda la procedural */ }
);

const milkyMat = new THREE.MeshBasicMaterial({ map: milkyTex, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
const milkyPlane = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000, 1, 1), milkyMat);
// inclinar ligeramente para efecto 3D y posicionar detrás
milkyPlane.rotation.x = Math.PI / 2 - 0.12;
milkyPlane.position.set(0, -200, -2200);
milkyWayGroup.add(milkyPlane);
scene.add(milkyWayGroup);

// Mover la "galaxySphere" original para que quede sobre un brazo (brazo de Orión simulado)
scene.remove(galaxySphere); // si ya estaba agregado
// calcular posición en coordenadas del plano (brazo de Orión aproximado)
const thetaOrion = -0.6; // ángulo del brazo
const rOrion = 2200; // distancia desde centro de la Vía Láctea simulada
// colocarlo como hijo para que gire con la Vía Láctea si quieres
galaxySphere.position.set(rOrion * Math.cos(thetaOrion), 40, rOrion * Math.sin(thetaOrion) - 2200);
galaxySphere.scale.set(1.2, 1.2, 1.2);
milkyWayGroup.add(galaxySphere);
// --- END: galaxia tipo Vía Láctea simulada y posicionar tu galaxia en el "brazo de Orión" ---

let targetDist = 300,
    currentDist = 300,
    rotX = .2,
    rotY = 0;

const nebulaTex = loader.load("https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/cube/space/px.jpg");

scene.background = nebulaTex,

function (e = 2e3, t = 3e3) {
  const n = new THREE.BufferGeometry,
      a = new Float32Array(3 * e);
  for (let n = 0; n < e; n++) {
    const e = t * (.3 + .7 * Math.random()),
        r = Math.random() * Math.PI * 2,
        i = Math.acos(2 * Math.random() - 1);
    a[3 * n + 0] = e * Math.sin(i) * Math.cos(r);
    a[3 * n + 1] = e * Math.cos(i);
    a[3 * n + 2] = e * Math.sin(i) * Math.sin(r);
  }
  n.setAttribute("position", new THREE.BufferAttribute(a, 3));
  scene.add(new THREE.Points(n, new THREE.PointsMaterial({ size: 1.5, color: 16777215, depthWrite: !1 })));
}();

const coreMat = new THREE.MeshPhongMaterial({ color: 1118481, transparent: !0, opacity: .6, shininess: 200 }),
    core = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 64), coreMat);

function makeCenterTextTexture(e) {
  const t = document.createElement("canvas");
  t.width = 512;
  t.height = 512;
  const n = t.getContext("2d");
  n.clearRect(0, 0, t.width, t.height);
  n.font = "bold 80px Arial";
  n.textAlign = "center";
  n.textBaseline = "middle";
  n.fillStyle = "#ff0033";
  n.shadowColor = "#ff67Aa";
  n.shadowBlur = 50;
  n.fillText(e, t.width / 2, t.height / 2);
  return new THREE.CanvasTexture(t);
}

scene.add(core);

const centerTex = makeCenterTextTexture("TE AMO ❤️"),
    centerMat = new THREE.SpriteMaterial({ map: centerTex, transparent: !0 }),
    centerSprite = new THREE.Sprite(centerMat);

function makeGlow(e = 768, t = "255,160,0", n = "255,60,0") {
  const a = document.createElement("canvas");
  a.width = a.height = e;
  const r = a.getContext("2d"),
      i = r.createRadialGradient(e / 2, e / 2, .05 * e, e / 2, e / 2, .5 * e);
  i.addColorStop(0, "rgba(" + t + ",0.9)");
  i.addColorStop(.5, "rgba(" + n + ",0.5)");
  i.addColorStop(1, "rgba(0,0,0,0)");
  r.fillStyle = i;
  r.fillRect(0, 0, e, e);
  return new THREE.CanvasTexture(a);
}

centerSprite.scale.set(60, 60, 1);
centerSprite.position.set(0, 0, 0);
centerSprite.renderOrder = 999;
scene.add(centerSprite);

const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlow(), transparent: !0, depthWrite: !1 }));

function ringTexture(e = 768) {
  const t = document.createElement("canvas");
  t.width = t.height = e;
  const n = t.getContext("2d");
  n.translate(e / 2, e / 2);
  const a = .34 * e,
      r = .49 * e,
      i = n.createRadialGradient(0, 0, .3 * a, 0, 0, r);
  i.addColorStop(0, "rgba(255,255,200,1)");
  i.addColorStop(.3, "rgba(255,160,60,0.9)");
  i.addColorStop(.65, "rgba(255,80,0,0.6)");
  i.addColorStop(1, "rgba(24, 40, 184, 0)");
  n.fillStyle = i;
  n.beginPath();
  n.arc(0, 0, r, 0, 2 * Math.PI);
  n.arc(0, 0, a, 0, 2 * Math.PI, !0);
  n.closePath();
  n.fill();
  return new THREE.CanvasTexture(t);
}

glow.scale.set(500, 500, 1);
scene.add(glow);

const ring1 = new THREE.Mesh(
  new THREE.RingGeometry(60, 80, 128),
  new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: !0, side: THREE.DoubleSide })
),
ring2 = new THREE.Mesh(
  new THREE.RingGeometry(85, 100, 128),
  new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: !0, side: THREE.DoubleSide, opacity: .6 })
);

ring1.rotation.x = ring2.rotation.x = Math.PI / 2;
scene.add(ring1);
scene.add(ring2);

const WORDS = [],
    baseWords = [
  "💖 Mi amor", "🌞 Mi sol", "🌎 Mi mundo", "✨ Brillas", "❤️ Te amo", "🌌 Universo", "👑 Reina", "🌠 Estrella",
  "💫 Mi cielo", "🔥 Siempre tú", "🎶 Tu risa", "🦋 Libertad", "💎 Eres todo", "🙏 Gracias", "💕 Cariño", "🌹 Amor eterno",
  "🤗 Abrazos", "🌸 Esperanza", "🌈 Alegría", "🌟 Contigo", "🧸 Ternura", "🎁 Mi razón", "🌙 Mi destino", "💌 Recuerdos",
  "🕊️ Mi paz", "🪐 Mi universo", "🌊 Mi calma", "💡 Mi luz", "🍒 Dulzura", "🥰 Mi vida", "🎇 Felicidad", "🌻 Alegría",
  "🌺 Mi flor", "💜 Eternidad", "🌟 Sueños", "✨ Magia", "🎵 Canción", "🔥 Pasión", "⭐ Mi estrella", "🌴 Mi paraíso",
  "🌄 Amanecer", "🌃 Noche contigo", "🎉 Mi fiesta", "💫 Inspiración", "🌷 Siempre juntos", "🎀 Mi ternura", "🍀 Mi fortuna", "🪞 Mi reflejo"
];

for (let e = 0; e < 6; e++) WORDS.push(...baseWords);

function makeTextTexture(e, t) {
  const n = document.createElement("canvas");
  n.width = 512;
  n.height = 128;
  const a = n.getContext("2d");
  a.clearRect(0, 0, n.width, n.height);
  a.font = "bold 60px Arial";
  a.textAlign = "center";
  a.textBaseline = "middle";
  a.fillStyle = "#fff";
  a.shadowColor = t;
  a.shadowBlur = 30;
  a.fillText(e, n.width / 2, n.height / 2);
  return new THREE.CanvasTexture(n);
}

const COLORS = ["#ff66ff", "#66ccff", "#ffd36b", "#ff9966", "#8df59a", "#ffa0f8", "#c7A7ff", "#ff4444", "#44ff99", "#99ccff"],
    textGroup = new THREE.Group();

scene.add(textGroup);

for (let e = 0; e < WORDS.length; e++) {
  const t = makeTextTexture(WORDS[e], COLORS[e % COLORS.length]),
      n = new THREE.SpriteMaterial({ map: t, transparent: !0 }),
      a = new THREE.Sprite(n);
  a.scale.set(50, 16, 1);
  const r = Math.acos(2 * Math.random() - 1),
      i = Math.random() * Math.PI * 2,
      o = 150 + 120 * Math.random();
  a.position.set(o * Math.sin(r) * Math.cos(i), o * Math.cos(r), o * Math.sin(r) * Math.sin(i));
  a.userData = { phi: r, theta: i, radius: o, speed: .001 + .001 * Math.random() };
  textGroup.add(a);
}

let dragging = !1,
    lastX = 0,
    lastY = 0;

function onDown(e) {
  dragging = !0;
  const t = e.touches ? e.touches[0] : e;
  lastX = t.clientX;
  lastY = t.clientY;
}

function onMove(e) {
  if (!dragging) return;
  const t = e.touches ? e.touches[0] : e,
      n = (t.clientX - lastX) / innerWidth,
      a = (t.clientY - lastY) / innerHeight;
  rotY -= 3 * n;
  rotX = Math.max(-1.2, Math.min(1.2, rotX - 2.2 * a));
  lastX = t.clientX;
  lastY = t.clientY;
}

function onUp() {
  dragging = !1;
}

addEventListener("mousedown", onDown);
addEventListener("mousemove", onMove);
addEventListener("mouseup", onUp);
addEventListener("touchstart", onDown, { passive: !0 });
addEventListener("touchmove", onMove, { passive: !0 });
addEventListener("touchend", onUp, { passive: !0 });

addEventListener("wheel", (e => {
  targetDist += .25 * e.deltaY;
  targetDist = Math.max(160, Math.min(1500, targetDist)); // Aumenté más el máximo para ver mejor las galaxias
}), { passive: !0 });

let pinch = 0;

addEventListener("touchmove", (e => {
  if (e.touches && 2 === e.touches.length) {
    e.preventDefault();
    const t = e.touches[0].clientX - e.touches[1].clientX,
        n = e.touches[0].clientY - e.touches[1].clientY,
        a = Math.hypot(t, n);
    pinch && (targetDist += .5 * (pinch - a), targetDist = Math.max(160, Math.min(1500, targetDist)));
    pinch = a;
  }
}), { passive: !1 });

addEventListener("touchend", (() => {
  pinch = 0;
}), { passive: !0 });

let t = 0;

function tick() {
  requestAnimationFrame(tick);
  t += .01;
  ring1.rotation.z += .002;
  ring2.rotation.z -= .0015;
  glow.scale.set(500 * (1 + .03 * Math.sin(.4 * t)), 500 * (1 + .03 * Math.sin(.4 * t)), 1);
  const e = 1 + .05 * Math.sin(3 * t);
  core.scale.set(e, e, e);
  
  // Calcular la opacidad de las galaxias basada en la distancia (aparecen más pronto)
  const galaxyOpacity = Math.max(0, Math.min(0.9, (currentDist - 500) / 300));
  galaxyMaterial.opacity = galaxyOpacity;
  smallGalaxy1.material.opacity = galaxyOpacity * 0.7;
  smallGalaxy2.material.opacity = galaxyOpacity * 0.6;
  
  // Rotar las galaxias lentamente
  galaxySphere.rotation.y += 0.0003;
  galaxySphere.rotation.x += 0.0001;
  smallGalaxy1.rotation.y -= 0.0002;
  smallGalaxy1.rotation.z += 0.0001;
  smallGalaxy2.rotation.y += 0.0001;
  smallGalaxy2.rotation.x -= 0.0001;
  
  // Hacer que los elementos principales se vean más pequeños cuando te alejas
  const scaleBasedOnDistance = Math.max(0.2, 1 - (currentDist - 300) / 1000);
  textGroup.scale.set(scaleBasedOnDistance, scaleBasedOnDistance, scaleBasedOnDistance);
  core.scale.set(e * scaleBasedOnDistance, e * scaleBasedOnDistance, e * scaleBasedOnDistance);
  ring1.scale.set(scaleBasedOnDistance, scaleBasedOnDistance, scaleBasedOnDistance);
  ring2.scale.set(scaleBasedOnDistance, scaleBasedOnDistance, scaleBasedOnDistance);
  glow.scale.set(500 * (1 + .03 * Math.sin(.4 * t)) * scaleBasedOnDistance, 500 * (1 + .03 * Math.sin(.4 * t)) * scaleBasedOnDistance, 1);
  centerSprite.scale.set(60 * scaleBasedOnDistance, 60 * scaleBasedOnDistance, 1);
  
  textGroup.children.forEach((e => {
    e.material.opacity = .8 + .2 * Math.sin(2 * t);
    e.userData.theta += e.userData.speed;
    e.position.x = e.userData.radius * Math.sin(e.userData.phi) * Math.cos(e.userData.theta);
    e.position.z = e.userData.radius * Math.sin(e.userData.phi) * Math.sin(e.userData.theta);
  }));
  
  currentDist += .06 * (targetDist - currentDist);
  const n = Math.cos(rotX),
        a = Math.sin(rotX),
        r = Math.cos(rotY),
        i = Math.sin(rotY);
  camera.position.set(currentDist * i * n, currentDist * a, currentDist * r * n);
  camera.lookAt(0, 0, 0);

  // aparición / animación de la Vía Láctea simulada al alejar
  const mwFadeStart = 450, mwFadeEnd = 1100;
  const mwOpacity = Math.max(0, Math.min(1, (currentDist - mwFadeStart) / (mwFadeEnd - mwFadeStart)));
  if (milkyMat) milkyMat.opacity = mwOpacity * 0.95;
  milkyPlane.rotation.z += 0.0001 + 0.00005 * Math.sin(t * 0.6);

  renderer.render(scene, camera);
}

tick();
=======
const audio = document.getElementById("audio"),
    playBtn = document.getElementById("play"),
    progress = document.getElementById("progress"),
    progressBar = document.getElementById("progress-bar"),
    timeDisplay = document.getElementById("time");
let isPlaying = !1;

function formatTime(e) {
  if (!isFinite(e)) return "0:00";
  return Math.floor(e / 60) + ":" + Math.floor(e % 60).toString().padStart(2, "0");
}

playBtn.addEventListener("click", (async () => {
  isPlaying
    ? (audio.pause(), playBtn.textContent = "▶️")
    : (await audio.play(), playBtn.textContent = "⏸️"),
    isPlaying = !isPlaying;
}));

audio.addEventListener("timeupdate", (() => {
  const e = audio.currentTime / audio.duration * 100;
  progressBar.style.width = (isFinite(e) ? e : 0) + "%";
  timeDisplay.textContent = formatTime(audio.currentTime) + " / " + formatTime(audio.duration);
}));

progress.addEventListener("click", (e => {
  const t = progress.getBoundingClientRect(),
      n = (e.clientX - t.left) / t.width;
  isFinite(audio.duration) && (audio.currentTime = n * audio.duration);
}));

const canvas = document.getElementById("c"),
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !0 });

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene,
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 5e3);

// Cargador para texturas y skybox de galaxia
const loader = new THREE.TextureLoader;

// Crear skybox de galaxia 360 grados con imagen similar a Andrómeda
const galaxyGeometry = new THREE.SphereGeometry(4000, 64, 64);
// Usamos una imagen de galaxia espiral similar a tu referencia
const galaxyTexture = loader.load("https://th.bing.com/th/id/R.f2a650a2644bdbe6442b49de4490d60f?rik=OJjxdLmh9cAdEg&riu=http%3a%2f%2fmisistemasolar.com%2fwp-content%2fuploads%2f2017%2f09%2fvia-lactea8.jpg&ehk=NbXkaG8pzKwlPsTUIgepL8gIJ9jAT%2boxGgD%2f%2fNa4xuY%3d&risl=&pid=ImgRaw&r=0");
// Imagen alternativa: https://images.unsplash.com/photo-1446776877081-d282a0f896e2?w=2048
const galaxyMaterial = new THREE.MeshBasicMaterial({ 
  map: galaxyTexture, 
  side: THREE.BackSide,
  transparent: true,
  opacity: 0
});
const galaxySphere = new THREE.Mesh(galaxyGeometry, galaxyMaterial);
scene.add(galaxySphere);

// Crear galaxias adicionales más pequeñas y lejanas para mayor realismo
const smallGalaxy1 = new THREE.Mesh(
  new THREE.SphereGeometry(800, 32, 32),
  new THREE.MeshBasicMaterial({ 
    map: galaxyTexture, 
    side: THREE.BackSide,
    transparent: true,
    opacity: 0
  })
);
smallGalaxy1.position.set(2000, 500, -1000);

const smallGalaxy2 = new THREE.Mesh(
  new THREE.SphereGeometry(600, 32, 32),
  new THREE.MeshBasicMaterial({ 
    map: galaxyTexture, 
    side: THREE.BackSide,
    transparent: true,
    opacity: 0
  })
);
smallGalaxy2.position.set(-1800, -800, 1500);

scene.add(smallGalaxy1);
scene.add(smallGalaxy2);

// --- START: galaxia tipo Vía Láctea simulada y posicionar tu galaxia en el "brazo de Orión" ---
function makeMilkyWayTexture(size = 2048) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  // fondo estelar
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 0.05; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = Math.random() * 1.6;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.9})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // centro galáctico
  const cx = size / 2, cy = size / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
  grd.addColorStop(0, "rgba(255,240,200,1)");
  grd.addColorStop(0.12, "rgba(255,200,140,0.9)");
  grd.addColorStop(0.30, "rgba(200,140,120,0.6)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  // brazos espirales simples (polar)
  const arms = 4;
  for (let a = 0; a < arms; a++) {
    const hue = 220 + Math.random() * 40;
    ctx.strokeStyle = `rgba(${255},${220},${200},0.08)`;
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath();
    for (let t = 0; t < 6 * Math.PI; t += 0.01) {
      const spread = (Math.random() - 0.5) * 20;
      const r = (size * 0.06) + (t * (size * 0.06));
      const angle = t + (a * (2 * Math.PI / arms)) + Math.sin(t * 0.5) * 0.4;
      const x = cx + (r * Math.cos(angle)) + Math.cos(t * 12) * spread;
      const y = cy + (r * Math.sin(angle)) + Math.sin(t * 12) * spread;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      // salpicar algunas estrellas sobre el brazo
      if (Math.random() < 0.06) {
        ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.random() * 0.5})`;
        ctx.fillRect(x, y, 1.2 + Math.random() * 2, 1.2 + Math.random() * 2);
      }
    }
    ctx.stroke();
  }

  // ligera textura de polvo
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3000; i++) {
    const x = cx + (Math.random() - 0.5) * size;
    const y = cy + (Math.random() - 0.5) * size;
    const r = Math.random() * 1.8;
    ctx.fillStyle = `rgba(255,${200 + Math.floor(Math.random() * 55)},${180 + Math.floor(Math.random() * 75)},${0.02 + Math.random() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

const milkyWayGroup = new THREE.Group();
let milkyTex = makeMilkyWayTexture(2048); // textura procedural por defecto
// reemplaza por una imagen tipo la que mostraste (alta resolución)
// si quieres usar tu propio archivo local coloca "textures/milky.jpg" o la URL que prefieras
const milkyImageURL = "https://cdn.eso.org/images/large/eso0932a.jpg";
loader.load(milkyImageURL,
  function (tex) {
    milkyTex = tex;
    if (milkyMat) { milkyMat.map = milkyTex; milkyMat.needsUpdate = true; }
  },
  undefined,
  function (err) { /* si falla, queda la procedural */ }
);

const milkyMat = new THREE.MeshBasicMaterial({ map: milkyTex, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
const milkyPlane = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000, 1, 1), milkyMat);
// inclinar ligeramente para efecto 3D y posicionar detrás
milkyPlane.rotation.x = Math.PI / 2 - 0.12;
milkyPlane.position.set(0, -200, -2200);
milkyWayGroup.add(milkyPlane);
scene.add(milkyWayGroup);

// Mover la "galaxySphere" original para que quede sobre un brazo (brazo de Orión simulado)
scene.remove(galaxySphere); // si ya estaba agregado
// calcular posición en coordenadas del plano (brazo de Orión aproximado)
const thetaOrion = -0.6; // ángulo del brazo
const rOrion = 2200; // distancia desde centro de la Vía Láctea simulada
// colocarlo como hijo para que gire con la Vía Láctea si quieres
galaxySphere.position.set(rOrion * Math.cos(thetaOrion), 40, rOrion * Math.sin(thetaOrion) - 2200);
galaxySphere.scale.set(1.2, 1.2, 1.2);
milkyWayGroup.add(galaxySphere);
// --- END: galaxia tipo Vía Láctea simulada y posicionar tu galaxia en el "brazo de Orión" ---

let targetDist = 300,
    currentDist = 300,
    rotX = .2,
    rotY = 0;

const nebulaTex = loader.load("https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/cube/space/px.jpg");

scene.background = nebulaTex,

function (e = 2e3, t = 3e3) {
  const n = new THREE.BufferGeometry,
      a = new Float32Array(3 * e);
  for (let n = 0; n < e; n++) {
    const e = t * (.3 + .7 * Math.random()),
        r = Math.random() * Math.PI * 2,
        i = Math.acos(2 * Math.random() - 1);
    a[3 * n + 0] = e * Math.sin(i) * Math.cos(r);
    a[3 * n + 1] = e * Math.cos(i);
    a[3 * n + 2] = e * Math.sin(i) * Math.sin(r);
  }
  n.setAttribute("position", new THREE.BufferAttribute(a, 3));
  scene.add(new THREE.Points(n, new THREE.PointsMaterial({ size: 1.5, color: 16777215, depthWrite: !1 })));
}();

const coreMat = new THREE.MeshPhongMaterial({ color: 1118481, transparent: !0, opacity: .6, shininess: 200 }),
    core = new THREE.Mesh(new THREE.SphereGeometry(40, 64, 64), coreMat);

function makeCenterTextTexture(e) {
  const t = document.createElement("canvas");
  t.width = 512;
  t.height = 512;
  const n = t.getContext("2d");
  n.clearRect(0, 0, t.width, t.height);
  n.font = "bold 80px Arial";
  n.textAlign = "center";
  n.textBaseline = "middle";
  n.fillStyle = "#ff0033";
  n.shadowColor = "#ff67Aa";
  n.shadowBlur = 50;
  n.fillText(e, t.width / 2, t.height / 2);
  return new THREE.CanvasTexture(t);
}

scene.add(core);

const centerTex = makeCenterTextTexture("TE AMO ❤️"),
    centerMat = new THREE.SpriteMaterial({ map: centerTex, transparent: !0 }),
    centerSprite = new THREE.Sprite(centerMat);

function makeGlow(e = 768, t = "255,160,0", n = "255,60,0") {
  const a = document.createElement("canvas");
  a.width = a.height = e;
  const r = a.getContext("2d"),
      i = r.createRadialGradient(e / 2, e / 2, .05 * e, e / 2, e / 2, .5 * e);
  i.addColorStop(0, "rgba(" + t + ",0.9)");
  i.addColorStop(.5, "rgba(" + n + ",0.5)");
  i.addColorStop(1, "rgba(0,0,0,0)");
  r.fillStyle = i;
  r.fillRect(0, 0, e, e);
  return new THREE.CanvasTexture(a);
}

centerSprite.scale.set(60, 60, 1);
centerSprite.position.set(0, 0, 0);
centerSprite.renderOrder = 999;
scene.add(centerSprite);

const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlow(), transparent: !0, depthWrite: !1 }));

function ringTexture(e = 768) {
  const t = document.createElement("canvas");
  t.width = t.height = e;
  const n = t.getContext("2d");
  n.translate(e / 2, e / 2);
  const a = .34 * e,
      r = .49 * e,
      i = n.createRadialGradient(0, 0, .3 * a, 0, 0, r);
  i.addColorStop(0, "rgba(255,255,200,1)");
  i.addColorStop(.3, "rgba(255,160,60,0.9)");
  i.addColorStop(.65, "rgba(255,80,0,0.6)");
  i.addColorStop(1, "rgba(24, 40, 184, 0)");
  n.fillStyle = i;
  n.beginPath();
  n.arc(0, 0, r, 0, 2 * Math.PI);
  n.arc(0, 0, a, 0, 2 * Math.PI, !0);
  n.closePath();
  n.fill();
  return new THREE.CanvasTexture(t);
}

glow.scale.set(500, 500, 1);
scene.add(glow);

const ring1 = new THREE.Mesh(
  new THREE.RingGeometry(60, 80, 128),
  new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: !0, side: THREE.DoubleSide })
),
ring2 = new THREE.Mesh(
  new THREE.RingGeometry(85, 100, 128),
  new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: !0, side: THREE.DoubleSide, opacity: .6 })
);

ring1.rotation.x = ring2.rotation.x = Math.PI / 2;
scene.add(ring1);
scene.add(ring2);

const WORDS = [],
    baseWords = [
  "💖 Mi amor", "🌞 Mi sol", "🌎 Mi mundo", "✨ Brillas", "❤️ Te amo", "🌌 Universo", "👑 Reina", "🌠 Estrella",
  "💫 Mi cielo", "🔥 Siempre tú", "🎶 Tu risa", "🦋 Libertad", "💎 Eres todo", "🙏 Gracias", "💕 Cariño", "🌹 Amor eterno",
  "🤗 Abrazos", "🌸 Esperanza", "🌈 Alegría", "🌟 Contigo", "🧸 Ternura", "🎁 Mi razón", "🌙 Mi destino", "💌 Recuerdos",
  "🕊️ Mi paz", "🪐 Mi universo", "🌊 Mi calma", "💡 Mi luz", "🍒 Dulzura", "🥰 Mi vida", "🎇 Felicidad", "🌻 Alegría",
  "🌺 Mi flor", "💜 Eternidad", "🌟 Sueños", "✨ Magia", "🎵 Canción", "🔥 Pasión", "⭐ Mi estrella", "🌴 Mi paraíso",
  "🌄 Amanecer", "🌃 Noche contigo", "🎉 Mi fiesta", "💫 Inspiración", "🌷 Siempre juntos", "🎀 Mi ternura", "🍀 Mi fortuna", "🪞 Mi reflejo"
];

for (let e = 0; e < 6; e++) WORDS.push(...baseWords);

function makeTextTexture(e, t) {
  const n = document.createElement("canvas");
  n.width = 512;
  n.height = 128;
  const a = n.getContext("2d");
  a.clearRect(0, 0, n.width, n.height);
  a.font = "bold 60px Arial";
  a.textAlign = "center";
  a.textBaseline = "middle";
  a.fillStyle = "#fff";
  a.shadowColor = t;
  a.shadowBlur = 30;
  a.fillText(e, n.width / 2, n.height / 2);
  return new THREE.CanvasTexture(n);
}

const COLORS = ["#ff66ff", "#66ccff", "#ffd36b", "#ff9966", "#8df59a", "#ffa0f8", "#c7A7ff", "#ff4444", "#44ff99", "#99ccff"],
    textGroup = new THREE.Group();

scene.add(textGroup);

for (let e = 0; e < WORDS.length; e++) {
  const t = makeTextTexture(WORDS[e], COLORS[e % COLORS.length]),
      n = new THREE.SpriteMaterial({ map: t, transparent: !0 }),
      a = new THREE.Sprite(n);
  a.scale.set(50, 16, 1);
  const r = Math.acos(2 * Math.random() - 1),
      i = Math.random() * Math.PI * 2,
      o = 150 + 120 * Math.random();
  a.position.set(o * Math.sin(r) * Math.cos(i), o * Math.cos(r), o * Math.sin(r) * Math.sin(i));
  a.userData = { phi: r, theta: i, radius: o, speed: .001 + .001 * Math.random() };
  textGroup.add(a);
}

let dragging = !1,
    lastX = 0,
    lastY = 0;

function onDown(e) {
  dragging = !0;
  const t = e.touches ? e.touches[0] : e;
  lastX = t.clientX;
  lastY = t.clientY;
}

function onMove(e) {
  if (!dragging) return;
  const t = e.touches ? e.touches[0] : e,
      n = (t.clientX - lastX) / innerWidth,
      a = (t.clientY - lastY) / innerHeight;
  rotY -= 3 * n;
  rotX = Math.max(-1.2, Math.min(1.2, rotX - 2.2 * a));
  lastX = t.clientX;
  lastY = t.clientY;
}

function onUp() {
  dragging = !1;
}

addEventListener("mousedown", onDown);
addEventListener("mousemove", onMove);
addEventListener("mouseup", onUp);
addEventListener("touchstart", onDown, { passive: !0 });
addEventListener("touchmove", onMove, { passive: !0 });
addEventListener("touchend", onUp, { passive: !0 });

addEventListener("wheel", (e => {
  targetDist += .25 * e.deltaY;
  targetDist = Math.max(160, Math.min(1500, targetDist)); // Aumenté más el máximo para ver mejor las galaxias
}), { passive: !0 });

let pinch = 0;

addEventListener("touchmove", (e => {
  if (e.touches && 2 === e.touches.length) {
    e.preventDefault();
    const t = e.touches[0].clientX - e.touches[1].clientX,
        n = e.touches[0].clientY - e.touches[1].clientY,
        a = Math.hypot(t, n);
    pinch && (targetDist += .5 * (pinch - a), targetDist = Math.max(160, Math.min(1500, targetDist)));
    pinch = a;
  }
}), { passive: !1 });

addEventListener("touchend", (() => {
  pinch = 0;
}), { passive: !0 });

let t = 0;

function tick() {
  requestAnimationFrame(tick);
  t += .01;
  ring1.rotation.z += .002;
  ring2.rotation.z -= .0015;
  glow.scale.set(500 * (1 + .03 * Math.sin(.4 * t)), 500 * (1 + .03 * Math.sin(.4 * t)), 1);
  const e = 1 + .05 * Math.sin(3 * t);
  core.scale.set(e, e, e);
  
  // Calcular la opacidad de las galaxias basada en la distancia (aparecen más pronto)
  const galaxyOpacity = Math.max(0, Math.min(0.9, (currentDist - 500) / 300));
  galaxyMaterial.opacity = galaxyOpacity;
  smallGalaxy1.material.opacity = galaxyOpacity * 0.7;
  smallGalaxy2.material.opacity = galaxyOpacity * 0.6;
  
  // Rotar las galaxias lentamente
  galaxySphere.rotation.y += 0.0003;
  galaxySphere.rotation.x += 0.0001;
  smallGalaxy1.rotation.y -= 0.0002;
  smallGalaxy1.rotation.z += 0.0001;
  smallGalaxy2.rotation.y += 0.0001;
  smallGalaxy2.rotation.x -= 0.0001;
  
  // Hacer que los elementos principales se vean más pequeños cuando te alejas
  const scaleBasedOnDistance = Math.max(0.2, 1 - (currentDist - 300) / 1000);
  textGroup.scale.set(scaleBasedOnDistance, scaleBasedOnDistance, scaleBasedOnDistance);
  core.scale.set(e * scaleBasedOnDistance, e * scaleBasedOnDistance, e * scaleBasedOnDistance);
  ring1.scale.set(scaleBasedOnDistance, scaleBasedOnDistance, scaleBasedOnDistance);
  ring2.scale.set(scaleBasedOnDistance, scaleBasedOnDistance, scaleBasedOnDistance);
  glow.scale.set(500 * (1 + .03 * Math.sin(.4 * t)) * scaleBasedOnDistance, 500 * (1 + .03 * Math.sin(.4 * t)) * scaleBasedOnDistance, 1);
  centerSprite.scale.set(60 * scaleBasedOnDistance, 60 * scaleBasedOnDistance, 1);
  
  textGroup.children.forEach((e => {
    e.material.opacity = .8 + .2 * Math.sin(2 * t);
    e.userData.theta += e.userData.speed;
    e.position.x = e.userData.radius * Math.sin(e.userData.phi) * Math.cos(e.userData.theta);
    e.position.z = e.userData.radius * Math.sin(e.userData.phi) * Math.sin(e.userData.theta);
  }));
  
  currentDist += .06 * (targetDist - currentDist);
  const n = Math.cos(rotX),
        a = Math.sin(rotX),
        r = Math.cos(rotY),
        i = Math.sin(rotY);
  camera.position.set(currentDist * i * n, currentDist * a, currentDist * r * n);
  camera.lookAt(0, 0, 0);

  // aparición / animación de la Vía Láctea simulada al alejar
  const mwFadeStart = 450, mwFadeEnd = 1100;
  const mwOpacity = Math.max(0, Math.min(1, (currentDist - mwFadeStart) / (mwFadeEnd - mwFadeStart)));
  if (milkyMat) milkyMat.opacity = mwOpacity * 0.95;
  milkyPlane.rotation.z += 0.0001 + 0.00005 * Math.sin(t * 0.6);

  renderer.render(scene, camera);
}

tick();
>>>>>>> afb3a0bb4e9f636cfff1381f4f42d2095747f0af
>>>>>>> 609fc5fff91c0bf23953ae5b8b5034c5ab4e3510
