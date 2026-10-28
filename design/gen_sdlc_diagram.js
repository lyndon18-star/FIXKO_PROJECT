// Agile SDLC circular chevron diagram for FIXKO
const fs = require('fs');

const W = 1000, CX = 500, CY = 500;
const R_OUT = 395, R_IN = 175;
const N = 6;
const SPAN = 360 / N;
const EXT = 5;              // angular extension of head base past segment end

const phases = [
  { lines: ['Planning &', 'Requirements'], color: '#41566B', a0: 0 },
  { lines: ['Design'], sub: '(Figma Prototype)', color: '#1E8FB0', a0: 60 },
  { lines: ['Development'], sub: '(Laravel + Next.js)', color: '#8BC540', a0: 120 },
  { lines: ['Testing'], sub: '(PHPUnit)', color: '#FCB92C', a0: 180 },
  { lines: ['Deployment'], sub: '(XAMPP)', color: '#F15A29', a0: 240 },
  { lines: ['Feedback &', 'Iteration'], color: '#79C2CF', a0: 300 },
];

function pt(r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return [+(CX + r * Math.cos(rad)).toFixed(1), +(CY + r * Math.sin(rad)).toFixed(1)];
}

function segPath(a0, a1) {
  // continuous chevron arrow: outer arc, protruding tip, inner edge, concave tail notch
  const tipR = R_OUT + 18;
  const s = 8;                       // half width of head base (deg)
  const he = a1 + 4;                 // head end angle
  const midR = (R_OUT + R_IN) / 2;
  const pO0 = pt(R_OUT, a0);
  const pO1 = pt(R_OUT, a1 + s);     // outer end of arc (base of head top)
  const pT = pt(tipR, he + s * 0.9); // protruding point
  const pI1 = pt(R_IN, he + s);      // inner corner past head
  const pI0 = pt(R_IN, a0 + 5);
  const pNotch = pt(midR + 55, a0 + 9); // concave notch in tail
  const large = (a1 + s - a0) > 180 ? 1 : 0;
  return `M ${pO0} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${pO1} L ${pT} L ${pI1} A ${R_IN} ${R_IN} 0 ${large} 0 ${pI0} L ${pNotch} Z`;
}

let body = '';
phases.forEach(p => {
  const a0 = p.a0 + 5;
  const a1 = p.a0 + SPAN - 8;
  body += `<path d="${segPath(a0, a1)}" fill="${p.color}" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round"/>`;

  const mid = p.a0 + SPAN / 2;
  const [lx0, ly0] = pt(285, mid);
  const all = [...p.lines, ...(p.sub ? [p.sub] : [])];
  const lineH = 34;
  const startY = ly0 - ((all.length - 1) * lineH) / 2 + 10;
  all.forEach((ln, i) => {
    const isSub = p.sub === ln;
    body += `<text x="${lx0}" y="${startY + i * lineH}" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="${isSub ? 18 : 25}" font-weight="${isSub ? 500 : 800}">${ln.replace(/&/g, '&amp;')}</text>`;
  });
});

const centerA = ['Agile SDLC', 'FIXKO', 'Management System'];
centerA.forEach((ln, i) => {
  body += `<text x="${CX}" y="${CY - 40 + i * 44}" text-anchor="middle" fill="#333333" font-family="Segoe UI, Arial, sans-serif" font-size="${i === 0 ? 36 : 29}" font-weight="${i === 0 ? 800 : 700}">${ln}</text>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
<rect width="${W}" height="${W}" fill="#ffffff"/>
${body}
</svg>`;

fs.writeFileSync('C:/xampp/htdocs/LASTMAIN/design/agile-sdlc-fixko.svg', svg);
console.log('SVG written');
