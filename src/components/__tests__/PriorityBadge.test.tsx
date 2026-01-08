import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PriorityBadge } from '../PriorityBadge';

describe('PriorityBadge', () => {
  it('should render urgent priority correctly', () => {
    render(<PriorityBadge priority="urgent" />);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('should render high priority correctly', () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('should render medium priority correctly', () => {
    render(<PriorityBadge priority="medium" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('should render low priority correctly', () => {
    render(<PriorityBadge priority="low" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('should return null for unknown priority', () => {
    const { container } = render(<PriorityBadge priority="unknown" />);
    expect(container.firstChild).toBeNull();
  });

  it('should hide icon when showIcon is false', () => {
    const { container } = render(<PriorityBadge priority="urgent" showIcon={false} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
