# MAW-style Audit Trail and Application Logs Design

**Approved reference:** The existing MAW Audit Trail and Application Logs pages supplied by the owner.

## Outcome

Rebuild the two RYLAY Admin operational pages with the same compact MAW hierarchy: icon-led page heading, Super Admin badge, four-column summaries, single-row filters, dense tables, inline row expansion, and dark technical payload inspectors. RYLAY colours, Plus Jakarta Sans typography, shared 16px spacing, responsive layout, and existing sidebar shell remain authoritative.

## Behaviour

- Audit Trail remains immutable and Super Admin-only. Its list adds broad read-only search and global summary metadata while retaining existing strict filters and cursor pagination.
- Audit details expand directly below the selected row instead of opening a modal. Before, after, metadata, actor, request, route, browser and record context remain server-sanitized.
- Application Logs retain their existing sanitized API, level counts, search, dates, refresh and numbered pagination. The MAW table and dark context inspector are copied without fabricating unsupported archive, download, export, auto-refresh or server-health functions.
- Forbidden and unauthenticated responses continue to expose no records. The School App is unchanged.

## Responsive rules

Summary cards collapse from four to two to one columns. Filter controls wrap, while data tables use a horizontal viewport. Expanded details collapse into one column on narrow screens.
