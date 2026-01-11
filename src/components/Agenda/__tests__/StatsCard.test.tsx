import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatsCard } from '../StatsCard';

describe('StatsCard', () => {
  it('should render stats correctly', () => {
    const stats = {
      todo: 5,
      overdue: 2,
      completed: 3,
      total: 8
    };

    render(<StatsCard title="My Stats" stats={stats} />);

    expect(screen.getByText('My Stats')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3/8')).toBeInTheDocument();
  });

  it('should not render overdue if 0', () => {
    const stats = {
      todo: 5,
      overdue: 0,
      completed: 3,
      total: 8
    };

    render(<StatsCard title="My Stats" stats={stats} />);

    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });
});
