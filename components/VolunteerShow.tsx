'use client';
import { useEffect, useRef } from 'react';

export type Vol = { name: string; dept: string; img: string };

export default function VolunteerShow({ people }: { people: Vol[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const zoomT = useRef(0);
  const zoomBy = (d: number) => { zoomT.current = Math.max(-260, Math.min(420, zoomT.current + d)); };

  // 3D ring: auto-rotates, drag / swipe to spin, hover to pause.
  useEffect(() => {
    const el = ring.current; if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let zoom = 0, angle = 0, vel = reduce ? 0 : 0.18, drag = false, lastX = 0, hover = false, raf = 0;
    const tick = () => {
      if (!drag && !hover) angle += vel; else if (!drag) angle += vel * 0.15;
      if (!drag && Math.abs(vel) > 0.18) vel *= 0.96;
      zoom += (zoomT.current - zoom) * 0.12;
      el.style.transform = `translateZ(calc(var(--r) * -1 + ${zoom.toFixed(1)}px)) rotateY(${angle}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const st = stage.current!;
    const down = (e: PointerEvent) => { drag = true; lastX = e.clientX; st.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (!drag) return; const dx = e.clientX - lastX; lastX = e.clientX; angle += dx * 0.45; vel = Math.max(-3, Math.min(3, dx * 0.2)) || vel; };
    const up = () => { drag = false; if (Math.abs(vel) < 0.18) vel = 0.18; };
    st.addEventListener('pointerdown', down); st.addEventListener('pointermove', move); st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(-e.deltaY * 0.6); };
    st.addEventListener('wheel', wheel, { passive: false });
    const enter = () => (hover = true), leave = () => (hover = false);
    st.addEventListener('mouseenter', enter); st.addEventListener('mouseleave', leave);
    return () => { cancelAnimationFrame(raf); st.removeEventListener('pointerdown', down); st.removeEventListener('pointermove', move); st.removeEventListener('pointerup', up); st.removeEventListener('pointercancel', up); st.removeEventListener('wheel', wheel); st.removeEventListener('mouseenter', enter); st.removeEventListener('mouseleave', leave); };
  }, []);

  // Grid cards: tilt + glare toward the pointer; reveal on scroll.
  useEffect(() => {
    const r = root.current; if (!r) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15 });
    r.querySelectorAll('.vcard').forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  const tilt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = e.currentTarget, b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
    el.style.setProperty('--rx', `${(-y * 16).toFixed(1)}deg`); el.style.setProperty('--ry', `${(x * 20).toFixed(1)}deg`);
    el.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(0)}%`); el.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(0)}%`);
  };
  const untilt = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.setProperty('--rx', '0deg'); e.currentTarget.style.setProperty('--ry', '0deg'); };

  return (
    <div ref={root} className="vol">
      <style>{CSS}</style>
      <div className="sparks" aria-hidden>{Array.from({ length: 26 }).map((_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * -1.3}s`, animationDuration: `${9 + (i % 7)}s`, width: 3 + (i % 3), height: 3 + (i % 3) }} />)}</div>
      <div className="vhero">
        <div className="eyebrow">HIVE ◆ STEM FUSION CHALLENGE ◆ SPARKS-2K26</div>
        <h1 className="title"><span>Our Student</span> Volunteers</h1>
        <p className="sub">The organizing team that makes it all happen. Drag left or right to spin the ring. Scroll or use +/− to zoom.</p>
      </div>
      <div className="stage" ref={stage} aria-label="Rotating ring of student volunteers">
        <div className="ring" ref={ring} style={{ ['--n' as string]: people.length }}>
          {people.map((p, i) => (
            <figure className="face" key={p.name} style={{ ['--i' as string]: i }}>
              <img src={p.img} alt={p.name} draggable={false} />
              <figcaption><b>{p.name}</b><span>{p.dept}</span></figcaption>
            </figure>))}
        </div>
        <div className="floor" aria-hidden />
      </div>
      <div className="zoombar" role="group" aria-label="Zoom">
        <button type="button" onClick={() => zoomBy(-120)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => { zoomT.current = 0; }} aria-label="Reset zoom">Reset</button>
        <button type="button" onClick={() => zoomBy(120)} aria-label="Zoom in">+</button>
      </div>
      <h2 className="gh">Meet the team</h2>
      <div className="vgrid">
        {people.map((p, i) => (
          <div className="vcard" key={p.name} style={{ ['--d' as string]: `${(i % 6) * 70}ms` }} onMouseMove={tilt} onMouseLeave={untilt}>
            <div className="inner">
              <div className="glare" />
              <div className="medal"><img src={p.img} alt={p.name} loading="lazy" /></div>
              <div className="role">MEMBER</div>
              <div className="nm">{p.name}</div>
              <div className="dp">{p.dept}</div>
            </div>
          </div>))}
      </div>
    </div>
  );
}

