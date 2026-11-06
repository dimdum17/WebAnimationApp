# Gerakinaja — Rencana Implementasi v1

Web app untuk membuat video showcase animasi dari gambar (mengacu pada referensi "animos"), dengan ~20 template, panel properti, keyframe parameter, text/logo overlay, dan export video hingga 2K. Semua berjalan di browser tanpa akun dan tanpa backend.

## Keputusan yang sudah dikunci

| Topik | Keputusan |
|---|---|
| Nama | **Gerakinaja** (badge "Beta" di header) |
| Bahasa UI | Inggris |
| Template | 20 template kurasi dari 8 kategori (Multiscene tidak masuk v1) |
| Penyimpanan | Lokal (IndexedDB), tanpa akun; hilangkan Upgrade, HD token, avatar |
| Keyframe | Keyframe untuk parameter numerik (ikon diamond di samping slider) + panel Keyframes |
| Overlay | Text layer (bisa banyak) + 1 logo |
| Export | MP4 (H.264) dan WebM (VP9), 720p / 1080p / 2K, 30/60 fps, loop 1×–4× |
| Browser tanpa WebCodecs | Tampilkan pesan "browser not supported" (tanpa fallback perekaman real-time) |
| Tema | Dark default + toggle Light (hanya UI, tidak mempengaruhi output video) |

## Kondisi repository

Scaffold kosong: React 19 + Vite 8 + Tailwind CSS v4 + TypeScript (`src/App.tsx`, `src/main.tsx`, `src/index.css`), pnpm, alias `@` → `src`. Dev server sudah berjalan otomatis — jangan dijalankan manual. Seluruh app dibangun dari awal.

## Dependency baru

- `three` + `@types/three` — renderer WebGL untuk semua template (perspektif & ortografis untuk isometric).
- `mediabunny` — encoding WebCodecs + muxing MP4/WebM.
- `zustand` — state store.
- `idb-keyval` — wrapper IndexedDB (store `projects` dan `assets`).
- `@dnd-kit/core`, `@dnd-kit/sortable` — reorder slot media dan text layer.
- `lucide-react` — ikon.
- Font: Inter (UI) via Google Fonts CSS2 `@import` di `src/index.css`; font overlay: Inter, Space Grotesk, Playfair Display, DM Serif Display, Bebas Neue, JetBrains Mono (Google Fonts, dimuat sekali di `index.css`).

Komponen UI (Slider, Segmented, Select, Dialog, ColorInput, Toast, Tooltip) dibuat sendiri dengan Tailwind agar sesuai gaya referensi.

## Arsitektur

```
src/
  App.tsx                    layout utama 3 kolom + header + timeline
  types/project.ts           tipe dokumen project
  state/store.ts             zustand store (project, playhead, UI state)
  state/history.ts           undo/redo snapshot
  persistence/db.ts          IndexedDB: projects + assets (Blob)
  persistence/autosave.ts    autosave debounce 800 ms, restore project terakhir
  persistence/assets.ts      import gambar, downscale, cache ImageBitmap/texture
  engine/renderer.ts         setup Three.js, loop rAF preview
  engine/compositor.ts       komposit: background → WebGL → text/logo (2D canvas)
  engine/cardMaterial.ts     ShaderMaterial kartu: rounded corner SDF, object-fit cover, placeholder
  engine/shadow.ts           shadow sprite per kartu (X, Y, blur, spread, opacity, color)
  engine/overlays.ts         gambar text & logo ke 2D canvas
  engine/keyframes.ts        resolveParams(project, t)
  engine/easing.ts           kurva easing
  templates/types.ts         TemplateDef / TemplateInstance / ParamDef
  templates/shared.ts        parameter bersama (padding, radius, card size, ratio, easing, motion, shadow)
  templates/registry.ts      daftar 20 template + kategori
  templates/<id>.ts          satu file per template
  export/presets.ts          mapping resolusi/bitrate/ukuran file
  export/support.ts          deteksi WebCodecs & isConfigSupported
  export/exporter.ts         render frame-by-frame + encode via mediabunny
  components/
    header/  left/ (TemplatesPanel, LayersPanel)  right/ (sections)
    timeline/ (Timeline, KeyframesPanel)  dialogs/ (ExportDialog, ProjectsDialog)  ui/
```

