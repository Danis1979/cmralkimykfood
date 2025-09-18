import React, { useMemo } from 'react';
import { formatARS } from '../utils/format';

export default function MiniBars({ data = [], height = 120 }) {
  const values = useMemo(() => data.map(d => d.net || 0), [data]);
  const max = useMemo(() => Math.max(1, ...values), [values]);

  return (
    <div className="w-full" style={{ height }}>
      <div className="h-full flex items-end gap-[6px]">
        {data.map((d, i) => {
          const h = Math.round((Math.max(0, d.net || 0) / max) * (height - 20));
          return (
            <div
              key={d.month ?? i}
              className="flex-1 min-w-[6px] bg-slate-300 hover:bg-slate-400 transition-colors"
              style={{ height: `${h}px` }}
              title={`${d.month} • ${formatARS(d.net)}`}
            />
          );
        })}
      </div>
    </div>
  );
}
