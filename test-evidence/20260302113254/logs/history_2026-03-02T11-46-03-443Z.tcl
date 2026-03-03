# Sent at: 2026-03-02T11:46:03.444Z
# Pane: eda

# Check what scan chains exist
set scan_chains [getAllScanChains]
puts "Scan chains found: $scan_chains"

# Delete each one
foreach chain $scan_chains {
    puts "Deleting scan chain: $chain"
    deleteScanChain $chain
}

# Now try placement
place_design
puts "PLACEMENT COMPLETE"
exit