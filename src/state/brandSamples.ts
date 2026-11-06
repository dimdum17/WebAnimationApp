/*
 * Procedurally drawn branding material (logo, palette, type specimen, stationery, ...)
 * for a fictional brand, used as offline sample images.
 */
const BRAND = 'Nexora';
const C = { deep: '#0b6b3a', green: '#16a34a', lime: '#5be37d', mint: '#dcfce7', ink: '#0f1a14', paper: '#f6f8f6' };
const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

type G = CanvasRenderingContext2D;

function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** The brand mark: a 2x2 cluster of linked dots. */
function mark(g: G, cx: number, cy: number, s: number, c1 = C.deep, c2 = C.lime) {
  const d = s * 0.32;
  const pts: [number, number, string][] = [
    [-d, -d, c1],
    [d, -d, c2],
    [-d, d, c2],
    [d, d, c1],
  ];
  g.strokeStyle = c1;
  g.lineWidth = s * 0.16;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - d, cy - d);
  g.lineTo(cx + d, cy + d);
  g.stroke();
  g.strokeStyle = c2;
  g.beginPath();
  g.moveTo(cx + d, cy - d);
  g.lineTo(cx - d, cy + d);
  g.stroke();
  for (const [x, y, c] of pts) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(cx + x, cy + y, s * 0.2, 0, Math.PI * 2);
    g.fill();
  }
}

