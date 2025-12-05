import { describe, it, expect, vi } from 'vitest';
import { render } from '../test-utils';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders with text', () => {
    const { getByRole } = render(<Button>Click me</Button>);
    expect(getByRole('button', { name: /click me/i })).toBeDefined();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    const { getByRole } = render(<Button onClick={handleClick}>Click me</Button>);
    
    getByRole('button').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    const { getByRole } = render(<Button disabled>Disabled</Button>);
    expect(getByRole('button')).toHaveProperty('disabled', true);
  });

  it('renders different variants', () => {
    const { getByRole, rerender } = render(<Button variant="default">Default</Button>);
    expect(getByRole('button').className).toContain('bg-primary');

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(getByRole('button').className).toContain('bg-destructive');

    rerender(<Button variant="outline">Outline</Button>);
    expect(getByRole('button').className).toContain('border');
  });
});
