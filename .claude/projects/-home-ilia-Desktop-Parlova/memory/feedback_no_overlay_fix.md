---
name: Don't assume visual causes
description: When user reports UI visibility issues, ask or think about layout/sizing causes before assuming color/opacity
type: feedback
---

When the user reports something isn't visible on screen, consider layout and sizing (keyboard + modal stacking, element height) before jumping to opacity/color fixes.

**Why:** User reported dictionary modal blocking chat messages. I assumed the dark overlay was the problem, but it was actually the modal + keyboard together taking up too much screen space.

**How to apply:** Think about the full screen composition (keyboard height, modal height, remaining visible area) before proposing visual tweaks.