### Prinsip rendering (wajib)

1. **Satu renderer untuk preview dan export.** `renderFrame(project, t, targetCanvas, size)` adalah fungsi deterministik dari waktu `t` — template tidak boleh menyimpan state antar-frame atau memakai `Date.now()`/random tanpa seed. Random memakai PRNG ber-seed (mulberry32) per template + indeks kartu.
2. **Loop mulus.** Setiap template harus periodik: frame di `t = 0` identik dengan `t = duration`. Gunakan progress `p = (t mod duration) / duration` dan fungsi periodik (sin/cos, offset modulo).
3. **Komposit:** output 2D canvas → (a) background (colour / gradient linear 2 stop + sudut / image cover + dim), (b) canvas WebGL transparan berisi kartu, (c) text layer dan logo. Preview dan export memakai komposit yang sama.
4. **Kartu** = plane dengan `ShaderMaterial` bersama: uniform texture, aspect gambar vs kartu (cover), corner radius (SDF, anti-alias), opacity, warna placeholder. Slot kosong → kartu abu-abu netral (seperti thumbnail referensi).
5. **Jumlah kartu vs slot:** jika template butuh lebih banyak kartu dari slot (mis. Sphere Wall 60 kartu), kartu mengulang slot secara berurutan (`slotIndex = cardIndex mod slotCount`).
6. Preview dirender pada ukuran stage × devicePixelRatio, dibatasi sisi pendek maks 1080 px; rendering berhenti saat tab tersembunyi.

## Model data

```ts
type Aspect = '16:9' | '4:3' | '1:1' | '4:5' | '3:4' | '9:16';

interface Project {
  version: 1;
  id: string; name: string; createdAt: number; updatedAt: number;
  aspect: Aspect;                       // default '9:16'
  templateId: string;                   // default 'iso-cascade'
  slots: { id: string; assetId: string | null }[];   // 1..20
  duration: number;                     // detik, 5..30 (preset 5/10/15/20/30 + slider), default 10
  background:
    | { type: 'colour'; color: string }
    | { type: 'gradient'; from: string; to: string; angle: number }
    | { type: 'image'; assetId: string | null; dim: number };
  shared: Record<string, number | string | boolean>;               // parameter bersama + shadow
  templateParams: Record<string /*templateId*/, Record<string, number | string>>;
  keyframes: Record<string /*paramPath*/, Keyframe[]>;
  texts: TextLayer[];
  logo: LogoLayer | null;
}

interface Keyframe { id: string; time: number /* 0..1, ternormalisasi terhadap duration */; value: number; easing: 'linear' | 'smooth' | 'hold' }

interface TextLayer {
  id: string; visible: boolean; content: string;
  font: FontId; weight: 400 | 500 | 600 | 700; size: number /* % tinggi frame */;
  color: string; align: 'left' | 'center' | 'right'; letterSpacing: number;
  x: number; y: number /* % frame, titik anchor */; opacity: number;
  animIn: 'none' | 'fade' | 'slide-up' | 'scale';  // berlangsung 0.6 s di awal tiap loop
}

interface LogoLayer { assetId: string; visible: boolean; anchor: 'tl'|'tr'|'bl'|'br'|'center'; offsetX: number; offsetY: number; size: number /* % lebar frame */; opacity: number }
```

- `paramPath`: `shared.<key>`, `tpl.<templateId>.<key>`, `text.<layerId>.<x|y|size|opacity>`, `logo.<size|opacity>`.
- Ganti template: parameter bersama, slot, text, logo tetap; parameter khusus diambil dari `templateParams[templateId]` (default jika belum ada). Keyframe `tpl.*` hanya aktif untuk template yang sedang dipakai.
- Waktu keyframe disimpan ternormalisasi (0–1) sehingga ikut menyesuaikan saat loop duration diubah; ditampilkan dalam detik.
- Asset (gambar slot, background image, logo) disimpan sebagai Blob di store `assets` dengan id; project hanya menyimpan `assetId`.

