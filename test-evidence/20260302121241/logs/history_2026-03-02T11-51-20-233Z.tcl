# Sent at: 2026-03-02T11:51:20.233Z
# Pane: eda

cd /home/EDA/ibex_work_upload

puts "Checking existing chip_done.enc checkpoint..."
set file_size [file size result/pr/data/chip_done.enc]
puts "chip_done.enc size: $file_size bytes"

# Try to load it and check what's in it
puts "Attempting to load chip_done.enc..."
if {[catch {
    source result/pr/data/chip_done.enc
    puts "Checkpoint loaded successfully!"
    
    # Check if routing is complete
    set routes [llength [get_db nets -filter "net_status==routed"]]
    puts "Routed nets: $routes"
    
    # Check for GDS
    set gds_exists [file exists result/pr/data/ibex_core.gds]
    puts "GDS file exists: $gds_exists"
    
    if {$gds_exists} {
        set gds_size [file size result/pr/data/ibex_core.gds]
        puts "GDS file size: $gds_size bytes"
    }
} err]} {
    puts "ERROR loading checkpoint: $err"
}

exit