# Sent at: 2026-03-17T16:54:52.760Z
# Pane: eda

# Stage 7: Routing for Ibex Core

puts "=== Stage 7: Loading Post-CTS Opt Checkpoint ==="
source result/pr/data/post_cts_opt.enc

puts "=== Running Global + Detail Routing ==="
source scripts/pr/routing.tcl

puts "=== Saving Routing Checkpoint ==="
saveDesign result/pr/data/routing.enc

puts "=== Stage 7 Complete ==="
puts "Checkpoint saved to: result/pr/data/routing.enc"
