# Sent at: 2026-03-17T17:09:23.985Z
# Pane: eda

# Stage 9: Chip Finish - FINAL STAGE - GDS Export!

puts "========================================"
puts "   STAGE 9: CHIP FINISH - FINAL STAGE"
puts "========================================"
puts ""

puts "=== Loading Route Opt Checkpoint ==="
source result/pr/data/routing_opt.enc

puts ""
puts "=== Running Chip Finish ==="
puts "This will:"
puts "  - Cleanup design"
puts "  - Reconnect power/ground"
puts "  - Export DEF"
puts "  - Extract parasitics"
puts "  - Export Netlist"
puts "  - EXPORT GDS (TAPE-OUT!)"
puts ""

source scripts/pr/chip_done.tcl

puts ""
puts "=== Saving Final Checkpoint ==="
saveDesign result/pr/data/chip_done.enc

puts ""
puts "========================================"
puts "   RTL-TO-GDS FLOW COMPLETE!"
puts "   GDS EXPORTED FOR TAPE-OUT!"
puts "========================================"
