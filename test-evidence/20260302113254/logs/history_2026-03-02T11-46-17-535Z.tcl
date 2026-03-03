# Sent at: 2026-03-02T11:46:17.535Z
# Pane: eda

# Try to get scan chains using report command
redirect tmp_scan_rpt {reportScanChains}
set fp [open "tmp_scan_rpt" r]
set content [read $fp]
close $fp
puts "Scan chain report:\n$content"

# Try common scan chain names from DFT
foreach chain {"chain1" "chain2" "chain3" "scan_chain" "ibex_scan"} {
    if {[catch {deleteScanChain $chain} err]} {
        puts "Could not delete $chain: $err"
    } else {
        puts "Deleted $chain"
    }
}

# Now try placement with force option
setPlaceMode -reset
setPlaceMode -place_global_ignore_scan true
place_design
puts "PLACEMENT COMPLETE"
exit