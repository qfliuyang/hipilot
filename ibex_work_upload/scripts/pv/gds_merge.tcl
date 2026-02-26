layout filemerge -in $::env(RESULT_DIR)/pr/data/$::env(DESIGN_NAME).gds \
-in $::env(DESIGN_HOME)/sky130hd/pdk/gds/sky130_fd_sc_hd.gds \
-topcell ibex_core \
-mode overwrite \
-out $::env(RESULT_DIR)/pv/drc/data/$::env(DESIGN_NAME).merge.gds


