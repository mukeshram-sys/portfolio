(() => {
  'use strict';

  // --- Configuration ---
  const TOTAL_FRAMES = 238;
  const FRAME_PREFIX = 'pic/ezgif-frame-';
  const FRAME_EXT = '.png';
  const BG_COLOR = '#0d050b';
  const LERP_FACTOR = 0.08; // Smooth momentum interpolation

  const canvas = document.getElementById('animation-canvas');
  const container = document.querySelector('.scroll-container') || document.body;
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });

  // DOM elements for the 6 sections, navigation dots, and scroll graphics
  const sections = Array.from(document.querySelectorAll('.portfolio-section'));
  const navDots = Array.from(document.querySelectorAll('.nav-dot'));
  const progressBar = document.getElementById('scroll-progress');
  const scrollCue = document.getElementById('scroll-cue');
  const hudCurrent = document.getElementById('hud-current');
  const hudName = document.getElementById('hud-name');
  const SECTION_COUNT = sections.length || 6;
  const SECTION_NAMES = ['About', 'Skills', 'Projects', 'Experience', 'Services', 'Contact'];

  // Preloaded image objects and loading flags
  const images = new Array(TOTAL_FRAMES + 1);
  const loaded = new Uint8Array(TOTAL_FRAMES + 1);
  const loading = new Uint8Array(TOTAL_FRAMES + 1);

  let targetProgress = 0;
  let currentProgress = 0;
  let lastDrawnImage = null;
  let isLoopRunning = false;
  let lastActiveSection = -1;

  // Format index as 3-digit number (001, 002, ..., 238)
  function getFramePath(index) {
    const padded = String(index).padStart(3, '0');
    return `${FRAME_PREFIX}${padded}${FRAME_EXT}`;
  }

  // Preload a specific frame with priority callback
  function loadFrame(index, callback) {
    if (loaded[index]) {
      if (callback) callback(images[index]);
      return;
    }
    if (loading[index]) return;

    loading[index] = 1;
    const img = new Image();
    img.decoding = 'async';
    img.src = getFramePath(index);

    img.onload = () => {
      images[index] = img;
      loaded[index] = 1;
      loading[index] = 0;

      // Re-render immediately if this frame is a better match for the current position
      render();

      if (callback) callback(img);
    };

    img.onerror = () => {
      loading[index] = 0;
      if (callback) callback(null);
    };
  }

  // Find nearest loaded frame so the screen never flickers or goes blank
  function getNearestLoadedImage(targetIdx) {
    if (loaded[targetIdx]) return images[targetIdx];

    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = targetIdx - offset;
      if (prev >= 1 && loaded[prev]) return images[prev];

      const next = targetIdx + offset;
      if (next <= TOTAL_FRAMES && loaded[next]) return images[next];
    }
    return null;
  }

  // Draw image fitted and centered within canvas (preserves 16:9 aspect ratio, seamless fill)
  function renderFrame(img) {
    if (!img) return;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const imgWidth = img.naturalWidth || 1280;
    const imgHeight = img.naturalHeight || 720;
    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvas.width / canvas.height;

    let drawWidth, drawHeight;
    if (canvasRatio > imgRatio) {
      drawHeight = canvas.height;
      drawWidth = canvas.height * imgRatio;
    } else {
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgRatio;
    }

    const x = Math.round((canvas.width - drawWidth) / 2);
    const y = Math.round((canvas.height - drawHeight) / 2);
    const w = Math.round(drawWidth);
    const h = Math.round(drawHeight);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, w, h);
  }

  // Render current canvas frame
  function render() {
    const targetIdx = Math.min(
      TOTAL_FRAMES,
      Math.max(1, Math.round(currentProgress * (TOTAL_FRAMES - 1)) + 1)
    );

    const img = getNearestLoadedImage(targetIdx);
    if (img && img !== lastDrawnImage) {
      renderFrame(img);
      lastDrawnImage = img;
    }
  }

  // Update opacity, scale, and translation of the 6 sections plus scroll indicators
  function updateSections() {
    // 1. Top progress bar
    if (progressBar) {
      progressBar.style.width = (currentProgress * 100).toFixed(2) + '%';
    }

    // 2. Section 1 scroll cue indicator (fades out as user scrolls past first few percent)
    if (scrollCue) {
      const cueOpacity = Math.max(0, 1 - (currentProgress / 0.035));
      scrollCue.style.opacity = cueOpacity.toFixed(3);
      scrollCue.style.transform = `translateY(${(currentProgress * 30).toFixed(1)}px)`;
      scrollCue.style.pointerEvents = cueOpacity > 0.05 ? 'auto' : 'none';
    }

    if (SECTION_COUNT <= 1) return;

    const norm = currentProgress * (SECTION_COUNT - 1);
    const closestIdx = Math.min(SECTION_COUNT - 1, Math.max(0, Math.round(norm)));

    // 3. Update HUD counter & section title
    if (hudCurrent && hudName) {
      hudCurrent.textContent = String(closestIdx + 1).padStart(2, '0');
      hudName.textContent = SECTION_NAMES[closestIdx] || `Phase ${closestIdx + 1}`;
    }

    // 4. Smooth cubic cross-fade & scale for each section
    sections.forEach((sec, idx) => {
      const diff = norm - idx;
      const dist = Math.abs(diff);

      if (dist < 0.75) {
        // Smooth cubic ease for cross-fade
        const t = dist / 0.75;
        const opacity = Math.max(0, 1 - (t * t * (3 - 2 * t)));
        const translateY = diff * 28;
        const scale = 0.97 + (0.03 * opacity);

        sec.style.opacity = opacity.toFixed(3);
        sec.style.transform = `translateY(${translateY.toFixed(1)}px) scale(${scale.toFixed(3)})`;
        sec.style.visibility = opacity > 0.01 ? 'visible' : 'hidden';
        sec.style.pointerEvents = opacity > 0.6 ? 'auto' : 'none';
      } else {
        sec.style.opacity = '0';
        sec.style.visibility = 'hidden';
        sec.style.pointerEvents = 'none';
      }
    });

    if (closestIdx !== lastActiveSection) {
      lastActiveSection = closestIdx;
      navDots.forEach((dot, dIdx) => {
        dot.classList.toggle('active', dIdx === closestIdx);
      });
    }
  }

  // Buttery smooth linear interpolation animation loop
  function animationLoop() {
    const diff = targetProgress - currentProgress;

    if (Math.abs(diff) > 0.00005) {
      currentProgress += diff * LERP_FACTOR;
      render();
      updateSections();
      requestAnimationFrame(animationLoop);
    } else {
      currentProgress = targetProgress;
      render();
      updateSections();
      isLoopRunning = false;
    }
  }

  function startAnimationLoop() {
    if (!isLoopRunning) {
      isLoopRunning = true;
      requestAnimationFrame(animationLoop);
    }
  }

  // Container-relative scroll calculation (drives both canvas & sections)
  function onScroll() {
    const rect = container.getBoundingClientRect();
    const totalDistance = rect.height - window.innerHeight;
    if (totalDistance > 0) {
      targetProgress = Math.min(1, Math.max(0, -rect.top / totalDistance));
    } else {
      targetProgress = 0;
    }

    startAnimationLoop();
    prioritizeFramesAround(Math.round(targetProgress * (TOTAL_FRAMES - 1)) + 1);
  }

  // Responsive high-DPI canvas sizing
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    const newWidth = Math.floor(displayWidth * dpr);
    const newHeight = Math.floor(displayHeight * dpr);

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      canvas.width = newWidth;
      canvas.height = newHeight;
      lastDrawnImage = null; // Invalidate cache so frame is cleanly redrawn at new size
      render();
    }
  }

  // Dot Click Navigation: smoothly scrolls to corresponding section
  navDots.forEach((dot) => {
    dot.addEventListener('click', (e) => {
      e.preventDefault();
      const targetIdx = parseInt(dot.getAttribute('data-target'), 10);
      if (isNaN(targetIdx) || SECTION_COUNT <= 1) return;

      const frac = targetIdx / (SECTION_COUNT - 1);
      const rect = container.getBoundingClientRect();
      const totalDistance = rect.height - window.innerHeight;
      const targetScrollY = window.scrollY + rect.top + (frac * totalDistance);

      window.scrollTo({
        top: Math.round(targetScrollY),
        behavior: 'smooth'
      });
    });
  });

  // --- Dynamic Priority Preloader ---
  const CONCURRENT_DOWNLOADS = 6;
  let activeDownloads = 0;
  const loadQueue = [];

  function processQueue() {
    while (activeDownloads < CONCURRENT_DOWNLOADS && loadQueue.length > 0) {
      const frameIdx = loadQueue.shift();
      if (loaded[frameIdx] || loading[frameIdx]) continue;

      activeDownloads++;
      loadFrame(frameIdx, () => {
        activeDownloads--;
        processQueue();
      });
    }
  }

  // Re-order queue so frames closest to current view position download first
  function prioritizeFramesAround(centerIndex) {
    loadQueue.sort((a, b) => {
      const distA = Math.abs(a - centerIndex);
      const distB = Math.abs(b - centerIndex);
      return distA - distB;
    });
    processQueue();
  }

  function initPreloader() {
    // 1. Immediately load frame 1 and render it as fast as possible
    loadFrame(1, (img) => {
      if (img && !lastDrawnImage) {
        renderFrame(img);
        lastDrawnImage = img;
      }
    });

    // 2. Preload coarse keyframes (every 8th frame) across the whole sequence for instant scrubability
    for (let i = 1; i <= TOTAL_FRAMES; i += 8) {
      if (!loaded[i] && !loadQueue.includes(i)) {
        loadQueue.push(i);
      }
    }

    // 3. Queue all remaining frames
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      if (!loaded[i] && !loadQueue.includes(i)) {
        loadQueue.push(i);
      }
    }

    prioritizeFramesAround(1);
  }

  // Event Listeners (both window and document for maximum compatibility)
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('scroll', onScroll, { passive: true });

  // Initial setup
  resizeCanvas();
  onScroll();
  initPreloader();
  updateSections();
})();