## Template (20)

Semua memakai parameter bersama: **Padding, Corner radius, Card size, Card ratio** (Auto, 1:1, 4:3, 3:4, 4:5, 16:9, 9:16), **Easing** (Linear, Smooth, Snappy, Elastic), **Motion** (Continuous / Stepped — stepped = berhenti sejenak di tiap kartu), **Direction** (opsi khusus per template), dan **Shadow** (toggle + X, Y, Blur, Spread, Opacity, Color). Parameter khusus di kolom kanan.

| Kategori | Template | Gerak | Parameter khusus | Slot default |
|---|---|---|---|---|
| 3D & Perspective | Showcase Ring | Cincin kartu berputar pada sumbu Y, kamera sedikit miring | Radius, Tilt, Camera distance | 10 |
| | Sphere Wall | Dinding melengkung grid kartu bergulir horizontal | Curvature, Rows, Spacing | 10 |
| | Card Globe | Bola tersusun kartu (fibonacci sphere) berotasi | Globe size, Card count, Rotation speed | 10 |
| | Card Tunnel | Kamera maju menembus terowongan 4 dinding kartu | Depth, Speed, Wall gap | 10 |
| | Spiral Stream | Kartu mengalir sepanjang heliks vertikal | Turns, Radius, Spacing | 10 |
| | Depth Stack | Tumpukan kartu dalam kedalaman, kartu depan maju lalu kembali ke belakang | Depth spacing, Tilt | 8 |
| Isometric | Iso Cascade | Barisan kartu isometric bergeser diagonal (referensi utama) | Tilt, Spacing | 10 |
| | Iso Focus | Kartu isometric berurutan terangkat dan menghadap kamera | Tilt, Lift | 8 |
| Orbit | Orbit Carousel | Kartu mengorbit elips, kartu depan membesar | Orbit width, Orbit height, Tilt | 8 |
| | Photo Orbit | Cincin kartu datar berputar di bidang layar | Ring radius, Card rotation | 12 |
| Carousel & Flow | Cover Flow | Cover flow klasik: tengah menghadap, sisi berputar | Side angle, Spacing | 8 |
| | Film Strip | Strip kartu horizontal bergulir terus | Gap, Speed, Rows (1–3) | 10 |
| | Card Totem | Kolom vertikal bergulir, kartu tengah fokus | Gap, Focus scale | 8 |
| | Focus Slider | Slider satu kartu besar, tetangga mengecil di sisi | Side scale, Gap | 8 |
| Grid | Flip Grid | Grid kartu yang flip 3D bergantian menampilkan gambar berikutnya | Columns, Gap, Flip stagger | 12 |
| | Ticker Tilt | Grid miring dengan baris bergulir berlawanan arah | Tilt angle, Columns, Speed | 12 |
| Spotlight & Focus | Center Stage | Satu kartu tengah berganti dengan transisi scale/fade, latar kartu blur | Transition length, Zoom | 6 |
| | Zoom Parallax | Lapisan kartu dengan zoom parallax berkedalaman | Zoom amount, Layers | 6 |
| Reveal & Wipe | Split Reveal | Kartu terbelah dua panel dan menyingkap gambar berikutnya | Split direction, Transition length | 6 |
| Stack & Scatter | Card Toss | Kartu dilempar ke tumpukan dengan rotasi acak (seeded), lalu tersapu | Scatter, Rotation range | 8 |

**Thumbnail template:** dirender otomatis saat app dimuat dengan renderer yang sama (kartu placeholder abu-abu, `t = 0.3·duration`, 180×180) dan di-cache di memori sebagai data URL — konsisten dengan gaya referensi. Item terpilih diberi outline.

### Interface template

