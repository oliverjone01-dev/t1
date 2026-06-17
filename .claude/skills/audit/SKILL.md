---
name: audit
description: Perform comprehensive audit of interface quality across accessibility, performance, theming, and responsive design. Generates detailed report of issues with severity ratings and recommendations.
user-invokable: true
args:
  - name: area
    description: The feature or area to audit (optional)
    required: false
---

Run systematic quality checks and generate a comprehensive audit report with prioritized issues and actionable recommendations. Don't fix issues - document them for other commands to address.

**First**: Use the frontend-design skill for design principles and anti-patterns.

## Diagnostic Scan

Run comprehensive checks across multiple dimensions:

1. **Accessibility (A11y)** - Contrast issues, missing ARIA, keyboard navigation, semantic HTML, alt text, form issues
2. **Performance** - Layout thrashing, expensive animations, missing optimization, bundle size, render performance
3. **Theming** - Hard-coded colors, broken dark mode, inconsistent tokens, theme switching issues
4. **Responsive Design** - Fixed widths, touch targets, horizontal scroll, text scaling, missing breakpoints
5. **Anti-Patterns (CRITICAL)** - Check for AI slop tells (AI color palette, gradient text, glassmorphism, hero metrics, card grids, generic fonts)

## Generate Comprehensive Report

### Anti-Patterns Verdict
**Start here.** Pass/fail: Does this look AI-generated? List specific tells. Be brutally honest.

### Executive Summary
- Total issues found (count by severity)
- Most critical issues (top 3-5)
- Recommended next steps

### Detailed Findings by Severity

For each issue document:
- **Location**: Component, file, line
- **Severity**: Critical / High / Medium / Low
- **Category**: Accessibility / Performance / Theming / Responsive
- **Description**: What the issue is
- **Impact**: How it affects users
- **WCAG/Standard**: Which standard it violates
- **Recommendation**: How to fix it
- **Suggested command**: Which skill to use (/animate, /quieter, /optimize, /adapt, /clarify, /distill, /delight, /onboard, /normalize, /harden, /polish, /extract, /bolder, /arrange, /typeset, /critique, /colorize, /overdrive)

### Patterns & Systemic Issues
Identify recurring problems across the codebase.

### Positive Findings
Note what's working well.

### Recommendations by Priority
1. **Immediate**: Critical blockers
2. **Short-term**: High-severity (this sprint)
3. **Medium-term**: Quality improvements (next sprint)
4. **Long-term**: Nice-to-haves

**NEVER**:
- Report issues without explaining impact
- Mix severity levels inconsistently
- Skip positive findings
- Provide generic recommendations
- Forget to prioritize
