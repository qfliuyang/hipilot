# Sent at: 2026-03-02T11:52:01.591Z
# Pane: eda

cd /home/EDA/ibex_work_upload

puts "Checking existing chip_done.enc checkpoint..."
set file_size [file size result/pr/data/chip_done.enc]
puts "chip_done.enc size: $file_size bytes"

puts "Checking for GDS file..."
set gds_exists [file exists result/pr/data/ibex_core.gds]
puts "GDS file exists: $gds_exists"

if {$gds_exists} {
    set gds_size [file size result/pr/data/ibex_core.gds]
    puts "GDS file size: $gds_size bytes"
    puts ""
    puts "===== RTL-TO-GDS FLOW ALREADY COMPLETE ====="
    puts "GDS output: result/pr/data/ibex_core.gds"
    puts "Checkpoint: result/pr/data/chip_done.enc"
} else {
    puts "GDS file not found - flow incomplete"
}

exit