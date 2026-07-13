---
name: remotion-best-practices
description: Best practices for Remotion - Video creation in React
metadata:
  tags: remotion, video, react, animation, composition
---

## When to use

Use this skill whenever you are dealing with Remotion code to obtain domain-specific knowledge for programmatic video creation in React.

## Core Concepts

### Composition Structure
- Define compositions with `<Composition>` in `Root.tsx`
- Each composition has a fixed `width`, `height`, `fps`, and `durationInFrames`
- Use `<Folder>` to organize compositions
- Use `calculateMetadata` for dynamic duration/dimensions based on props

### Animation Fundamentals
- Use `useCurrentFrame()` and `useVideoConfig()` for frame-based animation
- `interpolate(frame, inputRange, outputRange)` for smooth value mapping
- `spring({ frame, fps })` for natural spring physics
- Always clamp interpolation with `extrapolateLeft: 'clamp'`

### Sequencing
- `<Sequence from={30}>` delays child rendering by 30 frames
- `<Sequence durationInFrames={60}>` limits visibility
- Combine sequences for complex choreography

### Assets
- Use `staticFile()` for assets in the `public/` folder
- `<Img>` component for images (with `onError` handling)
- `<Video>` and `<Audio>` components for media
- `<OffthreadVideo>` for better rendering performance

### Captions & Subtitles
- Use `@remotion/captions` for subtitle rendering
- Parse SRT/VTT files with built-in parsers
- Sync captions to audio using word-level timestamps

### Audio
- `<Audio>` component with `volume`, `startFrom`, `endAt` props
- Audio visualization with `getAudioData()` and `visualizeAudio()`
- Use `useAudioData()` hook for reactive audio analysis

### Text Animation Patterns
- Word-by-word reveals with `<Sequence>` per word
- Character-level animation using `.split('')`
- Typewriter effects with `interpolate` and `Math.floor`

### Charts & Data Visualization
- Animate chart data entry with `interpolate`
- Bar charts: animate `height` or `scaleY`
- Pie charts: animate `strokeDashoffset` on SVG circles
- Line charts: animate `pathLength` with SVG

### Performance
- Avoid `Date.now()` or `Math.random()` (non-deterministic)
- Use `delayRender()` / `continueRender()` for async operations
- Prefer CSS transforms over layout properties
- Use `<OffthreadVideo>` instead of `<Video>` in rendering

### 3D Content
- Use `@remotion/three` with React Three Fiber
- Wrap Three.js canvas in `<ThreeCanvas>`
- Animate camera, lights, and objects with `useCurrentFrame()`

### Fonts
- Use `@remotion/google-fonts` for Google Fonts
- Call `loadFont()` at module level (not in component)
- For local fonts, use `@font-face` in CSS or `staticFile()`

### Rendering
- `npx remotion render <comp-id>` for video output
- `npx remotion still <comp-id>` for single frame
- Support MP4, WebM, GIF, PNG sequence output
- Use `--concurrency` flag for parallel rendering
