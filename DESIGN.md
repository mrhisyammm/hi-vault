---
name: Sentry Core
colors:
  surface: '#faf9ff'
  surface-dim: '#ccdaff'
  surface-bright: '#faf9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8ff'
  surface-container-highest: '#d8e2ff'
  on-surface: '#051a3e'
  on-surface-variant: '#434654'
  inverse-surface: '#1d3054'
  inverse-on-surface: '#edf0ff'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#006c47'
  on-secondary: '#ffffff'
  secondary-container: '#8af5be'
  on-secondary-container: '#00714b'
  tertiary: '#7b2600'
  on-tertiary: '#ffffff'
  tertiary-container: '#a33500'
  on-tertiary-container: '#ffc6b2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#8df7c1'
  secondary-fixed-dim: '#71dba6'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005235'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59b'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#812800'
  background: '#faf9ff'
  on-background: '#051a3e'
  surface-variant: '#d8e2ff'
typography:
  display-otp:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: 0.1em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 480px
  gutter: 24px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
  inset-pad: 40px
---

## Brand & Style
The design system focuses on establishing an atmosphere of institutional security and effortless clarity. The target audience includes users interacting with sensitive data who require reassurance and zero friction during the authentication process. 

The style is **Modern / Corporate**, prioritizing a high signal-to-noise ratio. It utilizes generous whitespace to reduce cognitive load during high-stakes security moments. Surfaces are crisp, using subtle tonal shifts rather than aggressive shadows to define hierarchy. The emotional response should be one of "calm confidence"—the interface feels fortified yet welcoming, ensuring the user feels in control of their digital identity.

## Colors
The palette is anchored by a deep "Security Blue" (Primary) which signals professional-grade reliability and authority. A "Trust Green" (Secondary) is reserved for success states, verified icons, and completed steps to provide positive reinforcement.

The neutral palette uses high-contrast slates for typography to ensure maximum legibility, while the background uses a very soft grey-blue tint to reduce eye strain compared to pure white. Warning and error states should utilize a restrained coral red, used sparingly to prevent alarmism while maintaining clear communication of input errors.

## Typography
The typography strategy balances modern approachability with technical precision. **Manrope** is used for headlines to provide a warm, geometric feel that softens the "coldness" of security software. **Inter** handles body copy and instructional text, chosen for its exceptional legibility and systematic appearance.

For the actual 6-digit OTP input and security codes, **JetBrains Mono** is introduced. This monospaced font ensures that characters are distinct and easily readable, preventing confusion between similar glyphs (like '0' and 'O' or '1' and 'l'). Use `display-otp` for the primary code entry fields to emphasize the task at hand.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for the central authentication card, ensuring the UI remains compact and centered on all screen sizes. The primary container should never exceed 480px in width to maintain focus.

Vertical rhythm is strictly 4px-based. Form elements are grouped using `stack-md` (16px), while distinct sections (header to form, form to footer) are separated by `stack-lg` (32px). On mobile devices, the `inset-pad` reduces from 40px to 24px to maximize screen real estate while maintaining a protective "buffer" around the interactive elements.

## Elevation & Depth
Depth is created through **Tonal Layers** rather than heavy shadows. The main background is the lowest layer (Level 0). The authentication card sits on Level 1, utilizing a very subtle, diffused ambient shadow (0px 4px 20px rgba(9, 30, 66, 0.08)) and a 1px neutral border.

Interactive elements like input fields use "Inward Depth" when focused—a subtle inner glow or a 2px solid primary border—to indicate activity. This creates a tactile sense of "engaging" with the lock. Avoid glassmorphism to maintain the professional, high-clarity requirement of a financial or security-grade interface.

## Shapes
A "Rounded" profile is utilized to make the security experience feel modern and less intimidating. Standard components use a 0.5rem (8px) radius. This specific radius is large enough to feel contemporary but tight enough to maintain a sense of structural integrity and order. Individual OTP input boxes should maintain this consistency, creating a unified row of rounded rectangles.

## Components

### OTP Input Fields
The 6-digit code entry should consist of six individual square inputs. When a digit is entered, the border transitions from a light neutral to the Primary Blue. Use a slightly heavier font weight for the numbers.

### Buttons
- **Primary:** Solid Primary Blue with white text. High-contrast, 48px height for easy tapping.
- **Secondary/Ghost:** Transparent background with Primary Blue text, used for "Resend Code" or "Back to Login" to maintain hierarchy.

### Cards
The central authentication card should be white, featuring a 1px border (#DFE1E6). It should be vertically centered on the page to draw the eye immediately to the point of interaction.

### Feedback Toasts
Small, rounded notifications that appear at the top-center. Use Trust Green for "Code Sent" and Coral Red for "Invalid Code," accompanied by a subtle 16px icon.

### Progress Indicators
A thin, 4px linear progress bar at the very top of the card can be used to show the expiration time of the current OTP code, shifting from Primary Blue to a neutral grey as time elapses.