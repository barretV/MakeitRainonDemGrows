import * as THREE from 'three';

export type LandmarkSprite =
  | 'stream'
  | 'oak'
  | 'mill'
  | 'wheel'
  | 'aurora'
  | 'igloo'
  | 'icefall'
  | 'bear'
  | 'dunes'
  | 'pillar'
  | 'guardian'
  | 'palm'
  | 'tent'
  | 'mesa'
  | 'barrel'
  | 'reactor'
  | 'pipes'
  | 'shroom'
  | 'cascade'
  | 'chimney'
  | 'coral'
  | 'lighthouse'
  | 'worldtree';

function makeTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

let cache: Record<LandmarkSprite, THREE.CanvasTexture> | null = null;

export function landmarkTextures(): Record<LandmarkSprite, THREE.CanvasTexture> {
  if (cache) return cache;
  cache = {
    stream: drawStream(),
    oak: drawOak(),
    mill: drawMill(),
    wheel: drawWheel(),
    aurora: drawAurora(),
    igloo: drawIgloo(),
    icefall: drawIcefall(),
    bear: drawBear(),
    dunes: drawDunes(),
    pillar: drawPillar(),
    guardian: drawGuardian(),
    palm: drawPalm(),
    tent: drawTent(),
    mesa: drawMesa(),
    barrel: drawBarrel(),
    reactor: drawReactor(),
    pipes: drawPipes(),
    shroom: drawShroom(),
    cascade: drawCascade(),
    chimney: drawChimney(),
    coral: drawCoral(),
    lighthouse: drawLighthouse(),
    worldtree: drawWorldtree(),
  };
  return cache;
}

export function landmarkTexture(id: LandmarkSprite): THREE.CanvasTexture {
  return landmarkTextures()[id];
}

function drawStream(): THREE.CanvasTexture {
  return makeTex(128, 40, (ctx) => {
    oval(ctx, 64, 22, 60, 10, '#3a6a48');
    oval(ctx, 64, 21, 56, 7, '#2f8fd0');
    oval(ctx, 40, 20, 18, 4, '#8fd4f4');
    oval(ctx, 86, 23, 16, 3.2, '#d8f4ff');
    oval(ctx, 28, 24, 6, 3.4, '#8d8a84');
    oval(ctx, 52, 26, 5, 2.8, '#6e6a64');
    oval(ctx, 78, 18, 4.5, 2.4, '#9a968e');
    oval(ctx, 100, 25, 5.5, 3, '#7c7872');
    oval(ctx, 22, 16, 7, 3, '#4ea85a');
    oval(ctx, 108, 15, 6, 2.6, '#6ec86a');
  });
}

function drawOak(): THREE.CanvasTexture {
  return makeTex(64, 80, (ctx) => {
    box(ctx, 28, 48, 8, 28, '#5a3a28');
    box(ctx, 30, 50, 3, 24, '#7a5340');
    oval(ctx, 32, 36, 22, 20, '#1f6a32');
    oval(ctx, 20, 40, 12, 12, '#2f8a40');
    oval(ctx, 44, 38, 13, 13, '#3aaa4e');
    oval(ctx, 32, 24, 14, 10, '#6ed46a');
    oval(ctx, 32, 34, 5.5, 6, '#ff8fb0');
    oval(ctx, 32, 35, 2.4, 2.8, '#ffd0dc');
    oval(ctx, 18, 58, 8, 3, '#3d8a44');
    oval(ctx, 46, 60, 7, 2.6, '#4aa050');
  });
}

function drawMill(): THREE.CanvasTexture {
  return makeTex(64, 80, (ctx) => {
    box(ctx, 16, 36, 32, 36, '#8a5a48');
    box(ctx, 18, 38, 28, 32, '#c48a62');
    ctx.fillStyle = '#6a4030';
    ctx.beginPath();
    ctx.moveTo(12, 38);
    ctx.lineTo(32, 14);
    ctx.lineTo(52, 38);
    ctx.fill();
    box(ctx, 28, 52, 8, 18, '#3a2418');
    box(ctx, 22, 44, 6, 6, '#f0e2a8');
    box(ctx, 36, 44, 6, 6, '#f0e2a8');
    oval(ctx, 32, 22, 4, 3, '#6ec8f0');
  });
}

function drawWheel(): THREE.CanvasTexture {
  return makeTex(48, 48, (ctx) => {
    oval(ctx, 24, 24, 18, 18, '#6a4030');
    oval(ctx, 24, 24, 14, 14, '#e8d2a4');
    oval(ctx, 24, 24, 4, 4, '#5a3424');
    ctx.strokeStyle = '#5a3424';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(24, 8);
    ctx.lineTo(24, 40);
    ctx.moveTo(8, 24);
    ctx.lineTo(40, 24);
    ctx.moveTo(12, 12);
    ctx.lineTo(36, 36);
    ctx.moveTo(36, 12);
    ctx.lineTo(12, 36);
    ctx.stroke();
  });
}

