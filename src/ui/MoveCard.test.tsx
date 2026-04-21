import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoveCard } from './MoveCard';

describe('MoveCard', () => {
  it('renders the SAN text', () => {
    render(<MoveCard san="e4" variant="child" onClick={() => {}} />);
    expect(screen.getByText('e4')).toBeInTheDocument();
  });

  it('fires onClick when clicked', async () => {
    const handler = vi.fn();
    render(<MoveCard san="e4" variant="child" onClick={handler} />);
    await userEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('variant="parent" renders an up-arrow icon', () => {
    const { container } = render(
      <MoveCard san="e4" variant="parent" onClick={() => {}} />,
    );
    // lucide-react renders SVGs; look for the svg inside the button.
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('variant="child" does not render the up-arrow icon', () => {
    const { container } = render(
      <MoveCard san="e4" variant="child" onClick={() => {}} />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('isEntering adds the card-enter animation class', () => {
    const { container } = render(
      <MoveCard san="e4" variant="child" onClick={() => {}} isEntering />,
    );
    expect(container.firstChild).toHaveClass('animate-card-enter');
  });

  it('isFocusPulse adds the focus-pulse animation class', () => {
    const { container } = render(
      <MoveCard san="e4" variant="child" onClick={() => {}} isFocusPulse />,
    );
    expect(container.firstChild).toHaveClass('animate-focus-pulse');
  });
});
