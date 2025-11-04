# Design System

A comprehensive design system for ARCHIVE wardrobe app, ensuring consistency across all pages and components.

## Structure

```
design-system/
├── tokens/
│   ├── colors.css      # Color variables
│   ├── typography.css  # Typography variables
│   └── spacing.css     # Spacing variables
├── components/
│   ├── Button.tsx      # Reusable button component
│   ├── Heading.tsx     # Reusable heading component
│   ├── Text.tsx        # Reusable text component
│   ├── Divider.tsx     # Reusable divider component
│   ├── PageHeader.tsx  # Page header component
│   └── SectionHeader.tsx # Section header component
└── index.ts            # Main export file
```

## Usage

### Import Components

```tsx
import { Button, Heading, Text, PageHeader, SectionHeader } from '../design-system';

// Use Button
<Button variant="primary" size="medium">Click Me</Button>
<Button variant="secondary" size="small">Cancel</Button>

// Use Heading
<Heading level={1}>Page Title</Heading>
<Heading level={2}>Section Title</Heading>

// Use Text
<Text variant="body">Body text</Text>
<Text variant="description">Description text</Text>

// Use PageHeader
<PageHeader 
  title="Page Title" 
  description="Page description"
/>

// Use SectionHeader
<SectionHeader 
  title="Section Title" 
  description="Section description"
/>
```

### Use CSS Variables

```css
.my-component {
  color: var(--color-text-primary);
  background: var(--color-background);
  padding: var(--spacing-4);
  font-size: var(--font-size-base);
  font-family: var(--font-sans);
  border: var(--border-width-thin) solid var(--color-border-primary);
}
```

## Design Tokens

### Colors
- `--color-black`: #000
- `--color-white`: #fff
- `--color-gray-*`: Gray scale (100-600)
- `--color-text-primary`: Primary text color
- `--color-text-secondary`: Secondary text color
- `--color-border-primary`: Primary border color
- `--color-border-secondary`: Secondary border color

### Typography
- Font families: `--font-serif`, `--font-sans`, `--font-mono`
- Font sizes: `--font-size-xs` through `--font-size-3xl`
- Font weights: `--font-weight-light` through `--font-weight-bold`
- Letter spacing: `--letter-spacing-tight` through `--letter-spacing-wider`

### Spacing
- Spacing scale: `--spacing-0` through `--spacing-16`
- Border widths: `--border-width-thin`, `--border-width-medium`

## Components

### Button
- Variants: `primary`, `secondary`
- Sizes: `small`, `medium`, `large`
- All standard button props supported

### Heading
- Levels: 1-6
- Automatically styled with serif font

### Text
- Variants: `body`, `description`, `small`, `caption`
- Can render as `p`, `span`, or `div`

### Divider
- Variants: `primary`, `secondary`
- Orientation: `horizontal`, `vertical`

### PageHeader
- Displays page title and optional description
- Supports actions in top-right corner

### SectionHeader
- Displays section title and optional description
- Includes light divider underneath

