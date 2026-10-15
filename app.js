const MAX_BLUR = 46;
const INTRO_BLUR = 84;
const INTRO_MS = 3400;
const SWITCH_AT = 0.82;
const RELEASE_AT = 0.28;

const slideA = document.querySelector("#slide-a");
const slideB = document.querySelector("#slide-b");
const meterFill = document.querySelector("#meter-fill");
const camera = document.querySelector("#camera");
const gate = document.querySelector("#start");
const startBtn = gate;
const hint = document.querySelector("#hint");

let images = [];
let index = 0;
let committed = false;
let smoothed = 0;
let openBaseline = 0.18;
let landmarker = null;
let tracking = false;
let ready = false;
let revealing = false;
let starting = false;
let track = null;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(p) {
  return p * p * (3 - 2 * p);
}

function imageUrl(name) {
  return `/images/${encodeURIComponent(name)}`;
}

function applyProgress(p) {
  if (!ready) return;
  const t = smoothstep(clamp(p, 0, 1));
  const blur = Math.sin(Math.PI * t) * MAX_BLUR;
  slideA.style.opacity = "1";
  slideB.style.opacity = String(t);
  slideA.style.filter = `blur(${blur.toFixed(2)}px)`;
  slideB.style.filter = `blur(${blur.toFixed(2)}px)`;
  meterFill.style.width = `${Math.round(t * 100)}%`;
}

function showPair() {
  if (images.length === 0) {
    slideA.removeAttribute("src");
    slideB.removeAttribute("src");
    applyProgress(0);
    return;
  }
  const next = (index + 1) % images.length;
  slideA.src = imageUrl(images[index]);
  slideB.src = imageUrl(images[next]);
}

async function refreshImages() {
  const response = await fetch("/api/images");
  const next = await response.json();
  const same =
    next.length === images.length && next.every((name, i) => name === images[i]);
  if (same) return;
  const currentName = images[index];
  images = next;
  const found = images.indexOf(currentName);
  index = found >= 0 ? found : 0;
  committed = false;
  smoothed = 0;
  showPair();
  applyProgress(0);
}

function advance() {
  if (images.length < 2) {
    committed = false;
    smoothed = 0;
    applyProgress(0);
    return;
  }
  index = (index + 1) % images.length;
  committed = false;
  smoothed = 0;
  showPair();
  applyProgress(0);
}

function setClosure(raw) {
  const target = clamp(raw, 0, 1);
  if (committed) {
    applyProgress(1);
    if (target < RELEASE_AT) advance();
    return;
  }
  smoothed += (target - smoothed) * (target > smoothed ? 0.55 : 0.3);
  if (smoothstep(smoothed) >= SWITCH_AT) {
    committed = true;
    smoothed = 1;
    applyProgress(1);
    return;
  }
  applyProgress(smoothed);
}

function blendscore(categories, name) {
  const hit = categories.find((c) => c.categoryName === name);
  return hit ? hit.score : null;
}

function closureFromResult(result) {
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (categories) {
    const left = blendscore(categories, "eyeBlinkLeft");
    const right = blendscore(categories, "eyeBlinkRight");
    if (left != null && right != null) {
      const blink = (left + right) / 2;
      if (blink < openBaseline + 0.08) {
        openBaseline += (blink - openBaseline) * 0.08;
      }
      return clamp((blink - openBaseline - 0.05) / 0.48, 0, 1);
    }
  }

  const face = result.faceLandmarks?.[0];
  if (!face) return null;
  const ear = (eyeAspect(face, 33, 159, 145, 133) + eyeAspect(face, 263, 386, 374, 362)) / 2;
  return clamp((0.28 - ear) / 0.16, 0, 1);
}

function eyeAspect(face, outer, top, bottom, inner) {
  const width = dist(face[outer], face[inner]);
  const height = dist(face[top], face[bottom]);
  return width > 0 ? height / width : 0;
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function beginReveal() {
  revealing = true;
  ready = false;
  let origin = 0;
  slideB.style.opacity = "0";

  function frame(now) {
    if (!revealing) return;
    if (!origin) origin = now;
    const t = Math.min(1, (now - origin) / INTRO_MS);
    const ease = 1 - (1 - t) ** 3;
    slideA.style.opacity = "1";
    slideA.style.filter = `blur(${(INTRO_BLUR * (1 - ease)).toFixed(2)}px)`;
    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }
    revealing = false;
    ready = true;
    slideA.style.filter = "blur(0px)";
    applyProgress(0);
  }

  requestAnimationFrame(frame);
}

function cancelReveal() {
  revealing = false;
  ready = false;
  slideA.style.opacity = "0";
  slideA.style.filter = "blur(0px)";
}

const FONT_FORMAT = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" };

async function loadFont() {
  const response = await fetch("/api/fonts");
  const files = await response.json();
  const file = files[0];
  if (!file || document.querySelector("style[data-font]")) return;
  const ext = file.split(".").pop().toLowerCase();
  const style = document.createElement("style");
  style.dataset.font = file;
  style.textContent = `@font-face { font-family: "Times Ten"; src: url("/fonts/${encodeURIComponent(file)}") format("${FONT_FORMAT[ext] || "truetype"}"); font-weight: 400; font-style: normal; font-display: swap; }`;
  document.head.appendChild(style);
}

async function loadTrack() {
  const response = await fetch("/api/audio");
  const files = await response.json();
  const file = files.find((name) => name.toLowerCase().endsWith(".mp3")) || files[0];
  if (!file) return;
  const url = `/audio/${encodeURIComponent(file)}`;
  if (track?.dataset.src === url) return;
  const next = new Audio(url);
  next.dataset.src = url;
  next.loop = true;
  next.preload = "auto";
  track = next;
}

function loop() {
  if (ready && tracking && landmarker && camera.readyState >= 2) {
    const result = landmarker.detectForVideo(camera, performance.now());
    const closure = closureFromResult(result);
    if (closure == null) {
      if (!committed) setClosure(0);
    } else {
      setClosure(closure);
    }
  }
  requestAnimationFrame(loop);
}

async function loadLandmarker() {
  const vision = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/vision_bundle.mjs"
  );
  const fileset = await vision.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
  );
  try {
    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, landmarkerOptions("GPU"));
  } catch {
    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, landmarkerOptions("CPU"));
  }
}

async function start() {
  if (starting) return;
  starting = true;
  hint.textContent = "";
  track?.play()?.catch(() => {});
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    });
    camera.srcObject = stream;
    await camera.play();
    beginReveal();
    gate.classList.add("leaving");
    setTimeout(() => {
      if (starting) gate.classList.add("hidden");
    }, 1200);
    await loadLandmarker();
    tracking = true;
  } catch (error) {
    starting = false;
    cancelReveal();
    gate.classList.remove("leaving", "hidden");
    hint.textContent = error?.message || "Camera permission was blocked.";
  }
}

function landmarkerOptions(delegate) {
  return {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate,
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
  };
}

startBtn.addEventListener("click", start);
window.__setEyeClosure = setClosure;
window.__beginReveal = beginReveal;

await Promise.all([refreshImages(), loadFont(), loadTrack()]);
setInterval(() => {
  refreshImages();
  loadFont();
  loadTrack();
}, 2000);
requestAnimationFrame(loop);
