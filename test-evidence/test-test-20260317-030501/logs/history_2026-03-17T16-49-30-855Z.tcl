# Sent at: 2026-03-17T16:49:30.855Z
# Pane: eda

# Stage 6: Post-CTS Optimization for Ibex Core

puts "=== Stage 6: Loading CTS Checkpoint ==="
source result/pr/data/cts.enc

puts "=== Running Post-CTS Optimization ==="
source scripts/pr/post_cts_opt.tcl

puts "=== Saving Post-CTS Opt Checkpoint ==="
saveDesign result/pr/data/post_cts_opt.enc

puts "=== Stage 6 Complete ==="
puts "Checkpoint saved to: result/pr/data/post_cts_opt.enc"
