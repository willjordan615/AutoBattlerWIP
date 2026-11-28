// Original programmatically authored vector pieces. No image assets, generators,
// or simulation dependencies. Coordinates share a 96 x 112 canvas, foot anchor (48,96).
// Each part is [SVG path, fill, optional outline]; ordered back-to-front.
const ink='#20232b',skin='#d5a889',shade='#99715e',steel='#aebbc0',steelDark='#6c7a85',shine='#dce1da',leather='#735345',dark='#41404a';
const p=(d,fill,stroke=ink)=>[d,fill,stroke];
const line=(d,stroke)=>[d,null,stroke];
const boots=[
 p('M31 72 L45 72 L44 92 L33 96 L25 94 L25 89 L30 86 Z',dark),
 p('M48 74 L62 73 L65 87 L72 90 L72 95 L57 96 L49 91 Z',dark),
 line('M29 91 L40 91 M57 91 L69 92','#86818a')
];
const face=[
 p('M38 19 Q49 12 62 21 L65 35 Q60 44 50 45 L41 39 Z',skin),
 p('M55 23 L64 25 L65 35 L59 40 L56 35 Z',shade,null),
 line('M49 29 L53 29 M60 29 L62 30 M53 37 L58 38',ink)
];
const belt=[p('M34 59 L62 58 L63 66 L33 67 Z',leather),p('M47 59 L54 59 L54 66 L47 66 Z','#d9b47b')];
export const STANDEE_PARTS=Object.freeze({
 bruiser:Object.freeze([
  p('M27 39 Q43 31 65 38 L73 78 L58 83 L29 81 L20 66 Z','#894e47'),
  ...boots,
  p('M25 41 L42 33 L61 33 L75 42 L67 65 L59 76 L34 76 L27 65 Z',steelDark),
  p('M33 40 L48 37 L64 41 L60 59 L48 65 L35 58 Z',steel),
  p('M35 42 L48 38 L48 58 L38 54 Z',shine,null),
  p('M27 36 Q18 37 16 46 L20 55 L34 51 L40 39 Z',steel),
  p('M60 36 Q71 33 78 42 L78 52 L65 55 L60 46 Z',steel),
  p('M68 51 L79 52 L83 67 L76 71 L69 64 Z',steelDark),
  ...belt,
  ...face,
  p('M34 26 L35 14 Q48 5 60 13 L67 21 L67 28 L57 25 L51 30 L40 27 L40 35 L34 33 Z',steel),
  p('M38 15 L47 12 L47 24 L38 26 Z',shine,null),
  line('M49 12 L50 25 M62 18 L65 23',steelDark),
  p('M13 49 L30 44 L42 51 L40 68 Q35 78 27 82 Q17 77 11 68 Z',steelDark),
  p('M16 52 L29 48 L38 53 L36 67 Q31 75 27 77 Q19 73 15 66 Z','#c2a264'),
  p('M25 52 L30 53 L33 62 L28 72 L23 63 Z','#ede0b2',null),
  p('M75 70 L80 71 L87 41 L84 38 Z',leather),
  p('M78 40 L81 32 L92 34 L93 43 L87 47 L76 44 Z',steel),
  p('M75 64 Q82 60 84 66 L81 72 L76 72 Z',skin)
 ]),
 rogue:Object.freeze([
  p('M35 29 Q24 39 23 58 L10 78 L28 73 L31 85 L61 73 L66 44 Z','#56616a'),
  p('M30 71 L46 70 L43 91 L31 95 L24 94 L29 87 Z',dark),
  p('M47 72 L58 69 L63 85 L73 89 L71 94 L57 94 L49 89 Z',dark),
  p('M34 33 L55 32 L65 44 L59 61 L62 73 L35 79 L28 72 L34 57 L25 43 Z','#687b72'),
  p('M34 37 L45 37 L47 57 L34 64 Z','#a0a58e',null),
  p('M53 37 L60 42 L55 63 L48 59 Z',leather),
  p('M28 42 L21 47 L22 61 L31 65 L36 58 L30 54 Z',leather),
  p('M59 40 L69 46 L74 59 L67 64 L60 58 L54 48 Z',leather),
  ...belt,
  p('M34 14 Q39 5 49 7 Q60 6 68 23 L64 38 L54 44 L36 39 L31 29 Z','#4c5c62'),
  p('M37 22 Q42 13 56 16 L65 26 L59 38 L47 39 L39 34 Z','#292f38'),
  p('M45 25 L63 27 L59 35 L52 36 L45 32 Z',skin,null),
  line('M49 28 L53 29 M59 29 L61 29',ink),
  p('M35 39 L53 43 L45 48 L34 46 Z','#839488'),
  p('M23 60 L29 57 L35 62 L31 68 L25 67 Z',skin),
  p('M66 58 L73 56 L77 62 L72 68 L66 65 Z',skin),
  p('M20 62 L25 65 L19 73 L14 70 Z',leather),
  p('M14 69 L20 74 L7 88 L6 79 Z',steel),
  p('M72 61 L77 63 L81 55 L77 52 Z',leather),
  p('M77 53 L82 56 L94 40 L89 43 Z',shine)
 ]),
 ranged:Object.freeze([
  p('M31 35 L52 31 L66 38 L72 79 L55 83 L26 80 L21 59 Z','#77604b'),
  p('M32 27 L38 25 L30 71 L23 69 Z',leather),
  p('M25 23 L28 8 L31 8 L32 23 Z',steel),
  p('M33 23 L37 10 L40 12 L36 25 Z',steel),
  ...boots,
  p('M34 35 L58 33 L66 47 L60 68 L64 76 L34 79 L28 73 L34 57 L25 45 Z','#75988b'),
  p('M35 39 L47 36 L47 57 L35 64 Z','#b6bfaa',null),
  p('M39 35 L45 35 L61 62 L56 66 Z',leather),
  ...belt,
  ...face,
  p('M33 26 Q34 12 47 8 Q59 8 66 19 L68 28 L58 25 L46 24 L38 31 Z','#536f69'),
  p('M33 25 L47 22 L68 25 L73 29 L53 30 L33 29 Z','#b5a17a'),
  p('M30 43 L22 47 L26 58 L42 58 L47 53 L37 51 Z',leather),
  p('M57 40 L68 45 L72 53 L66 60 L58 55 L50 48 Z',leather),
  p('M42 51 L49 49 L54 53 L48 58 L42 58 Z',skin),
  p('M66 50 L73 48 L77 53 L73 59 L67 59 Z',skin),
  line('M75 17 Q95 31 91 52 Q89 69 75 82','#28272a'),
  line('M75 17 Q91 32 88 52 Q85 69 75 82','#d0b484'),
  line('M75 17 L68 50 L75 82','#d8d3bc')
 ])
});
export const STANDEE_TYPES=Object.freeze(Object.keys(STANDEE_PARTS));
export function paintStandee(ctx,type,makePath=d=>new Path2D(d)){
 const parts=STANDEE_PARTS[type];if(!parts)return false;
 ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=2.25;
 for(const [d,fill,stroke] of parts){
  const path=makePath(d);if(fill){ctx.fillStyle=fill;ctx.fill(path);}
  if(stroke){ctx.strokeStyle=stroke;ctx.stroke(path);}
 }
 return true;
}
