# Common Tcl Procedures for EDA Tools

Extracted from Synopsys ICC2 PGEN (Power Grid Environment) framework and Design Compiler examples.

---

## Custom Via Generation Procedure

### Description
Comprehensive procedure for generating custom via definitions with stack via support and bar via options.

### Source
`dp_pgCustomVias.tcl` - Version 1.4 (2018.06.13)

### Code Pattern
```tcl
proc pGenerateCustomVias { args } {
        global _SNPS_PNS_DEBUG_
        global aLayerInfo
        parse_proc_arguments -args $args options
        if { [info exists _SNPS_PNS_DEBUG_] && ${_SNPS_PNS_DEBUG_} != ""  } {
                puts "SNPS_DEBUG: Current Version 1.4"
                puts "SNPS_DEBUG: Last Update 2018.06.13"
        }

        suppress_message ATTR-11

        # aTmpVia(cutLayerName) "{UpperLayerName width} {LowerLayerName width}
        #   {cut_x_size cut_y_size} fin_count fix_pitch origin"
        catch {array unset aTmpVia}
        array set aTmpVia ""

        # Get Via layers
        set cTargetLayers [get_layers -filter "layer_type==via_cut &&
            mask_order >= [get_attr [get_layers $options(-lower_layer)] mask_order] &&
            mask_order <= [get_attr [get_layers $options(-upper_layer)] mask_order]"]

        set vWidth $options(-width)
        set vViaList ""

        # Calculate basic required information
        foreach_in_collection cCutLayer $cTargetLayers {
                set vCurrentMaskOrder [get_attr $cCutLayer mask_order]
                # Get upper/lower metal layer
                set vUpperMask [expr $vCurrentMaskOrder + 1]
                set vLowerMask [expr $vCurrentMaskOrder - 1]

                set cUpperLayer [get_layers -q -filter "mask_order==$vUpperMask"]
                set cLowerLayer [get_layers -q -filter "mask_order==$vLowerMask"]
                set cHorzLayer [get_layers -q -filter "mask_order <= $vUpperMask &&
                    mask_order >= $vLowerMask && routing_direction == horizontal"]
                set cVertLayer [get_layers -q -filter "mask_order <= $vUpperMask &&
                    mask_order >= $vLowerMask && routing_direction == vertical"]
                set vHorzLayerName [get_attr $cHorzLayer name]
                set vVertLayerName [get_attr $cVertLayer name]

                # Get default size of via
                set vCutWidth  [get_attr $cCutLayer default_width]
                set vCutHeight  [get_attr $cCutLayer default_width]
                set vCutSpacing  [get_attr $cCutLayer min_spacing]
                set vHorzWidth  [get_attr $cHorzLayer default_width]

                # Some tech files don't have default_width for cut layers
                if { $vCutWidth <= 0 || $vCutHeight <= 0 || $vCutSpacing <= 0 } {
                        set cTmpVia [index_collection [get_via_defs -f "is_default&&
                            cut_layer_names==[get_attr $cCutLayer name]" -tech [get_techs]] 0]
                        puts "PNS_INFO: default_width/min_spacing are not defined at via layer."
                        puts "PNS_INFO: [get_attr $cTmpVia name] is used to determine above attribute"
                        set vCutWidth   [get_attr $cTmpVia cut_width]
                        set vCutHeight  [get_attr $cTmpVia cut_height]
                        set vCutSpacing [get_attr $cTmpVia min_cut_spacing]
                }

                # Get cut height. For BAR via, x2.
                if { [info exist options(-use_bar)]  } {
                        set vCutHeight [expr $vCutHeight * 2]
                        set vTmpHorzWidth [get_attr $cHorzLayer default_width]
                        if { $vTmpHorzWidth > $vCutHeight } {
                                set vHorzWidth  $vTmpHorzWidth
                        } else {
                                set vHorzWidth  $vCutHeight
                        }
                }

                # Calculate via parameters based on layer position
                if { [get_attr $cUpperLayer name] == $options(-upper_layer) } {
                        # Most upper VIA
                        set vCutHeight $vCutWidth
                        if { $vCutHeight < 0 } {
                                set vCutHeight [lindex $aLayerInfo([get_attr [$cCutLayer] name]) 1]
                        }
                        set vHorzWidth  [get_attr $cHorzLayer default_width]
                        set vPitch [expr $vCutSpacing + $vCutWidth]
                        set vTmpFins [expr int($vWidth/$vPitch) + 1]
                        set vTracks 1
                        set vFins $vTmpFins
                        set vOrigin [list [expr -1 * (($vFins - 1) * $vPitch * $vTracks / 2 )] 0]
                        set vVertWidth $vWidth
                } else {
                        set vPitch [get_attr $cVertLayer pitch]
                        set vVertWidth [get_attr $cVertLayer default_width]
                        if { [regexp {M[0-9]} [get_attr $cUpperLayer name]] ||
                             [regexp {M[0-9]} [get_attr $cLowerLayer name] ] } {
                                set vTracks 3
                        } else {
                                set vTracks 2
                        }
                        if { [info exists options(-expand)] } {
                                set vFins $options(-expand)
                        } else {
                                set vFins [expr int(($vWidth/$vPitch)/$vTracks) + 1]
                        }
                        set vOrigin [list [expr -1 * (($vFins - 1) * $vPitch * $vTracks / 2 )] 0]
                }
                if { [get_attr $cUpperLayer routing_direction] == "horizontal" } {
                        set aTmpVia($vCurrentMaskOrder) [list [list $vHorzLayerName $vHorzWidth] \
                                                                                        [list $vVertLayerName $vVertWidth] \
                                                                                        [list $vCutWidth $vCutHeight $vCutSpacing] \
                                                                                        $vFins $vTracks $vOrigin]
                } else {
                        set aTmpVia($vCurrentMaskOrder) [list [list $vVertLayerName $vVertWidth] \
                                                                                        [list $vHorzLayerName $vHorzWidth] \
                                                                                        [list $vCutWidth $vCutHeight $vCutSpacing] \
                                                                                        $vFins $vTracks $vOrigin]
                }
        }
        # ... via creation logic continues
        return $vViaList
}

define_proc_attributes pGenerateCustomVias -info "Generate custom vias for given intersection width" \
  -define_args {
        {-width                         "Width of intersection" "" string       required}
        {-use_bar                       "Use Bar VIA"                   "" boolean      optional}
        {-lower_layer           "Lower Layer Name"              "" string       required }
        {-upper_layer           "Upper Layer Name"              "" string       required}
        {-expand                        "Expand Mx Layer"               "" int          optional}
        {-Mx_track                                                                         string   optional}
        {-NonMx_track                                                               string  optional}
  }
```

