const stage = document.querySelector("#stage");
const sharp = document.querySelector("#sharp");
const veil = document.querySelector("#veil");

let images = [];
let index = 0;

function imageUrl(name) {
  return `/images/${encodeURIComponent(name)}`;
}

function show() {
  if (images.length === 0) {
    sharp.removeAttribute("src");
    veil.removeAttribute("src");
    return;
  }
  const src = imageUrl(images[index % images.length]);
  sharp.src = src;
  veil.src = src;
  const upcoming = imageUrl(images[(index + 1) % images.length]);
  const preload = new Image();
  preload.src = upcoming;
}

function place(clientX, clientY) {
  const rect = veil.getBoundingClientRect();
  veil.style.setProperty("--x", `${clientX - rect.left}px`);
  veil.style.setProperty("--y", `${clientY - rect.top}px`);
}

stage.addEventListener("pointermove", (event) => {
  place(event.clientX, event.clientY);
});

stage.addEventListener("click", () => {
  if (images.length < 2) return;
  index = (index + 1) % images.length;
  show();
});

async function imageList() {
  try {
    const response = await fetch("/api/images");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    // Static hosts have no folder listing.
  }
  const response = await fetch("/catalog.json");
  if (!response.ok) return [];
  const catalog = await response.json();
  return catalog.images || [];
}

images = await imageList();
show();
place(window.innerWidth / 2, window.innerHeight / 2);
