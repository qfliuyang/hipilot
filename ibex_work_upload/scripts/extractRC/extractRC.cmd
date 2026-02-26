STAR_DIRECTORY: ./result/extractRC/work
SUMMARY_FILE: ./result/extractRC/report/summary.log
TOP_DEF_FILE: ./result/pr/data/ibex_routing.def
LEF_FILE: ./designs/sky130hd/pdk/lef/sky130_fd_sc_hd.tlef
LEF_FILE: ./designs/sky130hd/pdk/lef/sky130_fd_sc_hd_merged.lef
	
MAPPING_FILE:	./designs/sky130hd/pdk/$file_name.map
TCAD_GRD_FILE: ./designs/sky130hd/pdk/$file_name.nxtgrd
NETLIST_FILE: ./result/extractRC/data/ibex.spef.gz
NETLIST_FORMAT: spef
NETLIST_COMPRESS_COMMAND: gzip -q -f
OPERATING_TEMPERATURE: 125
NUM_CORES: 4

CASE_SENSITIVE:YES
NETLIST_UNSCALED_COORDINATES:YES
NETLIST_UNSCALED_RES_PROP:YES
BUS_BIT: []
HIERARCHICAL_SEPARATOR: /
EXTRACTION: RC
COUPLING_REL_THRESHOLD: 0.03
COUPLING_ABS_THRESHOLD: 1e-15
REDUCTION: YES
NETS: *
REMOVE_FLOATING_NETS: NO
REMOVE_DANGLING_NETS: NO


