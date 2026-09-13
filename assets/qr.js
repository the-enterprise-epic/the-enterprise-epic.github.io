/* QR encoder (byte mode, ECC level L, versions 1 to 10).
   Encoding logic by Sanjeev Azad, first written for C2Valis / The Value Cube.
   Self-contained: no dependencies, no network.

   Only the output differs from the original: colours follow The Enterprise EPIC
   design system (ink modules on a parchment-pale ground) and can be overridden.

   window.QR.svg(text, { fg, bg }) -> SVG string                                 */
const QR=(function(){
  const EXP=new Array(512), LOG=new Array(256);
  (function(){ let x=1; for(let i=0;i<255;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x&0x100) x^=0x11D; }
    for(let i=255;i<512;i++) EXP[i]=EXP[i-255]; })();
  const mul=(a,b)=>(a===0||b===0)?0:EXP[LOG[a]+LOG[b]];
  function genPoly(n){ let g=[1];
    for(let i=0;i<n;i++){ const r=new Array(g.length+1).fill(0);
      for(let j=0;j<g.length;j++){ r[j]^=g[j]; r[j+1]^=mul(g[j],EXP[i]); } g=r; } return g; }
  function rsEnc(d,ecLen){ const g=genPoly(ecLen), res=d.concat(new Array(ecLen).fill(0));
    for(let i=0;i<d.length;i++){ const f=res[i]; if(!f) continue;
      for(let j=0;j<g.length;j++) res[i+j]^=mul(g[j],f); } return res.slice(d.length); }
  /* [totalCodewords, ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] at ECC level L */
  const V=[null,[26,7,1,19,0,0],[44,10,1,34,0,0],[70,15,1,55,0,0],[100,20,1,80,0,0],[134,26,1,108,0,0],
    [172,18,2,68,0,0],[196,20,2,78,0,0],[242,24,2,97,0,0],[292,30,2,116,0,0],[346,18,2,68,2,69]];
  const ALIGN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
  const MASK=[(r,c)=>(r+c)%2===0,(r,c)=>r%2===0,(r,c)=>c%3===0,(r,c)=>(r+c)%3===0,
    (r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,(r,c)=>(r*c)%2+(r*c)%3===0,
    (r,c)=>((r*c)%2+(r*c)%3)%2===0,(r,c)=>((r+c)%2+(r*c)%3)%2===0];

  function encode(text){
    const bytes=Array.from(new TextEncoder().encode(text));
    let ver=0;
    for(let v=1;v<=10;v++){ const [,,b1,d1,b2,d2]=V[v];
      if(bytes.length<=Math.floor(((b1*d1+b2*d2)*8-4-(v<10?8:16))/8)){ ver=v; break; } }
    if(!ver) throw new Error('QR: payload too long');
    const [,ecLen,b1,d1,b2,d2]=V[ver], dataCw=b1*d1+b2*d2;

    const bits=[], push=(val,len)=>{ for(let i=len-1;i>=0;i--) bits.push((val>>i)&1); };
    push(4,4); push(bytes.length, ver<10?8:16); bytes.forEach(b=>push(b,8));
    for(let i=0;i<4 && bits.length<dataCw*8;i++) bits.push(0);
    while(bits.length%8) bits.push(0);
    const cw=[]; for(let i=0;i<bits.length;i+=8){ let b=0; for(let j=0;j<8;j++) b=(b<<1)|bits[i+j]; cw.push(b); }
    for(let i=0; cw.length<dataCw; i++) cw.push(i%2?0x11:0xEC);

    const blocks=[], ecBlocks=[]; let p=0;
    for(let i=0;i<b1;i++){ const d=cw.slice(p,p+d1); p+=d1; blocks.push(d); ecBlocks.push(rsEnc(d,ecLen)); }
    for(let i=0;i<b2;i++){ const d=cw.slice(p,p+d2); p+=d2; blocks.push(d); ecBlocks.push(rsEnc(d,ecLen)); }
    const out=[], maxD=Math.max(d1,d2);
    for(let i=0;i<maxD;i++) for(const b of blocks) if(i<b.length) out.push(b[i]);
    for(let i=0;i<ecLen;i++) for(const b of ecBlocks) out.push(b[i]);

    const size=17+4*ver;
    const m=Array.from({length:size},()=>new Array(size).fill(0));
    const fn=Array.from({length:size},()=>new Array(size).fill(false));
    const set=(r,c,v)=>{ m[r][c]=v?1:0; fn[r][c]=true; };
    const finder=(r,c)=>{ for(let dr=-1;dr<=7;dr++) for(let dc=-1;dc<=7;dc++){
      const rr=r+dr, cc=c+dc; if(rr<0||rr>=size||cc<0||cc>=size) continue;
      const d=Math.max(Math.abs(dr-3),Math.abs(dc-3)); set(rr,cc, d!==2&&d!==4); }};
    finder(0,0); finder(0,size-7); finder(size-7,0);
    for(let i=8;i<size-8;i++){ set(6,i,i%2===0); set(i,6,i%2===0); }
    const ac=ALIGN[ver];
    for(const r of ac) for(const c of ac){
      if((r===6&&c===6)||(r===6&&c===size-7)||(r===size-7&&c===6)) continue;
      for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++)
        set(r+dr,c+dc, Math.max(Math.abs(dr),Math.abs(dc))!==1); }
    for(let i=0;i<=8;i++){ if(!fn[8][i]) set(8,i,0); if(!fn[i][8]) set(i,8,0); }
    for(let i=0;i<8;i++){ if(!fn[8][size-1-i]) set(8,size-1-i,0); if(!fn[size-1-i][8]) set(size-1-i,8,0); }
    set(size-8,8,1);
    if(ver>=7){ let rem=ver; for(let i=0;i<12;i++) rem=(rem<<1)^((rem>>>11)*0x1F25);
      const vb=(ver<<12)|rem;
      for(let i=0;i<18;i++){ const bit=(vb>>>i)&1, a=size-11+i%3, b=Math.floor(i/3); set(b,a,bit); set(a,b,bit); } }

    let bi=0; const total=out.length*8;
    for(let right=size-1; right>=1; right-=2){
      if(right===6) right=5;
      for(let vert=0; vert<size; vert++) for(let j=0;j<2;j++){
        const c=right-j, up=((right+1)&2)===0, r=up?size-1-vert:vert;
        if(!fn[r][c] && bi<total){ m[r][c]=(out[bi>>3]>>>(7-(bi&7)))&1; bi++; } } }

    function drawFormat(g,mask){
      let d=(1<<3)|mask, rem=d;
      for(let i=0;i<10;i++) rem=(rem<<1)^((rem>>>9)*0x537);
      const b=((d<<10)|rem)^0x5412, gb=i=>(b>>>i)&1;
      for(let i=0;i<=5;i++) g[i][8]=gb(i);
      g[7][8]=gb(6); g[8][8]=gb(7); g[8][7]=gb(8);
      for(let i=9;i<15;i++) g[8][14-i]=gb(i);
      for(let i=0;i<8;i++) g[8][size-1-i]=gb(i);
      for(let i=8;i<15;i++) g[size-15+i][8]=gb(i);
      g[size-8][8]=1;
    }
    function penalty(g){
      let s=0;
      const run=arr=>{ let n=1; for(let i=1;i<arr.length;i++){ if(arr[i]===arr[i-1]) n++; else { if(n>=5) s+=3+(n-5); n=1; } } if(n>=5) s+=3+(n-5); };
      const lines=[];
      for(let r=0;r<size;r++) lines.push(g[r]);
      for(let c=0;c<size;c++){ const col=[]; for(let r=0;r<size;r++) col.push(g[r][c]); lines.push(col); }
      lines.forEach(run);
      for(let r=0;r<size-1;r++) for(let c=0;c<size-1;c++){ const v=g[r][c];
        if(v===g[r][c+1]&&v===g[r+1][c]&&v===g[r+1][c+1]) s+=3; }
      const P=[1,0,1,1,1,0,1];
      const light4=(a,i)=>{ for(let k=0;k<4;k++){ if(i+k<0||i+k>=size||a[i+k]!==0) return false; } return true; };
      for(const a of lines) for(let i=0;i+7<=size;i++){
        let hit=true; for(let k=0;k<7;k++) if(a[i+k]!==P[k]){ hit=false; break; }
        if(hit && (light4(a,i-4)||light4(a,i+7))) s+=40; }
      let dark=0; for(let r=0;r<size;r++) for(let c=0;c<size;c++) dark+=g[r][c];
      s+=Math.floor(Math.abs(dark*100/(size*size)-50)/5)*10;
      return s;
    }
    let best=null, bestScore=Infinity;
    for(let k=0;k<8;k++){
      const g=m.map(r=>r.slice());
      for(let r=0;r<size;r++) for(let c=0;c<size;c++) if(!fn[r][c] && MASK[k](r,c)) g[r][c]^=1;
      drawFormat(g,k);
      const sc=penalty(g);
      if(sc<bestScore){ bestScore=sc; best=g; } }
    return {size, modules:best};
  }

  /* Ink on parchment-pale by default. Contrast between #20374F and #FAF6EA is
     roughly 11:1, well above what phone cameras need to read the code. */
  function svg(text, opts){
    const o=opts||{}, fg=o.fg||'#20374F', bg=o.bg||'#FAF6EA';
    const {size,modules}=encode(text), q=4, dim=size+q*2;   /* q = spec quiet zone */
    let path='';
    for(let r=0;r<size;r++){ let c=0;
      while(c<size){ if(modules[r][c]){ let w=1; while(c+w<size&&modules[r][c+w]) w++;
        path+='M'+(c+q)+' '+(r+q)+'h'+w+'v1h-'+w+'z'; c+=w; } else c++; } }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+dim+' '+dim+'" shape-rendering="crispEdges" role="img" aria-hidden="true">'
      +'<rect width="'+dim+'" height="'+dim+'" fill="'+bg+'"/><path d="'+path+'" fill="'+fg+'"/></svg>';
  }
  return {svg};
})();
window.QR=QR;
