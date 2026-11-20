import * as THREE from 'three';

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  anisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.max(1, anisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createKitchenTileTexture(anisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#E8EFE0';
  ctx.fillRect(0, 0, 256, 256);

  const tile = 64;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const isAlt = (row + col) % 2 === 0;
      ctx.fillStyle = isAlt ? '#DCE7CF' : '#F3EFE4';
      ctx.fillRect(col * tile + 2, row * tile + 2, tile - 4, tile - 4);
    }
  }

  // Subtle grout lines
  ctx.strokeStyle = '#C7D3BA';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tile, 0);
    ctx.lineTo(i * tile, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * tile);
    ctx.lineTo(256, i * tile);
    ctx.stroke();
  }

  return finalizeTexture(canvas, 6, 4, anisotropy);
}

export function createWoodPlankTexture(anisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#DFC39B';
  ctx.fillRect(0, 0, 256, 256);

  const plankH = 32;
  const tones = ['#D9BA8E', '#E3C79E', '#D3B285', '#DFC197'];
  for (let row = 0; row < 8; row++) {
    ctx.fillStyle = tones[row % tones.length];
    ctx.fillRect(0, row * plankH + 1, 256, plankH - 2);

    // Grain streaks
    ctx.strokeStyle = 'rgba(138, 96, 52, 0.14)';
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 3; g++) {
      const y = row * plankH + 6 + g * 8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + 2, 160, y - 2, 256, y);
      ctx.stroke();
    }

    // Plank seam
    ctx.strokeStyle = '#B59062';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, row * plankH);
    ctx.lineTo(256, row * plankH);
    ctx.stroke();

    // Vertical joint stagger
    const jointX = ((row * 96) % 200) + 28;
    ctx.beginPath();
    ctx.moveTo(jointX, row * plankH);
    ctx.lineTo(jointX, (row + 1) * plankH);
    ctx.stroke();
  }

  return finalizeTexture(canvas, 5, 3, anisotropy);
}

export function createBambooWeaveTexture(anisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#D2A66E';
  ctx.fillRect(0, 0, 128, 128);

  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = y % 32 === 0 ? '#C49257' : '#DDB47D';
    ctx.fillRect(0, y, 128, 13);
  }
  for (let x = 0; x < 128; x += 24) {
    ctx.fillStyle = 'rgba(110, 74, 34, 0.18)';
    ctx.fillRect(x, 0, 4, 128);
  }

  return finalizeTexture(canvas, 2, 2, anisotropy);
}

export function createAwningTexture(anisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const stripeW = 32;
  for (let x = 0; x < 256; x += stripeW) {
    ctx.fillStyle = (x / stripeW) % 2 === 0 ? '#244D3B' : '#F6EBD4';
    ctx.fillRect(x, 0, stripeW, 128);
  }

  return finalizeTexture(canvas, 2, 1, anisotropy);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(28, 53, 41, 0.42)');
  grad.addColorStop(0.65, 'rgba(28, 53, 41, 0.16)');
  grad.addColorStop(1, 'rgba(28, 53, 41, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMenuChalkboardTexture(
  decoLevel: 1 | 2 | 3,
  festivalTitle: string | null = null,
  anisotropy = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep chalkboard slate green background
  ctx.fillStyle = '#1E3A2F';
  ctx.fillRect(0, 0, 512, 256);

  // Subtle chalk dust frame
  ctx.strokeStyle = decoLevel >= 2 ? '#ED9B53' : '#D9E8C8';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, 484, 228);

  // Header
  ctx.fillStyle = '#FAF5EA';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DIMSUM SEHAT', 256, 64);

  // Sub-banner (Festival highlight or Cozy Artisan Tier)
  ctx.fillStyle = festivalTitle ? '#ED9B53' : '#9ED1A2';
  ctx.font = 'bold 20px sans-serif';
  const subText = festivalTitle
    ? `FESTIVAL: ${festivalTitle.toUpperCase().slice(0, 28)}`
    : decoLevel === 3
      ? 'ARTISAN KUKUS HERBAL · PREMIUM'
      : decoLevel === 2
        ? 'FRESH STEAMED DAILY · WARM TEA'
        : 'KUKUS SEGAR SETIAP HARI';
  ctx.fillText(subText, 256, 102);

  // Divider line
  ctx.strokeStyle = 'rgba(250, 245, 234, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 122);
  ctx.lineTo(448, 122);
  ctx.stroke();

  // Menu items chalkboard calligraphy hints
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F6EBD4';
  ctx.font = '600 18px sans-serif';
  ctx.fillText('• Ayam Wortel Segar', 58, 162);
  ctx.fillText('• Udang Sayur Rendah Garam', 58, 198);
  ctx.fillStyle = '#D9E8C8';
  ctx.fillText('• Tahu Jamur Shiitake', 290, 162);
  ctx.fillText('• Sayur Pelangi Kukus', 290, 198);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, anisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createWovenRugTexture(anisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#DFEAD1';
  ctx.fillRect(0, 0, 256, 256);

  // Woven outer border
  ctx.strokeStyle = '#6E9B72';
  ctx.lineWidth = 18;
  ctx.strokeRect(18, 18, 220, 220);

  ctx.strokeStyle = '#ED9B53';
  ctx.lineWidth = 5;
  ctx.strokeRect(34, 34, 188, 188);

  // Subtle horizontal weave lines
  ctx.fillStyle = 'rgba(36, 77, 59, 0.08)';
  for (let y = 44; y < 212; y += 12) {
    ctx.fillRect(42, y, 172, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, anisotropy);
  tex.needsUpdate = true;
  return tex;
}