function text(g: G, t: string, x: number, y: number, size: number, color: string, weight = 700, align: CanvasTextAlign = 'left') {
  g.font = `${weight} ${size}px ${FONT}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillText(t, x, y);
}

function bg(g: G, w: number, h: number, a: string, b?: string) {
  if (b) {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    g.fillStyle = gr;
  } else g.fillStyle = a;
  g.fillRect(0, 0, w, h);
}

function bubbles(g: G, w: number, h: number, n: number, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const r = 30 + rnd() * 120;
    const x = rnd() * w;
    const y = rnd() * h;
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, C.lime);
    gr.addColorStop(1, C.deep);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

const designs: { w: number; h: number; draw: (g: G, w: number, h: number) => void }[] = [
  {
    // Primary logo, light
    w: 1400,
    h: 1000,
    draw(g, w, h) {
      bg(g, w, h, '#ffffff');
      mark(g, w / 2, h / 2 - 90, 250);
      text(g, BRAND.toLowerCase(), w / 2, h / 2 + 190, 120, C.ink, 800, 'center');
    },
  },
  {
    // Palette
    w: 1000,
    h: 1400,
    draw(g, w, h) {
      bg(g, w, h, C.paper);
      text(g, 'Color palette', 80, 130, 64, C.ink, 800);
      const sw: [string, string][] = [[C.deep, 'Deep'], [C.green, 'Green'], [C.lime, 'Lime'], [C.mint, 'Mint'], [C.ink, 'Ink']];
      sw.forEach(([c, n], i) => {
        const y = 200 + i * 230;
        g.fillStyle = c;
        rr(g, 80, y, w - 160, 200, 28);
        g.fill();
        text(g, n, 120, y + 90, 48, i === 2 || i === 3 ? C.ink : '#fff', 700);
        text(g, c.toUpperCase(), 120, y + 150, 34, i === 2 || i === 3 ? C.ink : '#fff', 500);
      });
    },
  },
  {
    // Type specimen
    w: 1400,
    h: 1000,
    draw(g, w, h) {
      bg(g, w, h, C.green, C.deep);
      text(g, 'Brand typeface', 100, 170, 82, '#fff', 800);
      text(g, 'Aa', 100, 650, 440, '#fff', 800);
      text(g, 'ABCDEFGHIJKLM', 760, 450, 54, '#fff', 600);
      text(g, 'NOPQRSTUVWXYZ', 760, 520, 54, '#fff', 600);
      text(g, 'abcdefghijklm 0123456789', 760, 600, 40, C.mint, 500);
      [C.deep, C.green, C.lime, '#fff', C.ink].forEach((c, i) => {
        g.fillStyle = c;
        g.fillRect(i * (w / 5), h - 90, w / 5, 90);
      });
    },
  },
  {
    // Business card on a table
    w: 1400,
    h: 1000,
    draw(g, w, h) {
      bg(g, w, h, '#d9e2dc', '#eef2ef');
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate(-0.08);
      g.shadowColor = 'rgba(0,0,0,.28)';
      g.shadowBlur = 60;
      g.shadowOffsetY = 30;
      g.fillStyle = '#fff';
      rr(g, -380, -230, 760, 460, 24);
      g.fill();
      g.shadowColor = 'transparent';
      mark(g, -270, -110, 120);
      text(g, BRAND.toLowerCase(), -190, -88, 56, C.ink, 800);
      text(g, 'Alex Braham', -330, 90, 44, C.ink, 700);
      text(g, 'Head of Brand', -330, 138, 28, '#667', 500);
      text(g, 'hello@nexora.id', -330, 190, 24, C.green, 600);
      g.restore();
      g.save();
      g.translate(w / 2 + 120, h / 2 + 90);
      g.rotate(0.1);
      g.shadowColor = 'rgba(0,0,0,.25)';
      g.shadowBlur = 40;
      g.shadowOffsetY = 20;
      g.fillStyle = C.deep;
      rr(g, -150, -90, 300, 180, 16);
      g.fill();
      mark(g, 0, 0, 90, '#fff', C.lime);
      g.restore();
    },
  },
  {
    // Pattern
    w: 1000,
    h: 1000,
    draw(g, w, h) {
      bg(g, w, h, C.green, C.deep);
      bubbles(g, w, h, 26, 7);
    },
  },
  {
    // Tagline
    w: 1000,
    h: 1000,
    draw(g, w, h) {
      bg(g, w, h, C.deep, C.green);
      bubbles(g, w, h, 5, 3);
      text(g, 'Connecting', w / 2, 430, 120, '#fff', 700, 'center');
      text(g, 'Ideas', w / 2, 560, 120, '#fff', 700, 'center');
      text(g, 'Empowering', w / 2, 720, 120, C.mint, 700, 'center');
      text(g, 'Innovation', w / 2, 850, 120, C.mint, 700, 'center');
    },
  },
  {
    // App icon
    w: 1400,
    h: 1000,
    draw(g, w, h) {
      bg(g, w, h, '#101613', '#1d2a22');
      const icons = [C.deep, '#ffffff', C.lime, C.green];
      icons.forEach((c, i) => {
        const x = 220 + i * 280;
        const y = i === 0 ? 330 : 420;
        g.fillStyle = c;
        rr(g, x, y, 220, 220, 52);
        g.fill();
        if (i === 0) mark(g, x + 110, y + 110, 120, '#fff', C.lime);
        text(g, i === 0 ? BRAND : ['', 'Notes', 'Maps', 'Chat'][i], x + 110, y + 280, 30, '#cfd8d2', 500, 'center');
      });
      text(g, '9:41', 80, 130, 56, '#fff', 700);
    },
  },
  {
    // Discount coupon
    w: 1400,
    h: 1000,
    draw(g, w, h) {
      bg(g, w, h, '#e7ebf0');
      g.fillStyle = '#fff';
      g.shadowColor = 'rgba(0,0,0,.12)';
      g.shadowBlur = 40;
      rr(g, 150, 150, w - 300, 450, 36);
      g.fill();
      rr(g, 150, 640, w - 300, 220, 36);
      g.fill();
      g.shadowColor = 'transparent';
      text(g, 'UPGRADE DISCOUNT', 220, 250, 30, C.green, 700);
      text(g, 'Upgrade today to enable', 220, 330, 50, C.ink, 700);
      text(g, 'unlimited projects.', 220, 395, 50, C.ink, 700);
      text(g, '$12.99', 220, 540, 100, C.green, 800);
      text(g, 'DISCOUNT CODE', 220, 760, 30, C.ink, 700);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = C.ink;
        g.fillRect(220 + i * 14, 790, i % 3 === 0 ? 8 : 4, 40);
      }
      text(g, 'NX2024', w - 220, 760, 30, C.ink, 700, 'right');
    },
  },
  {
    // Social post / stat
    w: 1000,
    h: 1400,
    draw(g, w, h) {
      bg(g, w, h, C.mint);
      mark(g, 150, 150, 110);
      text(g, '92%', 80, 700, 380, C.deep, 800);
      text(g, 'of teams ship faster', 80, 810, 64, C.ink, 700);
      text(g, 'with a clear brand system.', 80, 890, 64, C.ink, 700);
      g.fillStyle = C.green;
      rr(g, 80, 1100, 360, 110, 55);
      g.fill();
      text(g, 'Learn more', 260, 1170, 40, '#fff', 700, 'center');
    },
  },
  {
    // Logo, dark
    w: 1400,
    h: 1000,
    draw(g, w, h) {
      bg(g, w, h, C.ink);
      mark(g, w / 2 - 330, h / 2, 230, C.green, C.lime);
      text(g, BRAND.toLowerCase(), w / 2 - 170, h / 2 + 50, 190, '#fff', 800);
      text(g, 'Brand identity', w / 2 - 165, h / 2 + 140, 48, C.lime, 500);
    },
  },
];

export const BRAND_SAMPLE_COUNT = designs.length;

export async function renderBrandSamples(count: number): Promise<Blob[]> {
  if (document.fonts?.ready) await document.fonts.ready;
  const out: Blob[] = [];
  for (let i = 0; i < Math.min(count, designs.length); i++) {
    const d = designs[i];
    const c = document.createElement('canvas');
    c.width = d.w;
    c.height = d.h;
    d.draw(c.getContext('2d')!, d.w, d.h);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
    if (blob) out.push(blob);
  }
  return out;
}