```ts
interface ParamDef {
  key: string; label: string;
  type: 'number' | 'segmented' | 'select';
  min?: number; max?: number; step?: number; unit?: '%' | '°' | 'px' | 'x' | '';
  options?: { value: string; label: string }[];
  default: number | string;
  animatable?: boolean;   // true untuk semua 'number'
}
interface TemplateDef {
  id: string; name: string; category: CategoryId;
  defaultSlots: number; maxCards?: number;
  camera: 'perspective' | 'orthographic';
  directions: { value: string; label: string }[];
  params: ParamDef[];
  create(ctx: { scene: THREE.Scene; camera: THREE.Camera; cards: CardFactory }): TemplateInstance;
}
interface TemplateInstance {
  update(f: { p: number; t: number; duration: number; params: ResolvedParams; frame: { w: number; h: number } }): void;
  dispose(): void;
}
```

## Layout dan UI

**Header** (tinggi 48 px): logo + "Gerakinaja" + badge Beta · tombol **Projects** · Undo / Redo · judul project di tengah (klik untuk rename inline) · toggle tema (sun/moon) · tombol **Export** (primer biru).

**Kiri (240 px)** — tab **Templates / Layers**.
- Templates: kategori collapsible dengan jumlah (mis. "3D & PERSPECTIVE · 6"), grid 2 kolom thumbnail + nama terpotong elipsis. Klik = ganti template (masuk history undo).
- Layers: Text layers (urutan bisa di-drag, eye toggle, delete), Logo (eye, delete), Media cards (jumlah slot), Background. Klik layer → kolom kanan scroll ke section terkait dan menyorotnya.

**Tengah** — kanvas berlatar titik-titik (dot grid), frame output dengan rounded border sesuai aspect, diskalakan agar muat. Text layer bisa di-drag langsung di kanvas (mengubah x/y; jika ada keyframe, auto-key di waktu sekarang). Tombol **Keyframes ⌃** mengambang di bawah frame.

**Bawah** — timeline: Play/Pause, Restart, scrubber (warna aksen), label `8.6s / 10.0s`. Preview selalu loop.

**Kanan (300 px, scroll)** — section berurutan:
1. **Frame**: 6 tombol aspect dengan ikon proporsional.
2. **Media · N slots**: stepper Number of images (1–20); daftar slot (drag handle, thumbnail, "Slot n / Drop or click to add", tombol hapus saat terisi); drop banyak file sekaligus mengisi slot kosong berurutan (menambah slot bila perlu hingga 20); tombol **Use sample images** (set gambar Unsplash kurasi) dan **Clear images**.
3. **Timing**: preset 5s/10s/15s/20s/30s + slider 5–30 s.
4. **Text**: "+ Add text"; tiap layer berupa kartu collapsible (content textarea, font, weight, size, color, align, letter spacing, X, Y, opacity, animation in).
5. **Logo**: "Upload logo (max 5 MB)"; setelah ada: preview, anchor, offset X/Y, size, opacity, Replace/Remove.
6. **[Nama template]**: background Colour / Gradient / Image; parameter bersama + parameter khusus template.
7. **Shadow**: checkbox + slider (disabled/redup saat off).
8. **Reset settings**: kembalikan parameter template + shared ke default (keyframe parameter terkait ikut dihapus, dengan konfirmasi).

Gaya visual mengikuti referensi: netral gelap (`#0e0e10` bg, panel `#151517`, border `#26262a`), aksen biru `#2563eb`, label section uppercase kecil dengan tracking lebar, slider dengan thumb pill. Tema Light memakai token CSS yang sama dengan nilai terang; disimpan di `localStorage`. Token didefinisikan sebagai CSS variables + `@theme` Tailwind v4 di `src/index.css`.

## Keyframes

- **Diamond** di samping setiap slider numerik yang animatable:
  - Outline: parameter belum dianimasikan → klik menambah keyframe pada waktu sekarang dengan nilai sekarang.
  - Terisi: ada keyframe di waktu sekarang (toleransi ±1 frame @30fps) → klik menghapusnya.
  - Setengah/titik: parameter dianimasikan tetapi tidak ada keyframe di waktu sekarang → klik menambah keyframe.
