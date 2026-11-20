import type { ReactElement } from 'react';

const NAVY = '#0a1a3a', GOLD = '#ffb703', CY = '#5ad1ff', LB = '#cfe8ff', PANEL = '#12305a';

export function shareCardJsx({ W, H, story, sc, iic, names, topic, teamName, score }: { W: number; H: number; story: boolean; sc: string; iic: string; names: string[]; topic: string; teamName: string; score: { p1: number; rank: number } | null }): ReactElement {
  const sq = !story;
  const k = sq ? 0.8 : 1;
  const nameSize = Math.round((teamName.length > 22 ? 64 : teamName.length > 14 ? 78 : 92) * k);
  const pad = sq ? 52 : 72;
  const logoH = sq ? 62 : 84;
  const titleSize = sq ? 72 : 112;
  return (
    <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: `linear-gradient(160deg, ${NAVY} 0%, #0d2552 55%, #123566 100%)`, color: 'white', padding: pad, position: 'relative', fontFamily: 'Inter' }}>
      <div style={{ position: 'absolute', top: -180, right: -180, width: 520, height: 520, borderRadius: 520, background: 'rgba(90,209,255,0.12)', display: 'flex' }} />
      <div style={{ position: 'absolute', bottom: story ? 260 : -160, left: -200, width: 480, height: 480, borderRadius: 480, background: 'rgba(255,183,3,0.10)', display: 'flex' }} />
      <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 24, padding: sq ? '10px 22px' : '14px 26px', alignSelf: 'flex-start' }}>
        <img src={sc} height={logoH} style={{ height: logoH, marginRight: 24 }} />
        <img src={iic} height={logoH} style={{ height: logoH }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: story ? 120 : 30 }}>
        <div style={{ display: 'flex', color: CY, fontSize: sq ? 24 : 30, fontWeight: 700, letterSpacing: 4 }}>SCIENCE CLUB, SRIT PRESENTS</div>
        <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 800, lineHeight: 1.02, marginTop: 10 }}>STEM FUSION</div>
        <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 800, lineHeight: 1.02, color: GOLD }}>CHALLENGE</div>
        <div style={{ display: 'flex', fontSize: sq ? 26 : 34, color: LB, marginTop: 8 }}>Think. Build. Prove.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: story ? 110 : 28, background: PANEL, border: `3px solid ${GOLD}`, borderRadius: 32, padding: sq ? 30 : 44 }}>
        <div style={{ display: 'flex', color: GOLD, fontSize: sq ? 22 : 28, fontWeight: 700, letterSpacing: 3 }}>PROUDLY REPRESENTING</div>
        <div style={{ display: 'flex', fontSize: nameSize, fontWeight: 800, marginTop: 6, lineHeight: 1.05 }}>{teamName}</div>
        <div style={{ display: 'flex', fontSize: sq ? 26 : 32, color: LB, marginTop: sq ? 10 : 18 }}>Project: {topic}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: sq ? 14 : 22 }}>
          {names.map((n, i) => (
            <div key={i} style={{ display: 'flex', fontSize: sq ? 21 : 26, padding: sq ? '6px 16px' : '8px 20px', borderRadius: 40, marginRight: 10, marginBottom: sq ? 8 : 12, background: i === 0 ? GOLD : 'rgba(255,255,255,0.1)', color: i === 0 ? NAVY : 'white', fontWeight: i === 0 ? 800 : 500 }}>
              {i === 0 ? 'Captain: ' : ''}{n}
            </div>
          ))}
        </div>
      </div>

      {score ? (
        <div style={{ display: 'flex', marginTop: sq ? 22 : 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: NAVY, border: `2px solid ${CY}`, borderRadius: 28, padding: sq ? '14px 26px' : '22px 30px', marginRight: 20 }}>
            <div style={{ display: 'flex', fontSize: 24, color: LB }}>Phase 1 · Mathematics</div>
            <div style={{ display: 'flex', fontSize: sq ? 52 : 64, fontWeight: 800, color: GOLD }}>{score.p1} <span style={{ fontSize: 28, color: LB, marginLeft: 10, marginTop: sq ? 22 : 30 }}>/ 20</span></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: NAVY, border: `2px solid ${CY}`, borderRadius: 28, padding: sq ? '14px 26px' : '22px 30px' }}>
            <div style={{ display: 'flex', fontSize: 24, color: LB }}>Current rank</div>
            <div style={{ display: 'flex', fontSize: sq ? 52 : 64, fontWeight: 800, color: GOLD }}>#{score.rank}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', marginTop: 24, fontSize: sq ? 26 : 32, color: LB }}>Building, calculating and proving it in 3 phases.</div>
      )}

      <div style={{ display: 'flex', flex: 1 }} />
      <div style={{ display: 'flex', flexDirection: 'column', borderTop: `4px solid ${GOLD}`, paddingTop: sq ? 14 : 22 }}>
        <div style={{ display: 'flex', fontSize: sq ? 22 : 26, color: LB }}>Technical Partners: HIVE and ASME SRIT</div>
        <div style={{ display: 'flex', fontSize: sq ? 26 : 30, fontWeight: 700, color: GOLD, marginTop: 4 }}>stem.asmesrit.com  ·  #STEMFusionChallenge</div>
      </div>
    </div>
  );
}
