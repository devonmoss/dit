import React from 'react';
import Layout from '../components/Layout/Layout';
import StatsDashboard from '../components/StatsDashboard/StatsDashboard';

const StatsPage: React.FC = () => (
  <Layout title="User Stats | Continuous Wave">
    <StatsDashboard />
  </Layout>
);

export default StatsPage;