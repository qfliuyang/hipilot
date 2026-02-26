# Process node
export PROCESS = 28

#-----------------------------------------------------
# Tech/Libs
# ----------------------------------------------------
export LEF_FILES = $(DESIGN_HOME)/tsmc28/pdk//lef/tcbn28hpmbwp12t35_7lm5X1ZUTRDL.lef \

export DB_FILES = $(DESIGN_HOME)/tsmc28/pdk//lib/tcbn28hpmbwp12t35tt1v85c.db \
                     $(ADDITIONAL_DBS)

export LIB_FILES = $(DESIGN_HOME)/tsmc28/pdk//lib/tcbn28hpmbwp12t35tt1v85c.lib.gz \
                     $(ADDITIONAL_LIBS)

# Dont use cells list
export DONT_USE_CELLS = \
    DEL* \
    FILL* \
    ANTTENNA* \
    DECAP* \
    TIEH* \
    TIEL* \
    BHD* \
    CK* \
    DCCK* 

# Define fill cells
export FILL_CELLS = 
#Define tie cells
export TIEHI_CELL_AND_PORT = 
export TIELO_CELL_AND_PORT = 
#Define the scan enable port
export SCAN_ENABLE_PORT = SE

#--------------------------------------------------------
# DataInit
#--------------------------------------------------------
export CAP_TABLE = 

#--------------------------------------------------------
# Floorplan
# -------------------------------------------------------
export PLACE_DENSITY = 0.4
export PLACE_SITE = core12T

#--------------------------------------------------------
# IO placement
# -------------------------------------------------------
export IO_LAYER = M5

#--------------------------------------------------------
# Power plan
# -------------------------------------------------------
export PWR_PORT = VDD
export GND_PORT = VSS
export V_STRIPE_METAL = M6
export H_STRIPE_METAL = M7
export STRIPE_WIDTH = 3
export STRIPE_SPACING = 1
export STRIPE_DISTANCE = 15
export SROUTE_MIN_LAYER = M1(1)
export SROUTE_MAX_LAYER = M7(4)

#---------------------------------------------------------
# Place
# --------------------------------------------------------
export MIN_GLOBAL_ROUTE_LAYER = 2
export MAX_GLOBAL_ROUTE_LAYER = 7

# --------------------------------------------------------
#  CTS
#  -------------------------------------------------------
export CTS_BUF_CELL = sky130_fd_sc_hd__clkbuf_4
export CTS_INV_CELL = CKND3BWP12T35 \
                        CKND4BWP12T35 \
                        CKND6BWP12T35 \
                        CKND6BWP12T35 \
                        CKND12BWP12T35 \
                        CKND16BWP12T35
#Set the routing non-default rule which are used for clk tree routing 
export CTS_ROUTING_MUL = 2
export NDR_CTS_MIN_LAYER = M3
export NDR_CTS_MAX_LAYER = M5
#Set the routing metal which are used for clk tree routing 
export CTS_ROUTING_LAYER_RANGE = 7 2

# ---------------------------------------------------------
#  Route
# ---------------------------------------------------------
export MIN_ROUTING_LAYER = 2
export MAX_ROUTING_LAYER = 7

# ---------------------------------------------------------
#  Chip Finish
# ---------------------------------------------------------
#Set the layer text num for adding PG net text when running lvs 
export LAYER_TEXT_NUM = 137
export GDS_MAP_FILE = $(DESIGN_HOME)/tsmc28/pdk/gdsout_5X1Z.map

# ---------------------------------------------------------
#  ExtraceRC
# ---------------------------------------------------------
export RCXT_RULES = $(DESIGN_HOME)/tsmc28/pdk/rc/star_rcxt.mapping

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
export QRC_FILE = $(DESIGN_HOME)/tsmc28/pdk/rc/qrcTechFile
export PWR_NETS_VOLTAGES = 0.9
export PWR_THRESHOLD = 0.85
export GND_NETS_VOLTAGES = 0.0
export GND_THRESHOLD = 0.05
export RAIL_ANALYSIS_TEMPERATURE = 85


