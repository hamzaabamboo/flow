import { describe, it, expect } from 'vitest';
import { getPriorityColor, getPriorityIcon } from '../priority';
import { render } from '@testing-library/react';

describe('priority utils', () => {
  it('getPriorityColor should return correct colors', () => {
    expect(getPriorityColor('urgent')).toBe('red');
    expect(getPriorityColor('high')).toBe('orange');
    expect(getPriorityColor('medium')).toBe('yellow');
    expect(getPriorityColor('low')).toBe('green');
    expect(getPriorityColor('unknown')).toBe('gray');
    expect(getPriorityColor()).toBe('gray');
  });

  it('getPriorityIcon should return correct icons', () => {
    const { container: urgentIcon } = render(<>{getPriorityIcon('urgent')}</>);
    expect(urgentIcon.querySelector('svg')).toBeInTheDocument();

    const { container: highIcon } = render(<>{getPriorityIcon('high')}</>);
    expect(highIcon.querySelector('svg')).toBeInTheDocument();

    const { container: noIcon } = render(<>{getPriorityIcon()}</>);
    expect(noIcon.querySelector('svg')).not.toBeInTheDocument();
  });
});
