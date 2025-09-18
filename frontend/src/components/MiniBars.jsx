import React from 'react';

/**
 * MiniBars - gráfico de barras compacto en SVG (sin librerías)
 * props:
 *  - values: number[]             // datos
 *  - labels?: string[]            // etiquetas (para <title/>)
 *  - height?: number = 72         // alto total del SVG
 *  - barWidth?: number = 12       // ancho de cada barra (px)
 *  - gap?: number = 6             // separación entre barras (px)
 *  - color?: string = '#2563eb'   // color de barras
 *  - bg?: string = 'transparent'  // fondo
 *  - stretch?: boolean = true     // si true, width="100%"; si false, width = ancho real de barras
 */
export default function MiniBars({
  values = [],
  labels = [],
  height = 72,
  barWidth = 12,
  gap = 6,
  color = '#2563eb',
  bg = 'transparent',
  stretch = true,
}) {
  const n = values.length;
  if (!n) return <div style={{color:'#6b7280', fontSize:12}}>(Sin datos)</div>;

  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  const pad = 6;
  const innerH = Math.max(height - pad*2, 10);
  const scaleY = innerH / range;
  const baselineY = pad + (max - 0) * scaleY;

  // ancho real según cantidad de barras
  const w = n * barWidth + (n - 1) * gap;

  const svgProps = stretch
    ? { width: '100%', viewBox: `0 0 ${w} ${height}` }
    : { width: w, height }; // no usar viewBox si no se estira, así respeta píxeles

  return (
    <svg role="img" aria-label="Barras" {...svgProps}>
      {bg !== 'transparent' && <rect x="0" y="0" width={w} height={height} fill={bg} />}
      {min < 0 && max > 0 && (
        <line x1="0" y1={baselineY} x2={w} y2={baselineY} stroke="#e5e7eb" strokeWidth="1" />
      )}
      {values.map((v, i) => {
        const x = i * (barWidth + gap);
        const isPos = v >= 0;
        const barH = Math.abs(v - 0) * scaleY;
        const y = isPos ? baselineY - barH : baselineY;
        const title = (labels[i] ?? `#${i+1}`) + ' — ' + String(v);
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} rx="2" fill={color} />
            <title>{title}</title>
          </g>
        );
      })}
    </svg>
  );
}
