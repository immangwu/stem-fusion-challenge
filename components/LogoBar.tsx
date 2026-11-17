/** Partner logos: full Science Club logo + the SNR / SRIT / HIVE / ASME strip (strip is cropped to hide its clipped first logo). */
export default function LogoBar({ className = '' }: { className?: string }) {
  return (
    <div className={`logos ${className}`}>
      <img className="logos-sc" src="/science-club-logo.png" alt="Science Club" />
      <div className="logos-clip"><img src="/api/assets/logos-strip.png" alt="SNR Sons Trust, Sri Ramakrishna Institute of Technology, HIVE and ASME SRIT" /></div>
    </div>
  );
}
