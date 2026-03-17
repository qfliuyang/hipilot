# Sent at: 2026-03-17T17:03:48.512Z
# Pane: eda

# Stage 8: Route Optimization for Ibex Core

puts "=== Stage 8: Loading Routing Checkpoint ==="
source result/pr/data/routing.enc

puts "=== Running Post-Route Optimization ==="
source scripts/pr/routing_opt.tcl

puts "=== Saving Route Opt Checkpoint ==="
saveDesign result/pr/data/routing_opt.enc

puts "=== Stage 8 Complete ==="
puts "Checkpoint saved to: result/pr/data/routing_opt.enc"
