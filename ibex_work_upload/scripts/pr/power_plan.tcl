source $::env(RESULT_DIR)/pr/data/floor_plan.enc

# -------------------------------------------------------------
# Global PG net connect
# -------------------------------------------------------------
globalNetConnect VDD -type pgpin -pin "$::env(PWR_PORT)" -inst *
globalNetConnect VDD -type tiehi -pin "$::env(PWR_PORT)" -inst *
globalNetConnect VDD -type net -net VDD
globalNetConnect VSS -type pgpin -pin "$::env(GND_PORT)" -inst *
globalNetConnect VSS -type tielo -pin "$::env(GND_PORT)" -inst *
globalNetConnect VSS -type net -net VSS

# -------------------------------------------------------------
# Add the power stripe
# -------------------------------------------------------------
addStripe -nets {VSS VDD} \
    -layer $::env(V_STRIPE_METAL) \
    -direction vertical \
    -width $::env(STRIPE_WIDTH) \
    -spacing $::env(STRIPE_SPACING) \
    -set_to_set_distance $::env(STRIPE_DISTANCE) \
    -start_from left \
    -start_offset 1 \
    -uda power_stripe_v

addStripe -nets {VSS VDD} \
    -layer $::env(H_STRIPE_METAL) \
    -direction horizontal \
    -width $::env(STRIPE_WIDTH) \
    -spacing $::env(STRIPE_SPACING) \
    -set_to_set_distance $::env(STRIPE_DISTANCE) \
    -start_from bottom \
    -start_offset 1 \
    -uda power_stripe_h

# -------------------------------------------------------------
# Add the power rail
# -------------------------------------------------------------
set sroute_min_layer $::env(SROUTE_MIN_LAYER)
set sroute_max_layer $::env(SROUTE_MAX_LAYER)
sroute -connect { corePin } \
    -layerChangeRange " $sroute_min_layer $sroute_max_layer " \
    -corePinTarget { none } \
    -allowJogging 1 \
    -crossoverViaLayerRange " $sroute_min_layer $sroute_max_layer " \
    -nets { VDD VSS } \
    -allowLayerChange 1 \
    -targetViaLayerRange " $sroute_min_layer $sroute_max_layer " \
    -uda power_rail

# -------------------------------------------------------------
# Verify connect violation
# -------------------------------------------------------------
verifyConnectivity -type special \
    -noAntenna \
    -noWeakConnect \
    -noUnroutedNet \
    -error 1000 \
    -warning 50
verify_PG_short  -no_routing_blkg

# -------------------------------------------------------------
# Save design
# -------------------------------------------------------------
saveDesign $::env(RESULT_DIR)/pr/data/powerplan.enc

#exit
