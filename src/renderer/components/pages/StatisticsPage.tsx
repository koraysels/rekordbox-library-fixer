import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useStatistics } from '../../hooks/useStatistics';
import { PageHeader } from '../ui';
import { Download } from 'lucide-react';
import type { GenreDistributionItem } from '../../types';

// Custom tooltip for genre chart to display titles
const GenreTooltip: React.FC<{ active?: boolean; payload?: unknown[] }> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  // The payload item is the distribution item for the hovered bar
  const raw0 = payload[0] as { payload?: unknown } | undefined;
  const item = (raw0 && raw0.payload) as GenreDistributionItem | undefined;
  if (!item) {
    return null;
  }
  const titles = item.titles || [];
  const MAX_SHOW = 100;
  const shown = titles.slice(0, MAX_SHOW);
  const remaining = Math.max(0, titles.length - shown.length);

  return (
    <div className="bg-white p-2 rounded shadow-md max-w-md" style={{ minWidth: 220 }}>
      <div className="font-semibold">{item.label}</div>
      <div className="text-sm text-te-grey-600">{item.count} tracks</div>
      <div className="mt-2 text-xs">
        {shown.length === 0 ? (
          <div className="text-te-grey-500">No titles available</div>
        ) : (
          // Display titles in two columns (two titles per row)
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 max-h-48 overflow-auto">
            {shown.map((t: string, i: number) => (
              <div key={`${item.label}-${i}`} className="text-xs truncate pr-2">{t}</div>
            ))}
          </div>
        )}
        {remaining > 0 && <div className="text-xs text-te-grey-500 mt-1">...and {remaining} more</div>}
      </div>
    </div>
  );
};

// Custom tick renderer for the YAxis: show genre label and the top title on two rows
interface GenreTickProps {
  x?: number | string;
  y?: number | string;
  payload?: unknown;
  titlesMap: Record<string, string[]>;
}

const GenreTick: React.FC<GenreTickProps> = ({ x = 0, y = 0, payload, titlesMap }) => {
  if (!payload) {
    return null;
  }
  // payload is provided by recharts; it usually contains a `value` property with the tick label
  const p = payload as { value?: unknown };
  const label = p.value ? String(p.value) : '';
  const titles = titlesMap[label] || [];
  const firstTitle = titles[0] || '';

  // Render two lines using <tspan> inside SVG <text>
  return (
    <text x={String(x)} y={String(y)} textAnchor="end" className="recharts-text recharts-cartesian-axis-tick-value" style={{ fontSize: 12, fill: '#374151' }}>
      <tspan x={String(x)} dy={-4} className="recharts-text recharts-cartesian-axis-tick-value" style={{ fontWeight: 600 }}>{label}</tspan>
      <tspan x={String(x)} dy={14} className="recharts-text recharts-cartesian-axis-tick-value" style={{ fontSize: 10, fill: '#6B7280' }}>{firstTitle}</tspan>
    </text>
  );
};

export const StatisticsPage: React.FC = () => {
  const stats = useStatistics();

  if (!stats || stats.totalTracks === 0) {
    return (
      <div className="p-te-lg">
        <PageHeader title="Statistics" icon={Download} />
        <div className="mt-te-md text-te-grey-500">Load a library to view statistics.</div>
      </div>
    );
  }

  // map genre label -> titles array for quick lookup in tick renderer
  const genreTitleMap: Record<string, string[]> = (stats.genreDistribution as GenreDistributionItem[]).reduce<Record<string, string[]>>((acc, g) => {
    acc[g.label] = g.titles || [];
    return acc;
  }, {});

  return (
    <div className="p-te-lg h-full overflow-auto">
      <PageHeader title="Statistics" icon={Download} />

      {/* Top stat cards */}
      <div className="grid grid-cols-3 gap-te-md mt-te-md">
        <div className="bg-white rounded-te p-te-md shadow-sm">
          <p className="text-xs text-te-grey-400 uppercase">Total Tracks</p>
          <h2 className="text-2xl font-bold mt-2">{stats.totalTracks}</h2>
        </div>
        <div className="bg-white rounded-te p-te-md shadow-sm">
          <p className="text-xs text-te-grey-400 uppercase">Total Playlists</p>
          <h2 className="text-2xl font-bold mt-2">{stats.totalPlaylists}</h2>
        </div>
        <div className="bg-white rounded-te p-te-md shadow-sm">
          <p className="text-xs text-te-grey-400 uppercase">Tracks with special tags</p>
          <h2 className="text-2xl font-bold mt-2">{stats.specialTagCount}</h2>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-2 gap-te-md mt-te-md">
        {/* Genres */}
        <div className="bg-white rounded-te p-te-md shadow-sm">
          <p className="text-sm font-medium">Top Genres</p>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart layout="vertical" data={stats.genreDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="label" type="category" width={160} tick={(props) => <GenreTick {...props} titlesMap={genreTitleMap} />} />
                <Tooltip content={<GenreTooltip />} />
                <Bar dataKey="count" fill="#4F46E5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BPM */}
        <div className="bg-white rounded-te p-te-md shadow-sm">
          <p className="text-sm font-medium">BPM Distribution</p>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={stats.bpmDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bin" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#06B6D4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Year distribution */}
      <div className="bg-white rounded-te p-te-md shadow-sm mt-te-md">
        <p className="text-sm font-medium">Year Distribution</p>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={stats.yearDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPage;