function drawAurora(): THREE.CanvasTexture {
  return makeTex(80, 72, (ctx) => {
    const bands = ['#7dffa8', '#9af0ff', '#e6a0ff', '#fff1a8'];
    bands.forEach((color, i) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 5 - i * 0.4;
      ctx.beginPath();
      ctx.arc(40, 68, 30 - i * 5, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    });
    oval(ctx, 18, 62, 4, 8, '#d7e8f4');
    oval(ctx, 62, 62, 4, 8, '#d7e8f4');
  });
}

function drawIgloo(): THREE.CanvasTexture {
  return makeTex(64, 56, (ctx) => {
    oval(ctx, 32, 36, 24, 16, '#d5e6f4');
    oval(ctx, 32, 34, 22, 14, '#f4fbff');
    ctx.strokeStyle = '#b7c8da';
    ctx.lineWidth = 1;
    for (let y = 26; y <= 44; y += 6) {
      ctx.beginPath();
      ctx.moveTo(12, y);
      ctx.lineTo(52, y);
      ctx.stroke();
    }
    oval(ctx, 32, 42, 6, 7, '#1c2838');
    oval(ctx, 32, 40, 5, 4, '#3a4a62');
    oval(ctx, 46, 30, 3, 2, '#9fd0a8');
  });
}

function drawIcefall(): THREE.CanvasTexture {
  return makeTex(48, 80, (ctx) => {
    box(ctx, 8, 8, 32, 10, '#c5d4e4');
    box(ctx, 14, 16, 8, 58, '#e8f6ff');
    box(ctx, 24, 18, 7, 54, '#b9e4ff');
    box(ctx, 32, 20, 5, 48, '#f7fbff');
    ctx.strokeStyle = '#7eb0d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, 16);
    ctx.lineTo(16, 72);
    ctx.moveTo(30, 18);
    ctx.lineTo(32, 70);
    ctx.stroke();
    oval(ctx, 24, 74, 14, 4, '#d4e8f8');
  });
}

function drawBear(): THREE.CanvasTexture {
  return makeTex(56, 48, (ctx) => {
    oval(ctx, 24, 30, 16, 10, '#f7fbff');
    oval(ctx, 40, 26, 8, 7, '#f4f8ff');
    oval(ctx, 46, 20, 3.2, 3, '#f7fbff');
    oval(ctx, 36, 18, 3, 2.8, '#f7fbff');
    oval(ctx, 12, 34, 4, 3, '#e4eef8');
    oval(ctx, 30, 36, 4, 3, '#e4eef8');
    oval(ctx, 42, 25, 1.3, 1.3, '#1c2430');
    oval(ctx, 47, 27, 1.6, 1.2, '#1c2430');
    oval(ctx, 18, 28, 2, 1.4, '#9ec4de');
  });
}

function drawDunes(): THREE.CanvasTexture {
  return makeTex(96, 48, (ctx) => {
    oval(ctx, 28, 34, 26, 12, '#e6c48a');
    oval(ctx, 62, 30, 30, 14, '#f0d7a4');
    oval(ctx, 78, 36, 18, 8, '#d7b27a');
    ctx.strokeStyle = '#c49a62';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 30);
    ctx.quadraticCurveTo(30, 16, 52, 28);
    ctx.stroke();
    oval(ctx, 40, 22, 2, 5, '#5aaa48');
    oval(ctx, 70, 18, 1.6, 4, '#7ec85a');
    oval(ctx, 22, 26, 1.4, 3.4, '#3e8a40');
  });
}

function drawPillar(): THREE.CanvasTexture {
  return makeTex(32, 80, (ctx) => {
    box(ctx, 6, 8, 20, 6, '#f0d78a');
    box(ctx, 8, 14, 16, 58, '#e7c98a');
    box(ctx, 10, 14, 4, 58, '#f8e6b0');
    box(ctx, 4, 70, 24, 6, '#c9a15e');
    ctx.strokeStyle = '#a07840';
    ctx.lineWidth = 1;
    for (let y = 20; y < 68; y += 10) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(24, y);
      ctx.stroke();
    }
  });
}

function drawGuardian(): THREE.CanvasTexture {
  return makeTex(80, 48, (ctx) => {
    oval(ctx, 34, 30, 22, 10, '#c9a36a');
    oval(ctx, 54, 24, 10, 8, '#e6c48a');
    oval(ctx, 62, 14, 7, 7, '#f2d48a');
    oval(ctx, 58, 22, 1.4, 1.4, '#2a241c');
    oval(ctx, 16, 32, 6, 4, '#b08a58');
    oval(ctx, 46, 36, 5, 3, '#b08a58');
    ctx.strokeStyle = '#8a6238';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 28);
    ctx.lineTo(48, 26);
    ctx.stroke();
  });
}

