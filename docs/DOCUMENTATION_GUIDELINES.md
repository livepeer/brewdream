# Documentation Guidelines

**Last Updated**: 2025-10-12

## ⚠️ CRITICAL: Be Concise - Tokens Aren't Free

**Every word costs money and processing time.**

- Write for skimming, not reading
- Use bullets over paragraphs
- Show code examples, minimize prose
- Cut everything that doesn't add value
- If it's obvious from code, don't document it

**Bad**: "This feature implements a mechanism by which users can enable or disable the functionality of downloading video files to their local browser storage location..."

**Good**: "Toggle to download videos to browser's downloads folder."

## Core Principle

**If you can't find it through a search, it needs documentation.**

When implementing features: "Will I find this in 6 months?" → If no, document it.

## When to Create Documentation

### ✅ ALWAYS Document

- **Dev toggles/features**: Feature flags, debug tools, admin features (`LOCAL_DOWNLOAD_TOGGLE.md`)
- **Hidden features**: Keyboard shortcuts, console commands, URL params
- **API integrations**: External API usage, auth flows (`DAYDREAM_API_GUIDE.md`)
- **Complex patterns**: Multi-step workflows, edge cases (`RECORDING_IMPLEMENTATION.md`)
- **Architecture decisions**: Why choices were made, trade-offs

### ⚠️ SOMETIMES Document

- **Small additions**: Add to existing doc if it fits naturally
- **Bug fixes with learnings**: Add to relevant doc's troubleshooting
- **Config changes**: Update VIBEME.md or setup docs

### ❌ DON'T Document

- UI text updates, CSS tweaks, typo fixes
- Standard CRUD, basic forms, typical React patterns
- Temporary code (console.logs, commented code)

## Documentation Template

Minimal structure - only include sections that add value:

```markdown
# Feature Name

**Location**: `path/to/file.ts:123`

## What
One sentence description.

## Why
Quick reason for existence.

## How
// Code example
const example = 'show, dont tell';

## Search Terms
feature-name, alt-name, use-case

## Troubleshooting
- Issue: Solution
```

**Only add these if needed**: Design Decisions, Testing, Related Files

## File Naming

- **Format**: `FEATURE_NAME.md` (SCREAMING_SNAKE_CASE)
- **Examples**: `LOCAL_DOWNLOAD_TOGGLE.md`, `RECORDING_IMPLEMENTATION.md`
- **Headings**: Use `##` for sections, keep descriptive
- **Code blocks**: Always specify language for syntax highlighting

## Where to Put Documentation

- **Architecture change** → Update VIBEME.md
- **Implementation details** → Create/update doc in `docs/`
- **Code-level details** → Inline comments

**VIBEME.md**: High-level map, architecture, pointers to docs  
**docs/**: Implementation details, API refs, troubleshooting

## Search Optimization

Always include "Search Terms" section with keywords, variations, use cases.

Write for how people search:
- ❌ "Implements local persistence of media blob objects"
- ✅ "Download videos to local computer"

Link related docs: `[Doc Name](./DOC.md)`

## Maintenance

When modifying code: Check if doc exists, update if needed, update "Last Updated" date.

For deprecated features:
```markdown
## ⚠️ DEPRECATED - See [NEW_FEATURE.md](./NEW_FEATURE.md)
```

## Checklist

- [ ] Feature documented (if non-obvious)
- [ ] Includes search terms
- [ ] Code examples (not prose)
- [ ] Concise (every word counts)
- [ ] File named correctly
- [ ] "Last Updated" date current

## Good Examples

- `RECORDING_IMPLEMENTATION.md` - Flow with code
- `DAYDREAM_API_GUIDE.md` - API reference
- `LOCAL_DOWNLOAD_TOGGLE.md` - Dev feature with search terms

## Anti-Patterns

❌ **Don't**:
- Duplicate VIBEME content
- Write code-as-prose (show code, don't describe it)
- Create orphan docs (always link from somewhere)
- Over-document obvious things
- Write verbose explanations (tokens cost money)

✅ **Do**:
- Write for search (use terms people search for)
- Show code examples
- Be ruthlessly concise
- Link to related docs

## Quick Reference

| Scenario | Action |
|----------|--------|
| Dev toggle | Create `docs/FEATURE.md` |
| Major bug fix | Add to doc's troubleshooting |
| New API | Create API guide |
| Architecture change | Update VIBEME.md |
| Workaround | Add to "Known Issues" |

Find docs: `grep -r "feature" docs/` or `ls docs/`

## Search Terms

documentation guidelines, how to document features, when to create docs, doc standards, VIBEME vs docs

## Related

- [VIBEME.md](../VIBEME.md) - Architecture
- `docs/*.md` - Examples

---

**Remember**: Be concise. Tokens cost money. Show code, skip prose.
