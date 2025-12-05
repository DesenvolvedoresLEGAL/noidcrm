// Storybook stories for Button component
// Note: Install @storybook/react-vite to run: npx storybook@latest init

import { Button } from './button';
import { Mail, Loader2 } from 'lucide-react';

// Story configuration
export default {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export const Default = {
  args: {
    children: 'Button',
  },
};

export const Destructive = {
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
};

export const Outline = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const Secondary = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Ghost = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
};

export const Link = {
  args: {
    variant: 'link',
    children: 'Link Button',
  },
};

export const WithIcon = {
  render: () => (
    <Button>
      <Mail className="mr-2 h-4 w-4" />
      Login with Email
    </Button>
  ),
};

export const Loading = {
  render: () => (
    <Button disabled>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Please wait
    </Button>
  ),
};

export const Small = {
  args: {
    size: 'sm',
    children: 'Small',
  },
};

export const Large = {
  args: {
    size: 'lg',
    children: 'Large',
  },
};

export const IconOnly = {
  render: () => (
    <Button size="icon" aria-label="Send email">
      <Mail className="h-4 w-4" />
    </Button>
  ),
};