function drawPalm(): THREE.CanvasTexture {
  return makeTex(64, 80, (ctx) => {
    ctx.strokeStyle = '#8a5a32';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(32, 74);
    ctx.quadraticCurveTo(28, 48, 34, 28);
    ctx.stroke();
    oval(ctx, 18, 26, 14, 4, '#2f8a40');
    oval(ctx, 48, 24, 14, 4, '#3aaa48');
    oval(ctx, 32, 16, 6, 12, '#1f6a32');
    oval(ctx, 24, 20, 10, 3, '#6ed46a');
    oval(ctx, 42, 18, 10, 3, '#8ee67a');
    oval(ctx, 34, 34, 3, 4, '#c9863a');
  });
}

function drawTent(): THREE.CanvasTexture {
  return makeTex(64, 48, (ctx) => {
    ctx.fillStyle = '#e25b4a';
    ctx.beginPath();
    ctx.moveTo(6, 40);
    ctx.lineTo(32, 8);
    ctx.lineTo(58, 40);
    ctx.fill();
    ctx.fillStyle = '#f2c14a';
    ctx.fillRect(6, 36, 52, 6);
    ctx.fillStyle = '#7a3030';
    ctx.beginPath();
    ctx.moveTo(26, 40);
    ctx.lineTo(32, 24);
    ctx.lineTo(38, 40);
    ctx.fill();
    oval(ctx, 14, 38, 4, 2, '#6aaa48');
    oval(ctx, 50, 38, 5, 2.2, '#7ec85a');
  });
}

function drawMesa(): THREE.CanvasTexture {
  return makeTex(72, 64, (ctx) => {
    ctx.fillStyle = '#c49a6a';
    ctx.beginPath();
    ctx.moveTo(8, 56);
    ctx.lineTo(16, 28);
    ctx.lineTo(56, 24);
    ctx.lineTo(66, 56);
    ctx.fill();
    box(ctx, 18, 24, 36, 8, '#e6c48a');
    oval(ctx, 28, 20, 4, 7, '#9a6bff');
    oval(ctx, 40, 16, 3.4, 8, '#6ad4ff');
    oval(ctx, 50, 22, 3, 6, '#ff8ad4');
    oval(ctx, 22, 50, 6, 3, '#5aaa48');
    oval(ctx, 48, 48, 5, 2.4, '#7ec85a');
  });
}

function drawBarrel(): THREE.CanvasTexture {
  return makeTex(40, 48, (ctx) => {
    oval(ctx, 20, 30, 12, 14, '#5a7a38');
    oval(ctx, 20, 16, 10, 4, '#6e8a44');
    ctx.strokeStyle = '#3e5428';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 24);
    ctx.lineTo(32, 24);
    ctx.moveTo(8, 34);
    ctx.lineTo(32, 34);
    ctx.stroke();
    oval(ctx, 14, 12, 4, 3, '#ff8fb0');
    oval(ctx, 24, 8, 3.5, 3, '#ffe08a');
    oval(ctx, 20, 14, 3, 2.4, '#ffffff');
    oval(ctx, 28, 18, 3, 2, '#7cf0d2');
  });
}

function drawReactor(): THREE.CanvasTexture {
  return makeTex(64, 80, (ctx) => {
    box(ctx, 22, 28, 20, 44, '#8a9098');
    box(ctx, 26, 32, 12, 36, '#b7c0c8');
    oval(ctx, 32, 22, 16, 10, '#9aa3aa');
    oval(ctx, 32, 18, 8, 6, '#7cf0d2');
    oval(ctx, 32, 18, 4, 3, '#e8fff8');
    ctx.strokeStyle = '#3aaa48';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, 60);
    ctx.quadraticCurveTo(10, 40, 24, 28);
    ctx.stroke();
    oval(ctx, 16, 62, 8, 4, '#6ed46a');
    oval(ctx, 46, 64, 7, 3, '#ff8fb0');
    oval(ctx, 36, 66, 4, 2.4, '#ffe08a');
    oval(ctx, 24, 68, 4, 2, '#7cf0d2');
  });
}

function drawPipes(): THREE.CanvasTexture {
  return makeTex(96, 64, (ctx) => {
    ctx.strokeStyle = '#7a8a78';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(8, 50);
    ctx.quadraticCurveTo(24, 10, 48, 28);
    ctx.quadraticCurveTo(70, 46, 88, 16);
    ctx.stroke();
    ctx.strokeStyle = '#5aaa6a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(16, 44);
    ctx.quadraticCurveTo(30, 18, 46, 30);
    ctx.stroke();
    oval(ctx, 20, 48, 6, 3, '#6ed46a');
    oval(ctx, 70, 36, 5, 2.6, '#c084fc');
    oval(ctx, 84, 20, 4, 3, '#7cf0d2');
    oval(ctx, 48, 22, 3, 4, '#ffffff');
  });
}

