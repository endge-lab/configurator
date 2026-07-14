# Виды

`RView` remains a persisted document with `componentId`, `queryId`, and `filterId` fields.

The legacy `componentId` relation is kept for inspection and migration. It no longer creates a Table/DSL runtime and cannot be rendered through `@endge/vue`.

Query and filter references remain ordinary domain links. New executable UI should use `ComponentSFC` and the SFC runtime adapter directly.
