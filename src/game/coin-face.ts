/** Minted Kuwaiti dinar face. Drawn at a 256px master and scaled by the caller. */

function star(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, n: number) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / n;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function incuse(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save();
  ctx.translate(2.2, 2.8);
  ctx.fillStyle = "rgba(255, 248, 226, 0.88)";
  draw();
  ctx.restore();
  ctx.fillStyle = "#4a280c";
  draw();
}

function dhow(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(0, -50);
  ctx.quadraticCurveTo(30, -30, 50, -2);
  ctx.lineTo(-2, 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-54, 6);
  ctx.quadraticCurveTo(-6, 32, 58, -2);
  ctx.lineTo(46, -8);
  ctx.quadraticCurveTo(0, 16, -42, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-2.2, -48, 3.6, 54);
}

export function paintDinarCoin(ctx: CanvasRenderingContext2D, size = 256) {
  const s = size / 256;
  ctx.save();
  ctx.scale(s, s);
  ctx.translate(128, 128);

  ctx.beginPath();
  ctx.arc(0, 0, 126, 0, Math.PI * 2);
  ctx.fillStyle = "#6d4010";
  ctx.fill();

  ctx.save();
  const teeth = 48;
  for (let i = 0; i < teeth; i += 1) {
    ctx.rotate((Math.PI * 2) / teeth);
    ctx.fillStyle = i % 2 === 0 ? "#fff3cc" : "#7a4510";
    ctx.fillRect(-2.3, -126, 4.6, 20);
  }
  ctx.restore();

  const face = ctx.createRadialGradient(-28, -36, 8, 0, 0, 118);
  face.addColorStop(0, "#fff6d4");
  face.addColorStop(0.28, "#f3d078");
  face.addColorStop(0.62, "#e0a63c");
  face.addColorStop(1, "#b67818");
  ctx.beginPath();
  ctx.arc(0, 0, 112, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 112, 0, Math.PI * 2);
  ctx.clip();
  const dish = ctx.createRadialGradient(0, 0, 62, 0, 0, 114);
  dish.addColorStop(0, "rgba(255, 248, 220, 0)");
  dish.addColorStop(1, "rgba(92, 48, 8, 0.38)");
  ctx.fillStyle = dish;
  ctx.fillRect(-128, -128, 256, 256);
  const glint = ctx.createRadialGradient(-46, -52, 2, -20, -24, 78);
  glint.addColorStop(0, "rgba(255, 252, 236, 0.72)");
  glint.addColorStop(1, "rgba(255, 252, 236, 0)");
  ctx.fillStyle = glint;
  ctx.fillRect(-128, -128, 256, 256);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, 112, 0, Math.PI * 2);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "#fff1c8";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 104, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#7a4c12";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 112, Math.PI * 1.05, Math.PI * 1.72);
  ctx.strokeStyle = "rgba(255, 250, 230, 0.9)";
  ctx.lineWidth = 2.4;
  ctx.stroke();

  ctx.fillStyle = "#5c340c";
  for (let i = 0; i < 32; i += 1) {
    const angle = (i / 32) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 94, Math.sin(angle) * 94, 3.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(0, -18);
  ctx.fillStyle = "rgba(92, 52, 12, 0.1)";
  star(ctx, 0, 0, 46, 20, 8);
  ctx.fill();
  ctx.restore();

  incuse(ctx, () => {
    ctx.save();
    ctx.translate(2, -24);
    dhow(ctx);
    ctx.restore();
  });

  incuse(ctx, () => {
    ctx.font = '800 50px "Noto Kufi Arabic", "Noto Naskh Arabic", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("د.ك", 0, 52);
  });

  ctx.restore();
}

export function mountDinarCoin(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const paint = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    paintDinarCoin(ctx, size);
  };
  paint();
  const ready =
    typeof document !== "undefined" && document.fonts?.ready
      ? document.fonts.ready.then(() => {
          paint();
          return canvas;
        })
      : Promise.resolve(canvas);
  return { canvas, paint, ready };
}
