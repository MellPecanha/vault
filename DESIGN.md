# The Vault Algorithm: Product and Design

## Product Context

The Vault Algorithm is a portfolio MVP for people reviewing or demonstrating backend work. A visitor should be able to play a short, understandable session without registering, while seeing that the server—not the browser—controls every spin, balance, prize, and history entry.

The experience is mysterious, tactile, and deliberate. It should feel like a well-kept vintage machine rather than a modern real-money betting product.

### Product Principles

- Make the machine feel physical while keeping every control legible.
- Clearly show server-owned state; the client never calculates game results.
- Give each action immediate, understandable feedback.
- Support a short, safe, registration-free session with no commercial pressure.
- Do not hide costs, prizes, or game rules.

### Accessibility

Maintain high contrast, visible focus states, keyboard-accessible controls, and text-based status messages. Respect reduced-motion preferences.

## Visual Direction

The interface is inspired by a hand-drawn vintage slot machine: dark walnut surroundings, aged brass housing, faded ivory paper, hand-inked outlines, a mechanical lever, and a restrained mint display glow. The layout should read as an illustrated cabinet in a room, not as a dashboard decorated with vintage colors.

Avoid the visual language of a contemporary betting app: no aggressive neon, generic SaaS panels, or language that implies real money.

## Color

- Background: `oklch(18% 0.025 58)`
- Wood: `oklch(27% 0.045 52)`
- Brass: `oklch(66% 0.105 82)`
- Paper: `oklch(89% 0.025 91)`
- Ink: `oklch(19% 0.02 57)`
- Mint display: `oklch(82% 0.15 162)`
- Error: `oklch(61% 0.19 25)`

## Typography

Use the system sans-serif stack for interactive text. Use Georgia only for the machine wordmark and pay-table numerals, giving the cabinet a printed-casino character without compromising readability.

## Components

- Rectangular brass controls with a strong visible focus ring.
- Four tall reel windows, each selectable before a bonus spin.
- An LED-style balance display with mint numerals on near-black.
- An inline status panel for server feedback and errors.
- A pay table that remains visible beside or beneath the cabinet.

## Motion

Use quick reel and display updates of 180–240ms. Avoid perpetual or decorative animation, and disable transitions when reduced motion is preferred.

## Responsive Behavior

On narrow screens, use the supplied portrait cabinet artwork as the physical machine, matching the wide-screen fidelity mode. Reels, action buttons, history control, server feedback, and updated balance remain semantic HTML controls precisely overlaid on the artwork, with four compact reel columns and full-width touch targets.
