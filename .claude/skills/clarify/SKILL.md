---
name: clarify
description: Improve unclear UX copy, error messages, microcopy, labels, and instructions. Makes interfaces easier to understand and use.
user-invokable: true
args:
  - name: target
    description: The feature or component with unclear copy (optional)
    required: false
---

Identify and improve unclear, confusing, or poorly written interface text to make the product easier to understand and use.

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

---

## Improve Copy Systematically

### Error Messages
- **Bad**: "Error 403: Forbidden"
- **Good**: "You don't have permission to view this page. Contact your admin for access."
- Explain what went wrong in plain language, suggest how to fix it, don't blame the user

### Form Labels & Instructions
- Use clear, specific labels (not generic placeholders)
- Show format expectations with examples
- Explain why you're asking (when not obvious)

### Button & CTA Text
- **Bad**: "Click here" | "Submit" | "OK"
- **Good**: "Create account" | "Save changes" | "Got it, thanks"
- Describe the action specifically, use active voice (verb + noun)

### Empty States
- **Bad**: "No items"
- **Good**: "No projects yet. Create your first project to get started."

### Success Messages
- Confirm what happened
- Explain what happens next
- Match the user's emotional moment

### Loading States
- Set expectations (how long?)
- Explain what's happening
- Offer escape hatch if appropriate

### Confirmation Dialogs
- **Bad**: "Are you sure?"
- **Good**: "Delete 'Project Alpha'? This can't be undone."
- Use clear button labels ("Delete project" not "Yes")

## Clarity Principles

1. **Be specific**: "Enter email" not "Enter value"
2. **Be concise**: Cut unnecessary words
3. **Be active**: "Save changes" not "Changes will be saved"
4. **Be human**: "Oops, something went wrong" not "System error encountered"
5. **Be helpful**: Tell users what to do, not just what happened
6. **Be consistent**: Use same terms throughout

**NEVER**:
- Use jargon without explanation
- Blame users
- Be vague without explanation
- Vary terminology
- Use placeholders as the only labels
