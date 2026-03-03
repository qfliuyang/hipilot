# Sent at: 2026-03-03T12:05:44.918Z
# Pane: eda

cd /home/EDA/ibex_work_upload

# Load previous stage checkpoint
source /home/EDA/ibex_work_upload/result/pr/data/init_design.enc

floorPlan -site unithd -su 1 0.4 1 1 1 1
loadIoFile /home/EDA/ibex_work_upload/designs/sky130hd/ibex/io.file

# Dont-use cells (Sky130 low-power cells cause issues)
foreach cell {sky130_fd_sc_hd__probec_p_8 sky130_fd_sc_hd__lpflow_bleeder_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_1 sky130_fd_sc_hd__lpflow_clkbufkapwr_16 sky130_fd_sc_hd__lpflow_clkbufkapwr_2 sky130_fd_sc_hd__lpflow_clkbufkapwr_4 sky130_fd_sc_hd__lpflow_clkbufkapwr_8 sky130_fd_sc_hd__lpflow_clkinvkapwr_1 sky130_fd_sc_hd__lpflow_clkinvkapwr_16 sky130_fd_sc_hd__lpflow_clkinvkapwr_2 sky130_fd_sc_hd__lpflow_clkinvkapwr_4 sky130_fd_sc_hd__lpflow_clkinvkapwr_8} {
    set_dont_use [get_lib_cells */$cell] true
}

saveDesign result/pr/data/floor_plan.enc
defOut -floorplan -noStdCells result/pr/data/ibex.floorplan.def
puts "STAGE 2 COMPLETE: floor_plan.enc saved"
exit