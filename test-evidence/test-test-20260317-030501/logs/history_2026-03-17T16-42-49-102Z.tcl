# Sent at: 2026-03-17T16:42:49.102Z
# Pane: eda

# Stage 4: Placement for Ibex Core

puts "=== Stage 4: Loading Powerplan Checkpoint ==="
source result/pr/data/powerplan.enc

puts "=== Loading Scan Chain DEF ==="
defIn result/scanchain/data/ibex_core.scan.def

puts "=== Running Placement ==="
source scripts/pr/placement.tcl

puts "=== Saving Placement Checkpoint ==="
saveDesign result/pr/data/placement.enc

puts "=== Stage 4 Complete ==="