### Usage Context
- Generates custom via definitions for power grid connections
- Supports stacked vias across multiple layers
- Bar via option for increased current capacity
- Calculates proper via dimensions based on tech file rules

### Related Patterns
- [Layer Information Extraction](#layer-information-extraction)
- [Via Master Rule Creation](#via-master-rule-creation)

---

## Layer Information Extraction Procedure

### Description
Parses technology file to extract layer information including legal widths and via enclosures.

### Source
`dp_pgCustomVias.tcl`

### Code Pattern
```tcl
proc proc_getLayerInfoFromTech {} {
        upvar aLayerInfo aLayerInfo
        global _SNPS_PNS_DEBUG_
        write_tech_file _SNPS_TMP_DUMP_.tech
        set iFile [open _SNPS_TMP_DUMP_.tech r]
        set vState 0

        while { [gets $iFile sLine] >= 0 } {
                switch -regexp $sLine {
                        "Layer \"[A-Z]+[0-9]+\"" {
                                        set vLayerName  [lindex [string map {"\{" "" "\"" ""} $sLine] 1]
                                        if { [info exists _SNPS_PNS_DEBUG_] && ${_SNPS_PNS_DEBUG_}  } {
                                                puts "Layer Start $vLayerName"
                                        }
                                        set vState 1
                                }
                        "maskName" {
                                        if { $vState == 1 } {
                                                set vState 2
                                                if { [info exists _SNPS_PNS_DEBUG_] && ${_SNPS_PNS_DEBUG_}  } {
                                                        puts "\t$sLine"
                                                }
                                        }
                                }
                        "xLegalWidthTbl[[:space:]]" {
                                        if { $vState == 2 } {
                                                set aLayerInfo(${vLayerName}_X) [string map {, "" ( "" ) ""} [lrange $sLine 2 end]]
                                        }
                                }
                        "yLegalWidthTbl[[:space:]]" {
                                        if { $vState == 2 } {
                                                set aLayerInfo(${vLayerName}_Y) [string map {, "" ( "" ) ""} [lrange $sLine 2 end]]
                                        }
                                }
                        "cutTblSize" {
                                                catch { array unset aViaTmp }
                                                array set aViaTmp ""
                                }
                        "cutNameTbl" {
                                                set vTmpLine [string map {"(" "" ")" "" "," " "} [lrange $sLine 2 end]]
                                }
                        "cutWidthTbl" {
                                                set vTmpLine [string map {"(" "" ")" "" "," " "} [lrange $sLine 2 end]]
                                                set aViaTmp(Width) $vTmpLine
                                }
                        "cutDataTypeTbl" {
                                                set vTmpLine [string map {"(" "" ")" "" "," " "} [lrange $sLine 2 end]]
                                                set aLayerInfo($vLayerName) [list width [lindex $aViaTmp(Width) 0]]
                                }
                        "enclosureTblSize[[:space:]]" {
                                        if { $vState == 2 } {
                                                set vLineNumber [lindex $sLine 2]
                                                catch { array unset aVia }
                                                array set aVia ""
                                                for { set i 0 } { $i < $vLineNumber } { incr i } {
                                                        gets $iFile sLine2
                                                        set vTmpLine [string map { enclosureTbl " " = " " ( " " , " " "-1.0" "1000" } $sLine2]
                                                        lappend aVia([lindex $vTmpLine 0]) [lrange $vTmpLine 1 end]
                                                }
                                                foreach vViaIndex [array names aVia] {
                                                        set aLayerInfo(${vLayerName}_${vViaIndex}) [lindex [lsort -real -index 1 $aVia($vViaIndex) ]  0 0]
                                                }
                                        }
                                }
                        "^\}"   {
                                        if { $vState == 2 } {
                                                set vState 0
                                        }
                                }
                }
        }
        close $iFile
        file delete _SNPS_TMP_DUMP_.tech
}
```

### Usage Context
- Extracts DRC-compliant widths from technology file
- Parses via enclosure rules for proper via generation
- Creates array of layer information for other procedures
- Uses temporary tech file dump for parsing

### Related Patterns
- [Custom Via Generation Procedure](#custom-via-generation-procedure)

---

## Rail Creation Procedure

### Description
Creates standard cell power rails with voltage area awareness and blockage handling.

### Source
`dp_pgenRail.tcl`

### Code Pattern
```tcl
# Rail creation with power domain support
if { $insert_std_rail } {
	if { [info exist PNSConfig(rail,script)] && [file exist $PNSConfig(rail,script)] } {
		puts "PNS_INFO: Use given script($PNSConfig(rail,script)) for RAIL creation"
		source $PNSConfig(rail,script)
	} else {
		set_app_options -name plan.pgroute.patch_via_enclosure		-value false
		set_app_options -name plan.pgroute.treat_fixed_stdcell_as_macro -value false

		set vRailStrategyList ""
		if { [info exist PNSConfig(rail,targets) ] } {
			switch $PNSConfig(rail,targets) {
				"CORE" -
				"ALL_POWER_DOMAINS" {
							set cTargetPD [get_power_domains -q]
						}
				default {
							set cTargetPD [get_power_domains -q $PNSConfig(rail,targets)]
						}
			}
		} else {
			puts "PNS_INFO: Target is not defined. Plz define PNSConfig(rail,targets)"
			return
		}

		if { $cTargetPD == "" } {
			puts "PNS_INFO: Target power domain is not exists. Plz check it."
			return
		}

		foreach vLayer $PNSConfig(rail,layers) {
			if { [llength $vLayer] == 2 } {
				set vLayerName [lindex $vLayer 0]
				set vRailWidth [lindex $vLayer 1]
				set vPatternName PTN_RAIL_WIDTH
				set vParams "$vLayerName $vRailWidth"
			} else {
				set vLayerName [lindex $vLayer 0]
				set vPatternName PTN_RAIL
				set vParams "$vLayerName "
			}
			foreach_in_collection cPD $cTargetPD {
				set vNets [list [get_attr $cPD primary_power.name] [get_attr $cPD primary_ground.name]]
				set vDomainName [get_attr $cPD name]
				set cTmpVA [remove_from_collection [get_voltage_areas *] [get_voltage_areas -of $cPD]]
				set vBlockedVA [get_attr [remove_from_collection $cTmpVA [get_voltage_areas DEFAULT_VA]] name]
				set vBlockageOptions "{macros_with_keepout: all} \
									  {placement_blockages : all} \
									  {blocks : [get_attr [get_cells -phy -f is_soft_macro] full_name]} \
									"
				if { $vBlockedVA != "" } {
					lappend vBlockageOptions "{voltage_areas: $vBlockedVA}"
				}
				set vTmpStrategyName ${vDomainName}_RAIL_STRATEGY_${vLayerName}
				set cmd "set_pg_strategy ${vTmpStrategyName} \
								  -voltage_area [get_attr [get_voltage_areas -of $cPD] name] \
								  -blockage {\
												$vBlockageOptions \
											}\
								  -pattern {{name: ${vPatternName}} \
											{nets: $vNets } \
											{parameters: {$vParams}} \
										   }"
				eval $cmd
				lappend vRailStrategyList $vTmpStrategyName
			}

		}
		# Compile & Check
		set vFileName "./.PNS_rail.log"
		set cmd "compile_pg -strategies [list ${vRailStrategyList}] -via_rule NO_VIA_RULE -tag RAIL"
		redirect $vFileName {eval $cmd}
		puts "PNS_INFO: Rail completed. See details $vFileName"
		redirect -variable vTmpLog { sh grep "Committed \[0-9\]\[0-9\]* wires.$" $vFileName}
		regexp {[0-9]+} $vTmpLog vNumber
		puts "PNS_INFO: $vNumber wires created"
		redirect -variable vTmpLog { sh grep "Committed \[0-9\]\[0-9\]* vias.$" $vFileName}
		regexp {[0-9]+} $vTmpLog vNumber
		puts "PNS_INFO: $vNumber vias created"
	}
}
```

### Usage Context
- Creates power rails for all power domains or specific targets
- Supports custom rail widths per layer
- Handles blockages around macros and voltage areas
- Generates completion statistics

### Related Patterns
- [PG Region Creation](#pg-region-creation)
- [Strategy Compilation with Logging](#strategy-compilation-with-logging)

---

## PG Region Creation

### Description
Creates power grid regions for channels between macros.

### Source
`dp_pgenMain.tcl`

### Code Pattern
```tcl
############################################################################
## CHANNEL REGION CREATION
############################################################################
redirect /dev/null {remove_pg_region PG_REGION_CHANNEL_*}
set cMacros [get_cells -phy -filter "design_type==macro"]
set cMergeMacros [resize_polygons -objects [resize_polygons -objects $cMacros -size 2] -size {-2}]
set cPolys [compute_polygon -objects1 [resize_polygons [resize_polygons -objects $cMacros -size 15] -size {-15}] -objects2 $cMergeMacros -operation NOT]
set i 0
foreach_in_collection cPoly [split_poly -out poly_rect $cPolys] {
	redirect /dev/null {create_pg_region PG_REGION_CHANNEL_${i} -poly $cPoly}
	incr i
}
set vPGChRegions [get_attr [get_pg_regions PG_REGION_CHANNEL*] name]
```

### Usage Context
- Identifies channels between macros for strap insertion
- Uses polygon operations to find empty spaces
- Creates named regions for later strategy targeting

### Related Patterns
- [Rail Creation Procedure](#rail-creation-procedure)

---

## Strategy Compilation with Logging

### Description
Compiles PG strategies with detailed logging and statistics extraction.

### Source
`dp_pgenMain.tcl`

### Code Pattern
```tcl
# Strategy Define
set aData(orientSupport) R0
foreach vOrient $aData(orientSupport) {
	if { $vOrient == "MY" } { set vPostfix "MY" } else { set vPostfix "" }
	set vSTRName "${vLayerName}_${vSetNumber}_${aData(pattern)}${vPostfix}"
	set cmd "set_pg_strategy ${vSTRName} \
					$PNSConfig(targetOption${vPostfix}) \
					-blockage [list $aData(blockOption)] \
					-pattern { \
						{name: $aData(pattern)} {nets: {$aData(netNames${vPostfix})}} \
						{parameters: [list $aData(param${vPostfix})]}\
						}\
					$aData(extOptions) \ "

	set vFileName "./.PNS_${vSTRName}.log"
	redirect -append $PNSStrFileName {puts $cmd}
	redirect $vFileName {eval $cmd}
	set cmd "compile_pg -strategies $vSTRName -via_rule NO_VIA_RULE -tag $vSTRName"
	redirect -append $PNSStrFileName {puts $cmd}
	redirect -append $vFileName {eval $cmd}
	puts "PNS_INFO: ${vSTRName} creation completed. See details $vFileName"
	redirect -variable vTmpLog { sh grep "Committed \[0-9\]\[0-9\]* wires.$" $vFileName}
	regexp {[0-9]+} $vTmpLog vNumber
	puts "PNS_INFO: $vNumber wires created"
	redirect -variable vTmpLog { sh grep "Committed \[0-9\]\[0-9\]* vias.$" $vFileName}
	regexp {[0-9]+} $vTmpLog vNumber
	puts "PNS_INFO: $vNumber vias created\n"
}
```

### Usage Context
- Creates strategies with orientation support (R0, MY)
- Logs all commands to strategy file for replay
- Extracts and reports wire/via counts from log
- Separate log file per strategy for debugging

### Related Patterns
- [Rail Creation Procedure](#rail-creation-procedure)

---

## Existing Shape Removal

### Description
Removes existing power grid shapes and vias before regeneration.

### Source
`dp_pgenMain.tcl`

### Code Pattern
```tcl
############################################################################
## REMOVE EXISTING SHAPES/VIAS
############################################################################
if { $delete_straps } {

	set cShapes [get_shapes -q -f "shape_use!=detail_route && shape_use!=user_route"]
	if { $cShapes != "" } {
		puts "PNS_INFO: Removing [sizeof_collection $cShapes] shapes"
		remove_shapes [get_shapes -q -f "shape_use!=detail_route"]
	}
	set cVias [get_vias -q]
	if { $cVias != "" } {
		puts "PNS_INFO: Removing [sizeof_collection $cVias] vias"
		remove_vias [get_vias -q]
	}
}
```

### Usage Context
- Clean-up before power grid regeneration
- Preserves detail route and user route shapes
- Reports number of objects removed

### Related Patterns
- [PG Region Creation](#pg-region-creation)

---

## Configuration Array Processing

### Description
Processes layer configuration arrays for multi-pattern power grid generation.

### Source
`dp_pgConfigExample1.tcl`, `dp_pgenMain.tcl`

### Code Pattern
```tcl
# Configuration setup
set insert_straps 1
set delete_straps 1
set insert_vias 1
set insert_std_rail 1

set switchCellName HEADBUFTIE42Q_D3_N_S8P59TR_C64L20

set PNSConfig(rail,layers)  "{M1 0.058} {M2 0.078}"
set PNSConfig(rail,nets)	"VVDD_CPU VSS"
set PNSConfig(rail,targets) "ALL_POWER_DOMAINS"

# Layer set definition
set layerSet(1) {
		set layerNames "D3 D4 D5 D6 G1 "
		set PNSConfig(target)	   "core"

		set PNSConfig(G1,opMode)	 "strap"
		set PNSConfig(G1,widths)	 1.8
		set PNSConfig(G1,spacings)   2.88
		set PNSConfig(G1,pitch)	 18
		set PNSConfig(G1,nets)	  "VDD_CPU VSS"
}

# Processing in main script
foreach vSetNumber $setNames {
	catch { array unset PNSConfig }
	catch { array unset aData }
	eval $layerSet($vSetNumber)

	# Data Check
	foreach vLayerName $layerNames {
		if { [array names PNSConfig ${vLayerName}* ] == "" } {
			puts "PNS_ERROR: In layerSet($vSetNumber), $vLayerName is not defined"
			return
		}
	}
}
```

### Usage Context
- Defines multiple strap configurations in array format
- Each layer set contains multiple layer configurations
- Evaluates configuration blocks to populate PNSConfig array
- Validates that all required layers are defined

### Related Patterns
- [Target Option Processing](#target-option-processing)

---

## Target Option Processing

### Description
Processes target specifications for PG strategies (core, macros, power domains).

### Source
`dp_pgenMain.tcl`

### Code Pattern
```tcl
if { [info exists PNSConfig(target)] } {
	set PNSConfig(targetCategory) [lindex [split $PNSConfig(target) ":"] 0]
	set PNSConfig(targetObjs) 	 [lindex [split $PNSConfig(target) ":"] 1]
	switch $PNSConfig(targetCategory) {
		"macro" -
		"macros" {
				set PNSConfig(targetOption) "-macros $PNSConfig(targetObjs)"
				}
		"pg_region" -
		"pg_regions" {
				set PNSConfig(targetOption) "-pg_regions [list  [get_attr [get_pg_region $PNSConfig(targetObjs)] name]]"
				}
		"power_domain" -
		"power_domains" {
				set PNSConfig(targetOption) "-voltage_areas [list  [get_attr [get_voltage_areas -of [get_power_domain $PNSConfig(targetObjs)]] name]]"
				}
		"voltage_area" -
		"voltage_areas" {
				set PNSConfig(targetOption) "-voltage_areas $PNSConfig(targetObjs)"
				}
		"core" {
				set PNSConfig(targetOption) "-core"
				}
		"design" {
				set PNSConfig(targetOption) "-design_boundary"
				}
		default {
				set PNSConfig(targetOption) "-core"
				}
	}
} else {
	set PNSConfig(targetOption) "-core"
}
```

### Usage Context
- Parses target specification strings
- Supports macros, PG regions, power domains, voltage areas, core, design boundary
- Generates appropriate set_pg_strategy options
- Defaults to core if not specified

### Related Patterns
- [Configuration Array Processing](#configuration-array-processing)

---

## Via Configuration Processing

### Description
Processes via configurations for wire-to-wire and wire-to-pin connections.

### Source
`dp_pgConfigExample1.tcl`

### Code Pattern
```tcl
# Via configuration between layers
set ViaConfig(wire_to_wire) {
			{ G1 D6 "VDD_CPU VSS" }
			{ D6 D5 "VDD_CPU VSS" }
			{ D5 D4 "VDD_CPU VSS" }
			{ D5 D2 "VDD_CPU VSS" }
			{ D3 D2 "VVDD_CPU" }
			{ D2 M2 "VSS VVDD_CPU" "VIA:CUSTOM"}
}

# Via configuration to pins
set ViaConfig(wire_to_pin) {
			{ D2 D1 "VDD_CPU VVDD_CPU VSS" "VIA:S1BAR_20_20_40_60_H"}
			{ D4 M2 "VDD_CPU"  PIN:VDDG}
}
```

### Usage Context
- Defines which layers connect with vias
- Specifies net names for each via connection
- Optional via master override (CUSTOM or specific)
- Pin-specific via configurations for power switch connections

### Related Patterns
- [Custom Via Generation Procedure](#custom-via-generation-procedure)

---

## Error Handling Pattern

### Description
Common error handling and validation patterns in EDA Tcl scripts.

### Code Pattern
```tcl
# Collection existence check
set cShapes [get_shapes -q -f "shape_use!=detail_route && shape_use!=user_route"]
if { $cShapes != "" } {
	puts "PNS_INFO: Removing [sizeof_collection $cShapes] shapes"
	remove_shapes [get_shapes -q -f "shape_use!=detail_route"]
}

# Array element existence check
if { ![info exist PNSConfig($vLayerName,spacings)] } {
	puts "PNS_INFO: Spacing is not defined. Skip current layer"
	continue
}

# File existence check
if { [info exist PNSConfig(rail,script)] && [file exist $PNSConfig(rail,script)] } {
	puts "PNS_INFO: Use given script($PNSConfig(rail,script)) for RAIL creation"
	source $PNSConfig(rail,script)
}

# Error capture with catch
catch {array unset aLayerInfo}
array set aLayerInfo ""

# Redirect suppression
redirect /dev/null {remove_pg_region PG_REGION_CHANNEL_*}
suppress_message ATTR-11
```

### Usage Context
- Check collections before operations to avoid errors
- Validate configuration before processing
- Use `catch` for cleanup operations that might fail
- Redirect to /dev/null for expected warnings

### Related Patterns
- All procedure patterns

---

## File I/O Utilities

### Description
Common file I/O patterns for logging and script generation.

### Code Pattern
```tcl
# File creation and writing
set PNSStrFileName PNSStrategy.tcl
file delete $PNSStrFileName
sh touch $PNSStrFileName

# Redirect output to file
redirect $vFileName {eval $cmd}
redirect -append $PNSStrFileName {puts $cmd}

# Variable capture from command output
redirect -variable vTmpLog { sh grep "Committed \[0-9\]\[0-9\]* wires.$" $vFileName}
regexp {[0-9]+} $vTmpLog vNumber

# Reading files
set iFile [open _SNPS_TMP_DUMP_.tech r]
while { [gets $iFile sLine] >= 0 } {
	# Process line
}
close $iFile
file delete _SNPS_TMP_DUMP_.tech

# Shell command execution
eval {sh rm -rf ./.PNS_VIA*}
```

### Usage Context
- Redirect for command logging and output capture
- Variable redirect for parsing command output
- File handles for reading large files line by line
- Shell commands for filesystem operations

### Related Patterns
- [Strategy Compilation with Logging](#strategy-compilation-with-logging)

---

## Debug Logging Pattern

### Description
Conditional debug logging based on global flags.

### Code Pattern
```tcl
# Global debug flag
global _SNPS_PNS_DEBUG_
global _SNPS_DBG_

# Conditional debug output
if { [info exists _SNPS_PNS_DEBUG_] && ${_SNPS_PNS_DEBUG_} != ""  } {
	puts "SNPS_DEBUG: Current Version 1.4"
	puts "SNPS_DEBUG: Last Update 2018.06.13"
}

if { [info exists _SNPS_DBG_] && ${_SNPS_DBG_} == "true"}  {
	puts "DEBUG: target category : $PNSConfig(targetOption), object : $PNSConfig(targetObjs)"
}

# CPU time tracking for performance analysis
if { [info exists _SNPS_DBG_] && ${_SNPS_DBG_} == "true" }  {
	set vTmpCpuTimeStart [get_cputime]
	puts "DBG_INFO: CPUTIME : $vTmpCpuTimeStart"
}
# ... operations ...
if { [info exists _SNPS_DBG_] && ${_SNPS_DBG_} == "true" }  {
	set vTmpCpuTimeEnd [get_cputime]
	puts "DBG_INFO: CPUTIME : [get_cputime]"
	puts "DBG_INFO: ELAPSED Time [expr $vTmpCpuTimeEnd - $vTmpCpuTimeStart]s\n"
}
```

### Usage Context
- Enable detailed logging with environment variables
- Performance profiling with CPU time tracking
- Version information for procedure tracking

### Related Patterns
- [Custom Via Generation Procedure](#custom-via-generation-procedure)
