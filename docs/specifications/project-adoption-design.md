# Project adoption design

Project adoption is a plan-first transaction for an existing regular directory.
Inventory excludes dependency, build, VCS, coverage, and Basic Structure state
directories; it is bounded to 10,000 files and 100 MiB of inspected regular-file
content. Symbolic links are reported and block application.

Detection uses repository evidence such as manifests, dependencies, lockfiles,
framework configuration, language markers, crawl-control files, exports, and
container files. Recommendations are evidence-based defaults and remain
explicitly overridable.

The desired project is rendered in an isolated temporary directory. Only files
owned by `core` are candidates for adoption. Existing candidates remain
user-owned; profile runtime files never replace application source. Control
paths fail closed. Apply uses exclusive file creation and rollback.

State schema v5 retains normal extension version and provenance contracts and
adds adoption ownership. Upgrade rendering filters desired output to core files
outside the immutable excluded-path set. User-owned hashes are audit evidence,
not drift enforcement baselines.
