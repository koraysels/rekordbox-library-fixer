import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useStatistics } from '../../hooks/useStatistics';
import { PageHeader } from '../ui';
import { Download } from 'lucide-react';

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
                <YAxis dataKey="label" type="category" width={120} />
                <Tooltip />
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