const CSS = `
body{overflow-x:hidden}
.vol{position:relative;width:100vw;margin:-22px 0 -60px calc(50% - 50vw);padding:34px 16px 80px;color:#f8fafc;background:radial-gradient(1000px 520px at 50% -5%,#0f6b4a 0,transparent 62%),radial-gradient(800px 500px at 90% 60%,#0a4a35 0,transparent 60%),#06231a;overflow:hidden;min-height:80vh;perspective:1400px}
.vol *{box-sizing:border-box}
.vol .sparks i{position:absolute;bottom:-10px;border-radius:50%;background:#fbbf24;box-shadow:0 0 10px 2px rgba(251,191,36,.7);opacity:0;animation:vfloat linear infinite}
@keyframes vfloat{0%{transform:translateY(0) translateX(0);opacity:0}10%{opacity:.9}100%{transform:translateY(-85vh) translateX(30px);opacity:0}}
.vol .vhero{position:relative;text-align:center;max-width:900px;margin:0 auto}
.vol .eyebrow{letter-spacing:.28em;font-size:12px;color:#fcd34d;animation:vfade 1s both}
.vol .title{font-size:clamp(34px,7vw,68px);line-height:1.05;margin:12px 0 8px;font-weight:800;background:linear-gradient(100deg,#fff 20%,#fde68a 45%,#f59e0b 60%,#fff 85%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:vshine 5s linear infinite,vzoom 1.1s cubic-bezier(.2,.8,.2,1) both;text-shadow:0 18px 40px rgba(0,0,0,.4)}
.vol .title span{display:block;font-size:.5em;letter-spacing:.2em;text-transform:uppercase;font-weight:600}
@keyframes vshine{to{background-position:-220% 0}}
@keyframes vzoom{from{opacity:0;transform:translateZ(-300px) rotateX(40deg)}to{opacity:1;transform:none}}
@keyframes vfade{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
.vol .sub{color:#a7f3d0;margin:0}
.vol .stage{--r:min(46vw,430px);position:relative;height:clamp(330px,52vw,470px);margin:30px auto 10px;perspective:1300px;cursor:grab;touch-action:pan-y;overflow:visible;user-select:none}
.vol .stage:active{cursor:grabbing}
.vol .ring{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d;transform:translateZ(calc(var(--r) * -1))}
.vol .face{--w:clamp(104px,17vw,158px);position:absolute;left:calc(var(--w) / -2);top:calc(var(--w) * -0.78);width:var(--w);margin:0;text-align:center;transform:rotateY(calc(var(--i) * (360deg / var(--n)))) translateZ(var(--r));backface-visibility:visible}
.vol .face img{display:block;width:100%;aspect-ratio:1;border-radius:50%;border:4px solid #f5c542;box-shadow:0 0 0 3px rgba(245,197,66,.25),0 18px 30px rgba(0,0,0,.55),0 0 28px rgba(245,197,66,.35);background:#fff;-webkit-box-reflect:below 6px linear-gradient(transparent 70%,rgba(255,255,255,.28))}
.vol .face figcaption{margin-top:8px;font-size:12px;line-height:1.25;text-shadow:0 2px 6px #000}
.vol .face figcaption b{display:block;font-size:13px}
.vol .face figcaption span{color:#fcd34d}
.vol .zoombar{display:flex;gap:8px;justify-content:center;margin:6px 0 0;position:relative;z-index:2}.vol .zoombar button{all:unset;cursor:pointer;min-width:42px;text-align:center;padding:6px 14px;border-radius:99px;border:1px solid rgba(245,197,66,.6);background:rgba(0,0,0,.35);color:#fcd34d;font-weight:700;font-size:15px}.vol .zoombar button:hover{background:rgba(245,197,66,.2)}
.vol .floor{position:absolute;left:50%;bottom:6%;width:min(86vw,760px);height:90px;transform:translateX(-50%) rotateX(72deg);border-radius:50%;background:radial-gradient(ellipse at center,rgba(245,197,66,.35),rgba(245,197,66,0) 68%);filter:blur(4px);pointer-events:none}
.vol .gh{text-align:center;margin:30px 0 18px;font-size:22px;letter-spacing:.25em;text-transform:uppercase;color:#fcd34d}
.vol .vgrid{position:relative;display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:20px;max-width:1050px;margin:0 auto;perspective:1100px}
.vol .vcard{--rx:0deg;--ry:0deg;--gx:50%;--gy:50%;opacity:0;transform:translateY(60px) rotateX(-35deg);transition:opacity .7s var(--d,0ms),transform .8s cubic-bezier(.2,.8,.2,1) var(--d,0ms)}
.vol .vcard.in{opacity:1;transform:none}
.vol .vcard .inner{position:relative;transform-style:preserve-3d;transform:rotateX(var(--rx)) rotateY(var(--ry));transition:transform .15s ease-out;padding:22px 12px 18px;text-align:center;border-radius:16px;border:1px solid rgba(245,197,66,.55);background:linear-gradient(160deg,rgba(16,90,62,.95),rgba(7,40,30,.95));box-shadow:0 14px 34px rgba(0,0,0,.45),inset 0 0 0 4px rgba(6,35,26,.9),inset 0 0 0 5px rgba(245,197,66,.25);animation:vbob 5s ease-in-out infinite;animation-delay:var(--d,0ms)}
@keyframes vbob{50%{translate:0 -6px}}
.vol .vcard:hover .inner{animation-play-state:paused;box-shadow:0 26px 50px rgba(0,0,0,.6),0 0 30px rgba(245,197,66,.35),inset 0 0 0 4px rgba(6,35,26,.9),inset 0 0 0 5px rgba(245,197,66,.5)}
.vol .glare{position:absolute;inset:0;border-radius:16px;pointer-events:none;background:radial-gradient(circle at var(--gx) var(--gy),rgba(255,255,255,.28),transparent 55%);mix-blend-mode:overlay}
.vol .medal{transform:translateZ(55px);width:112px;margin:0 auto}
.vol .medal img{display:block;width:100%;aspect-ratio:1;border-radius:50%;border:4px solid #f5c542;box-shadow:0 10px 22px rgba(0,0,0,.5),0 0 18px rgba(245,197,66,.4);background:#fff}
.vol .role{transform:translateZ(35px);display:inline-block;margin:12px 0 6px;padding:2px 16px;font-size:10px;letter-spacing:.3em;font-weight:700;color:#fcd34d;border:1px solid rgba(245,197,66,.55);border-radius:99px;background:rgba(0,0,0,.25)}
.vol .nm{transform:translateZ(45px);font-weight:700;font-size:15px}
.vol .dp{transform:translateZ(30px);font-size:13px;color:#a7f3d0}
@media (prefers-reduced-motion:reduce){.vol *{animation:none!important;transition:none!important}.vol .vcard{opacity:1;transform:none}}
`;
