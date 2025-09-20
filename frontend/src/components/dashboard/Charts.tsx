import { motion } from 'framer-motion';
import React from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  children,
  className = '',
  loading = false,
}) => {
  if (loading) {
    return (
      <div className={`bg-white shadow rounded-lg p-6 ${className}`}>
        <div className="h-6 bg-gray-200 rounded animate-pulse mb-4 w-1/3" />
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white shadow rounded-lg p-6 ${className}`}
    >
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <div className="h-64">
        {children}
      </div>
    </motion.div>
  );
};

interface SalesChartProps {
  data: Array<{
    date: string;
    sales: number;
    revenue: number;
  }>;
}

export const SalesChart: React.FC<SalesChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip 
          formatter={(value, name) => [
            name === 'sales' ? `${value} sales` : `$${value}`,
            name === 'sales' ? 'Sales' : 'Revenue'
          ]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stackId="1"
          stroke="#8884d8"
          fill="#8884d8"
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stackId="1"
          stroke="#82ca9d"
          fill="#82ca9d"
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

interface InventoryChartProps {
  data: Array<{
    store: string;
    items: number;
    lowStock: number;
  }>;
}

export const InventoryChart: React.FC<InventoryChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="store" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="items" fill="#3B82F6" name="Total Items" />
        <Bar dataKey="lowStock" fill="#EF4444" name="Low Stock" />
      </BarChart>
    </ResponsiveContainer>
  );
};

interface CategoryDistributionProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

export const CategoryDistribution: React.FC<CategoryDistributionProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value} products`, 'Count']} />
      </PieChart>
    </ResponsiveContainer>
  );
};

interface TrendChartProps {
  data: Array<{
    period: string;
    value: number;
  }>;
  color?: string;
  title?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({ 
  data, 
  color = '#3B82F6',
  title = 'Trend'
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip formatter={(value) => [value, title]} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};