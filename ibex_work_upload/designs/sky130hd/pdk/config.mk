# Process node
export PROCESS = 130

#-----------------------------------------------------
# Tech/Libs
# ----------------------------------------------------
export LEF_FILES = $(DESIGN_HOME)/sky130hd/pdk//lef/sky130_fd_sc_hd.tlef \
                    $(DESIGN_HOME)/sky130hd/pdk//lef/sky130_fd_sc_hd_merged.lef

export DB_FILES = $(DESIGN_HOME)/sky130hd/pdk//lib/sky130_fd_sc_hd__tt_025C_1v80.db \
                     $(ADDITIONAL_DBS)

export LIB_FILES = $(DESIGN_HOME)/sky130hd/pdk//lib/sky130_fd_sc_hd__tt_025C_1v80.lib \
                     $(ADDITIONAL_LIBS)

# Dont use cells list
export DONT_USE_CELLS = \
    sky130_fd_sc_hd__probec_p_8 \
    sky130_fd_sc_hd__lpflow_bleeder_1 \
    sky130_fd_sc_hd__lpflow_clkbufkapwr_1 \
    sky130_fd_sc_hd__lpflow_clkbufkapwr_16 \
    sky130_fd_sc_hd__lpflow_clkbufkapwr_2 \
    sky130_fd_sc_hd__lpflow_clkbufkapwr_4 \
    sky130_fd_sc_hd__lpflow_clkbufkapwr_8 \
    sky130_fd_sc_hd__lpflow_clkinvkapwr_1 \
    sky130_fd_sc_hd__lpflow_clkinvkapwr_16 \
    sky130_fd_sc_hd__lpflow_clkinvkapwr_2 \
    sky130_fd_sc_hd__lpflow_clkinvkapwr_4 \
    sky130_fd_sc_hd__lpflow_clkinvkapwr_8 \
    sky130_fd_sc_hd__lpflow_decapkapwr_12 \
    sky130_fd_sc_hd__lpflow_decapkapwr_3 \
    sky130_fd_sc_hd__lpflow_decapkapwr_4 \
    sky130_fd_sc_hd__lpflow_decapkapwr_6 \
    sky130_fd_sc_hd__lpflow_decapkapwr_8 \
    sky130_fd_sc_hd__lpflow_inputiso0n_1 \
    sky130_fd_sc_hd__lpflow_inputiso0p_1 \
    sky130_fd_sc_hd__lpflow_inputiso1n_1 \
    sky130_fd_sc_hd__lpflow_inputiso1p_1 \
    sky130_fd_sc_hd__lpflow_inputisolatch_1 \
    sky130_fd_sc_hd__lpflow_isobufsrc_1 \
    sky130_fd_sc_hd__lpflow_isobufsrc_16 \
    sky130_fd_sc_hd__lpflow_isobufsrc_2 \
    sky130_fd_sc_hd__lpflow_isobufsrc_4 \
    sky130_fd_sc_hd__lpflow_isobufsrc_8 \
    sky130_fd_sc_hd__lpflow_isobufsrckapwr_16 \
    sky130_fd_sc_hd__lpflow_lsbuf_lh_hl_isowell_tap_1 \
    sky130_fd_sc_hd__lpflow_lsbuf_lh_hl_isowell_tap_2 \
    sky130_fd_sc_hd__lpflow_lsbuf_lh_hl_isowell_tap_4 \
    sky130_fd_sc_hd__lpflow_lsbuf_lh_isowell_4 \
    sky130_fd_sc_hd__lpflow_lsbuf_lh_isowell_tap_1 \
    sky130_fd_sc_hd__lpflow_lsbuf_lh_isowell_tap_2 \
    sky130_fd_sc_hd__lpflow_lsbuf_lh_isowell_tap_4

# Define fill cells
export FILL_CELLS = sky130_fd_sc_hd__fill_1 sky130_fd_sc_hd__fill_2 sky130_fd_sc_hd__fill_4 sky130_fd_sc_hd__fill_8
#Define tie cells
export TIEHI_CELL_AND_PORT = sky130_fd_sc_hd__conb_1 HI
export TIELO_CELL_AND_PORT = sky130_fd_sc_hd__conb_1 LO
#Define the scan enable port
export SCAN_ENABLE_PORT = SCE

#--------------------------------------------------------
# Floorplan
# -------------------------------------------------------
export PLACE_DENSITY = 0.4
export PLACE_SITE = unithd

#--------------------------------------------------------
# IO placement
# -------------------------------------------------------
export IO_LAYER = met5

#--------------------------------------------------------
# Power plan
# -------------------------------------------------------
export PWR_PORT = VPB VPWR
export GND_PORT = VGND VNB
export V_STRIPE_METAL = met4
export H_STRIPE_METAL = met5
export STRIPE_WIDTH = 6
export STRIPE_SPACING = 2
export STRIPE_DISTANCE = 30
export SROUTE_MIN_LAYER = li1(1)
export SROUTE_MAX_LAYER = met4(4)

#---------------------------------------------------------
# Place
# --------------------------------------------------------
export MIN_GLOBAL_ROUTE_LAYER = 2
export MAX_GLOBAL_ROUTE_LAYER = 5

# --------------------------------------------------------
#  CTS
#  -------------------------------------------------------
export CTS_BUF_CELL = sky130_fd_sc_hd__clkbuf_4
export CTS_INV_CELL = sky130_fd_sc_hd__lpflow_clkinvkapwr_1 \
                        sky130_fd_sc_hd__lpflow_clkinvkapwr_2 \
                        sky130_fd_sc_hd__lpflow_clkinvkapwr_4 \
                        sky130_fd_sc_hd__lpflow_clkinvkapwr_8 \
                        sky130_fd_sc_hd__lpflow_clkinvkapwr_16
#Set the routing non-default rule which are used for clk tree routing 
export CTS_ROUTING_MUL = 2
export NDR_CTS_MIN_LAYER = met2
export NDR_CTS_MAX_LAYER = met4
#Set the routing metal which are used for clk tree routing 
export CTS_ROUTING_LAYER_RANGE = 6 2

# ---------------------------------------------------------
#  Route
# ---------------------------------------------------------
export MIN_ROUTING_LAYER = 2
export MAX_ROUTING_LAYER = 6

# ---------------------------------------------------------
#  Chip Finish
# ---------------------------------------------------------
#Set the layer text num for adding PG net text when running lvs 
export LAYER_TEXT_NUM = 72
export GDS_MAP_FILE = $(DESIGN_HOME)/sky130hd/pdk/gds/gds.map

# ---------------------------------------------------------
#  ExtraceRC
# ---------------------------------------------------------
export RCX_RULES = $(DESIGN_HOME)/nangate45/pdk/rcx_patterns.rules

# ---------------------------------------------------------
#  Drc
# ---------------------------------------------------------
export STDCELL_GDS = 

# ---------------------------------------------------------
#  Lvs
# ---------------------------------------------------------
export STDCELL_SPICE =
export STDCELL_NETLIST =

# ---------------------------------------------------------
#  IR Drop
# ---------------------------------------------------------
export QRC_FILE = 
export PWR_NETS_VOLTAGES = 0.9
export PWR_THRESHOLD = 0.85
export GND_NETS_VOLTAGES = 0.0
export GND_THRESHOLD = 0.05
export RAIL_ANALYSIS_TEMPERATURE = 85


