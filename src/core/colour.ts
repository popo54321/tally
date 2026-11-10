// Colour maths for themes: contrast as defined by the web accessibility guidelines (WCAG 2).

export const hexRgb = (h: string): number[] => [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export const rgbHex = (c: number[]): string => '#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
export function luminance(c: number[]): number { const [r,g,b]=c.map(v=>{ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*r+0.7152*g+0.0722*b; }
export const contrast = (a: number[], b: number[]): number => { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
/** The faint text colour, darkened towards the ink just enough to reach 4.5:1 contrast on every background given. */
export function legibleFaint(faint: string, ink: string, grounds: string[]): string {
  const f=hexRgb(faint), k=hexRgb(ink), gs=grounds.map(hexRgb);
  for(let s=0; s<=100; s++){
    const m=f.map((v,i)=>Math.round(v+(k[i]-v)*s/100));
    if(gs.every(g=>contrast(m,g)>=4.5)) return rgbHex(m);
  }
  return ink;
}