function drawShroom(): THREE.CanvasTexture {
  return makeTex(40, 40, (ctx) => {
    box(ctx, 17, 20, 6, 16, '#f2e6c8');
    oval(ctx, 20, 18, 14, 8, '#7a4ad4');
    oval(ctx, 14, 16, 3, 2.4, '#e6d4ff');
    oval(ctx, 24, 14, 2.4, 2, '#fff');
    oval(ctx, 20, 20, 2, 1.6, '#ffe08a');
  });
}

function drawCascade(): THREE.CanvasTexture {
  return makeTex(48, 80, (ctx) => {
    box(ctx, 6, 6, 36, 12, '#6a8a58');
    box(ctx, 16, 16, 7, 56, '#d8f6ff');
    box(ctx, 24, 18, 6, 52, '#8fd4f4');
    box(ctx, 31, 20, 4, 46, '#ffffff');
    oval(ctx, 12, 30, 3, 6, '#3aaa48');
    oval(ctx, 38, 40, 3, 7, '#6ed46a');
    oval(ctx, 24, 74, 16, 4, '#7ec8a0');
  });
}

function drawChimney(): THREE.CanvasTexture {
  return makeTex(40, 80, (ctx) => {
    box(ctx, 12, 18, 16, 56, '#6a6460');
    box(ctx, 14, 20, 5, 52, '#8a8480');
    box(ctx, 8, 12, 24, 8, '#4a4542');
    oval(ctx, 20, 10, 6, 3, '#3a3836');
    ctx.strokeStyle = '#3aaa48';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, 70);
    ctx.quadraticCurveTo(6, 40, 16, 24);
    ctx.stroke();
    oval(ctx, 10, 66, 6, 3, '#ff8fb0');
    oval(ctx, 28, 70, 5, 2.4, '#ffe08a');
  });
}

function drawCoral(): THREE.CanvasTexture {
  return makeTex(40, 48, (ctx) => {
    ctx.strokeStyle = '#ff8fb0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, 44);
    ctx.lineTo(12, 16);
    ctx.moveTo(20, 40);
    ctx.lineTo(20, 10);
    ctx.moveTo(20, 40);
    ctx.lineTo(30, 14);
    ctx.stroke();
    oval(ctx, 12, 14, 4, 3, '#ffd0dc');
    oval(ctx, 20, 8, 4, 3, '#fff');
    oval(ctx, 30, 12, 4, 3, '#ffb0a0');
    oval(ctx, 16, 28, 3, 2, '#7cf0d2');
  });
}

function drawLighthouse(): THREE.CanvasTexture {
  return makeTex(40, 80, (ctx) => {
    ctx.fillStyle = '#f4f7fb';
    ctx.beginPath();
    ctx.moveTo(10, 70);
    ctx.lineTo(14, 24);
    ctx.lineTo(26, 24);
    ctx.lineTo(30, 70);
    ctx.fill();
    box(ctx, 12, 36, 16, 6, '#e25b4a');
    box(ctx, 12, 50, 16, 6, '#e25b4a');
    box(ctx, 8, 18, 24, 8, '#d7e2ee');
    oval(ctx, 20, 16, 6, 5, '#ffe08a');
    oval(ctx, 20, 16, 3, 2.4, '#fff8d0');
    box(ctx, 6, 70, 28, 6, '#8a9098');
  });
}

function drawWorldtree(): THREE.CanvasTexture {
  return makeTex(72, 96, (ctx) => {
    box(ctx, 32, 50, 8, 40, '#6a4030');
    box(ctx, 34, 52, 3, 36, '#a06a48');
    oval(ctx, 36, 40, 26, 22, '#1f8a48');
    oval(ctx, 18, 46, 14, 12, '#3aaa4e');
    oval(ctx, 54, 44, 14, 13, '#6ed46a');
    oval(ctx, 36, 24, 16, 12, '#b6f28a');
    oval(ctx, 36, 16, 8, 6, '#9af0ff');
    oval(ctx, 28, 20, 4, 3, '#e6a0ff');
    oval(ctx, 46, 18, 3.5, 2.6, '#ffe08a');
    oval(ctx, 22, 78, 8, 3, '#4ea85a');
    oval(ctx, 52, 80, 7, 2.6, '#7ec85a');
    oval(ctx, 36, 34, 4, 5, '#ffd0a8');
  });
}