- Mengubah slider pada parameter yang dianimasikan → otomatis membuat/memperbarui keyframe di waktu sekarang (auto-key). Parameter yang tidak dianimasikan → mengubah nilai statis.
- **Interpolasi** (`engine/keyframes.ts`): sebelum keyframe pertama/sesudah keyframe terakhir nilai ditahan; antar keyframe memakai easing keyframe awal segmen (`linear`, `smooth` = cubic in-out, `hold`). Tidak wrap otomatis di batas loop (pengguna bisa menyamakan nilai awal-akhir untuk loop mulus).
- **Panel Keyframes** (drawer di atas timeline, tinggi ~200 px, toggle lewat tombol Keyframes): satu baris per parameter teranimasi (label + track waktu sejajar scrubber). Diamond bisa diklik (pilih + lompat playhead), di-drag untuk mengubah waktu (snap ke frame 30fps), Delete/Backspace untuk hapus, dropdown easing untuk keyframe terpilih. Status kosong: "Click the ◇ next to any slider to animate it".

## Penyimpanan, project, dan undo

- **IndexedDB** via `idb-keyval` dengan dua store: `gk-projects` (dokumen `Project` + thumbnail kecil data URL) dan `gk-assets` (Blob). `localStorage` hanya untuk tema dan id project terakhir.
- **Import gambar:** terima JPG/PNG/WebP/AVIF/GIF (frame pertama), maks 20 MB per file; di-downscale ke sisi panjang maks 2560 px (cukup untuk 2K) dan disimpan sebagai WebP kualitas 0.9. Logo maks 5 MB, PNG transparan dipertahankan (simpan PNG). File tidak valid → toast error.
- **Autosave** debounce 800 ms setelah perubahan dokumen; thumbnail project diperbarui maks tiap 10 s. App memulihkan project terakhir saat dibuka; jika tidak ada, buat project baru "Untitled showcase" (Iso Cascade, 9:16, 10 slot kosong).
- **Projects dialog:** grid kartu project (thumbnail, nama, waktu diubah) dengan New, Open, Duplicate, Rename, Delete (konfirmasi). Menghapus project menghapus asset yang tidak dipakai project lain.
- **Quota penuh** (`QuotaExceededError`) → toast "Storage full — delete old projects".
- **Undo/redo:** snapshot dokumen (tanpa playhead/UI state), maks 100 langkah; drag slider/kanvas di-coalesce menjadi satu langkah (commit saat pointerup). Shortcut: Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Ctrl+Y. Space = play/pause (kecuali fokus di input).

## Export

**Dialog Export video** (seperti referensi, tanpa token): Format (MP4 · H.264 / WebM · VP9), Resolution (720p / 1080p / 2K), Frame rate (30 / 60 fps), Loops (1×–4×), baris info `1440×2560 · 10.0s · 30 Mbps · ~38 MB max`, peringatan kuning jika ada slot kosong ("No images added yet — empty placeholders will appear in the export."), tombol Close / Export.

**Resolusi** = sisi pendek 720 / 1080 / 1440 px, sisi panjang dihitung dari aspect dan dibulatkan ke angka genap:

| Aspect | 720p | 1080p | 2K |
|---|---|---|---|
| 16:9 | 1280×720 | 1920×1080 | 2560×1440 |
| 9:16 | 720×1280 | 1080×1920 | 1440×2560 |
| 1:1 | 720×720 | 1080×1080 | 1440×1440 |
| 4:5 / 3:4 / 4:3 | dihitung dari sisi pendek | | |

**Bitrate:** 720p 8 Mbps, 1080p 16 Mbps, 2K 30 Mbps; ×1.5 untuk 60 fps. Estimasi ukuran = bitrate × duration × loops / 8.

