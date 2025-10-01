# Documentation Maintenance Schedule

## 📅 Regular Maintenance Tasks

### 🔄 Every Session
**When:** At the start and end of each development session

- [ ] Read PROJECT_STATUS.md to understand current state
- [ ] Update feature completion status
- [ ] Document any new blockers or issues
- [ ] Add discoveries to SESSION_LEARNINGS.md
- [ ] Update TROUBLESHOOTING.md with new fixes
- [ ] Review and update todo list with TodoWrite tool

### 📋 Daily Tasks
**When:** End of each working day

- [ ] Consolidate session learnings into patterns
- [ ] Update PROJECT_STATUS.md progress percentages
- [ ] Archive completed todos
- [ ] Review and close resolved issues
- [ ] Update quick reference with new commands

### 📊 Weekly Review
**When:** Every Monday morning

- [ ] Review all documentation for accuracy
- [ ] Consolidate duplicate learnings
- [ ] Update tech stack documentation if dependencies changed
- [ ] Clean up outdated troubleshooting entries
- [ ] Archive old session notes (move to docs/archive/)
- [ ] Update development guide with new best practices
- [ ] Review and update critical reminders

### 🚀 Sprint/Milestone Review
**When:** At the end of each sprint or major milestone

- [ ] Major update to PROJECT_STATUS.md
- [ ] Comprehensive review of all documentation
- [ ] Update architecture diagrams if needed
- [ ] Document major decisions and their rationale
- [ ] Create changelog entries
- [ ] Update README if public-facing changes

### 🔧 Before Major Changes
**When:** Before starting any major refactoring or new features

- [ ] Complete documentation audit
- [ ] Ensure all current patterns are documented
- [ ] Check for conflicting guidelines
- [ ] Update tech stack if introducing new dependencies
- [ ] Document the planned changes and rationale
- [ ] Create backup of current documentation state

## 📝 Documentation Update Triggers

### Immediate Updates Required
These events should trigger immediate documentation updates:

| Event | Action | File to Update |
|-------|--------|---------------|
| Bug discovered | Document issue and fix | TROUBLESHOOTING.md |
| Feature completed | Update status | PROJECT_STATUS.md |
| New pattern discovered | Add learning | SESSION_LEARNINGS.md |
| Workflow change | Update process | DEVELOPMENT_GUIDE.md |
| Dependency added/updated | Update stack | TECH_STACK.md |
| Critical issue found | Add reminder | QUICK_REFERENCE.md |
| Architecture change | Update overview | TECH_STACK.md |

### Batch Updates Acceptable
These can be updated in batches at regular intervals:

- Minor typo fixes
- Formatting improvements
- Adding examples to existing patterns
- Expanding explanations
- Adding cross-references

## 🎯 Quality Checklist

### Documentation Health Check
Run through this checklist weekly:

- [ ] **Accuracy**: Is all information still correct?
- [ ] **Completeness**: Are all features documented?
- [ ] **Clarity**: Can a new developer understand it?
- [ ] **Consistency**: Do all docs use same terminology?
- [ ] **Currency**: Are timestamps and versions updated?
- [ ] **Accessibility**: Are links working and files findable?

### Signs Documentation Needs Update

⚠️ **Red Flags:**
- Repeated questions about the same topic
- Confusion about project setup
- Outdated command examples
- Missing information about new features
- Conflicting information between files
- Broken links or references

## 🔄 Documentation Lifecycle

### 1. Creation Phase
- Initial documentation when feature is planned
- Draft status in PROJECT_STATUS.md

### 2. Development Phase
- Active updates during implementation
- Regular commits with documentation changes
- Learning captured in SESSION_LEARNINGS.md

### 3. Stabilization Phase
- Comprehensive review after feature completion
- Move learnings to permanent guides
- Update troubleshooting with known issues

### 4. Maintenance Phase
- Regular reviews and updates
- Keep current with codebase changes
- Archive outdated information

### 5. Deprecation Phase
- Mark outdated sections clearly
- Provide migration guides
- Archive old documentation

## 📊 Maintenance Metrics

Track these metrics monthly:

1. **Documentation Coverage**: % of features documented
2. **Update Frequency**: How often docs are updated
3. **Issue Resolution**: Time from issue to documentation
4. **Stale Content**: Age of last update per file
5. **Link Health**: % of working cross-references

## 🚨 Emergency Documentation Protocol

When critical issues arise:

1. **Immediate**: Add warning to QUICK_REFERENCE.md
2. **Within 1 hour**: Update TROUBLESHOOTING.md
3. **Same day**: Update affected guides
4. **Next day**: Review and consolidate updates
5. **Within week**: Full documentation review

## 💡 Best Practices

1. **Commit docs with code**: Documentation changes should be in same commit as related code
2. **Use templates**: Consistent format for similar entries
3. **Date your updates**: Add timestamps to time-sensitive information
4. **Cross-reference**: Link between related documentation
5. **Version specifics**: Note version requirements when relevant
6. **Example-driven**: Include code examples where helpful
7. **Problem-solution format**: For troubleshooting entries
8. **Progressive disclosure**: Summary first, details later

---

**Remember**: Well-maintained documentation saves more time than it takes to write!