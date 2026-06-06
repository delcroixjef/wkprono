import ballAsset from "@/assets/wk2026-ball.png.asset.json";

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <img
      src={ballAsset.url}
      alt="WK 2026 Prono"
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
