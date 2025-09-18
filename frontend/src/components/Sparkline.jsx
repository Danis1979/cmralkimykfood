import React from 'react';

/**
 * Sparkline simple y liviano (sin dependencias)
 * props:
 *  - data: number[]
 *  - labels?: string[]
 *  - height?: number (default 36)
 *  - stroke?: string (default azul)
 *  - fill?: string (default azul suave)
 *  - thickness?: number (default 2)
 */
export default function Sparkline({
  data = [],
  labels = [],
  height = 36,
  stroke = '#2563eb',
  fill = 'rgba(37,99,235,0.08)',
  thickness = 2,
}) {
  const n = data.length;
  const h = Math.max(height, 24);
  const step = 22;                 // ancho por punto (compacto)
  const w = Math.max((n - 1) * step, 120);

  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const pad = 4; // padding vertical
  const points = data.map((v, i) => {
    const x = n === 1 ? w / 2 : (i * (w / (n - 1)));
    const y = h - ((v - min) / range) * (h - pad * 2) - pad;
    return [x, y];
  });

  const pathD = points.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
  const areaD = pathD ? pathD + ` L ${w},${h} L 0,${h} Z` : '';

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Tendencia">
      {areaD && <path d={areaD} fill={fill} stroke="none" />}
      {pathD && <path d={pathD} fill="none" stroke={stroke} strokeWidth={thickness} />}
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="2" fill={stroke} />
          <title>{(labels[i] ?? `#${i+1}`)} — {String(data[i])}</title>
        </g>
      ))}
    </svg>
  );
}