**Alur:**
1. `support.ts`: jika `VideoEncoder` tidak ada → tombol Export di header tetap tampil, tetapi dialog menampilkan pesan "Your browser doesn't support video export. Please use a recent version of Chrome, Edge, or Safari." dan tombol Export di dialog disabled.
2. Untuk setiap kombinasi format/resolusi/fps, cek `VideoEncoder.isConfigSupported` (H.264 profil High, level dipilih otomatis; VP9 profil 0). Opsi yang tidak didukung disabled dengan tooltip "Not supported by this browser".
3. Pastikan semua gambar dan font overlay sudah termuat (`document.fonts.load` per font yang dipakai) sebelum mulai.
4. Render offscreen pada canvas ukuran target; untuk frame `i` dari `0..duration×fps×loops−1`, `t = (i / fps) mod duration`, panggil `renderFrame`, lalu kirim ke `CanvasSource` mediabunny dengan timestamp `i / fps`. Tidak ada audio.
5. Dialog menampilkan progress bar (frame x / total, persen) dan tombol Cancel (membatalkan encoder dan membuang output). Preview dijeda selama export.
6. Selesai → unduh otomatis `<nama-project>.mp4|.webm` dan toast sukses. Error encoder → pesan error di dialog dengan opsi coba lagi pada resolusi lebih rendah.

## Urutan implementasi

1. **Fondasi:** install dependency, token tema + font di `index.css`, layout 3 kolom + header + timeline statis, komponen `ui/`.
2. **State & tipe:** `types/project.ts`, zustand store, default project, history undo/redo.
3. **Engine:** renderer Three.js, card shader, compositor (background + WebGL + overlay), loop playback, timeline scrubber.
4. **Template pertama (Iso Cascade)** end-to-end dengan parameter bersama + shadow, untuk memvalidasi interface template.
5. **Media:** import/downscale gambar, slot list (drop, reorder, hapus, clear, sample images), texture cache.
6. **Persistence:** IndexedDB, autosave, restore, Projects dialog.
7. **Keyframes:** resolveParams, diamond di slider, auto-key, panel Keyframes.
8. **Text & logo:** section kanan, render overlay, drag di kanvas, Layers tab.
9. **19 template lainnya** + thumbnail otomatis + panel Templates berkategori.
10. **Export:** support detection, dialog, exporter mediabunny, progress/cancel.
11. **Polish:** tema Light, shortcut keyboard, empty/error states, toast, aksesibilitas (label aria, fokus terlihat).

## Edge case

- 0 gambar → semua kartu placeholder; export tetap boleh dengan peringatan.
- Mengurangi jumlah slot menghapus slot terakhir (asset tetap ada di store sampai GC); undo mengembalikannya.
- Gambar gagal decode → slot ditandai error dengan tombol hapus.
- WebGL context lost → tampilkan overlay "Preview paused — click to restore" dan rebuild renderer.
- Keyframe di parameter yang lalu disembunyikan (shadow off) → tetap tersimpan, tidak dievaluasi.
- Project dari versi lama (`version` berbeda) → fungsi migrasi di `persistence/db.ts` (v1 hanya validasi + isi default yang hilang).
- Rename dengan nama kosong → kembali ke nama sebelumnya.

## Verifikasi

- `pnpm exec tsc --noEmit` dan `pnpm build` harus lulus.
- Cek manual di preview (Chrome):
  1. Setiap template dari 20 dapat dipilih, beranimasi, dan loop tanpa lompatan di batas `t = duration`.
  2. Ganti aspect 6 opsi → frame dan layout template menyesuaikan.
  3. Upload banyak gambar sekaligus, reorder, hapus, clear, sample images.
  4. Tambah keyframe pada Tilt di 0s dan 5s → nilai berinterpolasi; drag keyframe di panel; hapus; undo/redo.
  5. Tambah 2 text layer + logo, drag text di kanvas, toggle visibility di Layers.
  6. Reload halaman → project dan gambar dipulihkan; buat, duplikasi, hapus project.
  7. Export MP4 2K 9:16 30fps dan WebM 1080p 60fps 2× loop → file terunduh, resolusi/durasi sesuai (cek di pemutar video), visual sama dengan preview.
  8. Toggle tema Light/Dark tidak mengubah output.
- Simulasikan browser tanpa WebCodecs (override `window.VideoEncoder = undefined` di console) → pesan unsupported muncul.

## Di luar cakupan v1

Template Multiscene, resolusi 4K/8K, akun/sinkronisasi cloud, audio, export GIF/PNG sequence, fallback MediaRecorder, video sebagai media slot.
